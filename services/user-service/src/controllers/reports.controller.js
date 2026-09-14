const mongoose = require('mongoose');
const Department = require('../models/Department.model');
const RoleAssignment = require('../models/RoleAssignment.model');
const User = require('../models/User.model');
const externalReporting = require('../services/externalReporting.service');
const { success, fail } = require('@college-erp/shared-utils');

/**
 * GET /reports/overview
 * Total students/faculty, overall + department-wise breakdown, single aggregation
 * Overall strictly equals the sum of all departments.
 */
const getOverview = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const filter = (tenantId && !req.user?.roles?.includes('SUPERADMIN'))
      ? { institutionId: new mongoose.Types.ObjectId(tenantId) }
      : {};

    // 1. Fetch all departments for this institution (ensures empty departments are included)
    const allDepartments = await Department.find(filter).sort({ name: 1 }).lean();

    const now = new Date();
    const activeFilter = {
      ...filter,
      $or: [{ validTo: null }, { validTo: { $gt: now } }]
    };

    // 2. Count distinct student userIds per department
    const studentAgg = await RoleAssignment.aggregate([
      {
        $match: {
          ...activeFilter,
          role: 'STUDENT',
          departmentId: { $ne: null }
        }
      },
      {
        $group: {
          _id: { departmentId: "$departmentId", userId: "$userId" }
        }
      },
      {
        $group: {
          _id: "$_id.departmentId",
          count: { $sum: 1 }
        }
      }
    ]);

    // 3. Count distinct faculty userIds per department (FACULTY, HOD, CC - no double counting per department)
    const facultyAgg = await RoleAssignment.aggregate([
      {
        $match: {
          ...activeFilter,
          role: { $in: ['FACULTY', 'HOD', 'CC'] },
          departmentId: { $ne: null }
        }
      },
      {
        $group: {
          _id: { departmentId: "$departmentId", userId: "$userId" }
        }
      },
      {
        $group: {
          _id: "$_id.departmentId",
          count: { $sum: 1 }
        }
      }
    ]);

    const studentMap = new Map(studentAgg.map(s => [s._id.toString(), s.count]));
    const facultyMap = new Map(facultyAgg.map(f => [f._id.toString(), f.count]));

    const departments = allDepartments.map(dept => {
      const deptIdStr = dept._id.toString();
      const totalStudents = studentMap.get(deptIdStr) || 0;
      const totalFaculty = facultyMap.get(deptIdStr) || 0;

      return {
        departmentId: dept._id,
        name: dept.name,
        code: dept.code,
        totalStudents,
        totalFaculty
      };
    });

    const overallTotalStudents = departments.reduce((sum, d) => sum + d.totalStudents, 0);
    const overallTotalFaculty = departments.reduce((sum, d) => sum + d.totalFaculty, 0);

    const overall = {
      totalStudents: overallTotalStudents,
      totalFaculty: overallTotalFaculty,
      totalDepartments: departments.length
    };

    res.status(200).json(success({
      overall,
      departments
    }));
  } catch (err) {
    console.error('[ReportsController] Failed to fetch overview:', err);
    res.status(500).json(fail('Internal server error'));
  }
};

/**
 * GET /reports/attendance-trend?departmentId?
 * Overall or department-scoped time-series attendance trend
 */
const getAttendanceTrend = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const { departmentId } = req.query;
    const token = req.headers.authorization;

    let teachingAssignmentIds = null;

    if (departmentId) {
      const assignments = await externalReporting.fetchTeachingAssignments({
        tenantId,
        departmentId,
        token
      });

      if (!assignments || assignments.length === 0) {
        return res.status(200).json(success({ trend: [] }));
      }
      teachingAssignmentIds = assignments.map(a => a._id || a.id);
    }

    const trend = await externalReporting.fetchAttendanceTrend({
      tenantId,
      teachingAssignmentIds,
      token
    });

    res.status(200).json(success({ trend: trend || [] }));
  } catch (err) {
    console.error('[ReportsController] Failed to fetch attendance trend:', err);
    res.status(500).json(fail('Internal server error'));
  }
};

/**
 * GET /reports/academic-performance?departmentId?
 * Average marks trend across exams, optionally department-scoped
 */
const getAcademicPerformance = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const { departmentId } = req.query;
    const token = req.headers.authorization;

    let subjectIds = null;

    if (departmentId) {
      const subjects = await externalReporting.fetchSubjects({
        tenantId,
        departmentId,
        token
      });

      if (!subjects || subjects.length === 0) {
        return res.status(200).json(success({ trend: [] }));
      }
      subjectIds = subjects.map(s => s._id || s.id);
    }

    const trend = await externalReporting.fetchAcademicPerformance({
      tenantId,
      subjectIds,
      token
    });

    res.status(200).json(success({ trend: trend || [] }));
  } catch (err) {
    console.error('[ReportsController] Failed to fetch academic performance:', err);
    res.status(500).json(fail('Internal server error'));
  }
};

/**
 * GET /reports/faculty-workload
 * Subjects + sections count per faculty to spot workload and overload
 */
const getFacultyWorkload = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const { departmentId } = req.query;
    const token = req.headers.authorization;
    const filter = (tenantId && !req.user?.roles?.includes('SUPERADMIN'))
      ? { institutionId: new mongoose.Types.ObjectId(tenantId) }
      : {};

    if (departmentId && mongoose.Types.ObjectId.isValid(departmentId)) {
      filter.departmentId = new mongoose.Types.ObjectId(departmentId);
    }

    // 1. Fetch teaching assignments across all faculty from academic-service
    const assignments = await externalReporting.fetchTeachingAssignments({
      tenantId,
      departmentId,
      token
    });

    // Group assignments by facultyId
    const workloadByFaculty = new Map();
    assignments.forEach(a => {
      const fId = (a.facultyId?._id || a.facultyId || '').toString();
      if (!fId) return;

      if (!workloadByFaculty.has(fId)) {
        workloadByFaculty.set(fId, {
          subjectIds: new Set(),
          sectionIds: new Set(),
          totalAssignments: 0
        });
      }
      const entry = workloadByFaculty.get(fId);
      if (a.subjectId) entry.subjectIds.add((a.subjectId._id || a.subjectId).toString());
      if (a.sectionId) entry.sectionIds.add((a.sectionId._id || a.sectionId).toString());
      entry.totalAssignments++;
    });

    // 2. Query all active faculty users in the institution from user-service
    const now = new Date();
    const activeFacultyRoles = await RoleAssignment.find({
      ...filter,
      role: { $in: ['FACULTY', 'HOD', 'CC'] },
      $or: [{ validTo: null }, { validTo: { $gt: now } }]
    })
      .populate('userId', 'name email rollNumber')
      .populate('departmentId', 'name code')
      .lean();

    // Deduplicate distinct faculty users
    const facultyMap = new Map();
    activeFacultyRoles.forEach(ra => {
      if (!ra.userId) return;
      const uId = (ra.userId._id || ra.userId).toString();
      if (!facultyMap.has(uId)) {
        facultyMap.set(uId, {
          facultyId: uId,
          name: typeof ra.userId === 'object' ? ra.userId.name : 'Faculty Member',
          email: typeof ra.userId === 'object' ? ra.userId.email : '',
          department: typeof ra.departmentId === 'object' ? ra.departmentId.name : null,
          departmentCode: typeof ra.departmentId === 'object' ? ra.departmentId.code : null
        });
      }
    });

    // Also include any faculty IDs present in teaching assignments even if missing from role assignments
    for (const fId of workloadByFaculty.keys()) {
      if (!facultyMap.has(fId)) {
        const u = await User.findById(fId).select('name email').lean();
        facultyMap.set(fId, {
          facultyId: fId,
          name: u ? u.name : 'Faculty Member',
          email: u ? u.email : '',
          department: null,
          departmentCode: null
        });
      }
    }

    const facultyWorkload = Array.from(facultyMap.values()).map(fac => {
      const stats = workloadByFaculty.get(fac.facultyId) || {
        subjectIds: new Set(),
        sectionIds: new Set(),
        totalAssignments: 0
      };

      const totalSubjects = stats.subjectIds.size;
      const totalSections = stats.sectionIds.size;
      const totalAssignments = stats.totalAssignments;
      // Overloaded threshold: 4 or more distinct subjects OR 6 or more distinct sections OR 6+ total assignments
      const isOverloaded = totalSubjects >= 4 || totalSections >= 6 || totalAssignments >= 6;

      return {
        ...fac,
        totalSubjects,
        totalSections,
        totalAssignments,
        isOverloaded
      };
    });

    res.status(200).json(success({ facultyWorkload }));
  } catch (err) {
    console.error('[ReportsController] Failed to fetch faculty workload:', err);
    res.status(500).json(fail('Internal server error'));
  }
};

const getDashboardStats = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const filter = (tenantId && !req.user?.roles?.includes('SUPERADMIN')) ? { institutionId: tenantId } : {};

    const totalDepartments = await Department.countDocuments(filter);
    const totalStudents = await RoleAssignment.countDocuments({
      role: 'STUDENT',
      ...filter,
      $or: [{ validTo: null }, { validTo: { $gt: new Date() } }]
    });
    const totalFaculty = await RoleAssignment.countDocuments({
      role: 'FACULTY',
      ...filter,
      $or: [{ validTo: null }, { validTo: { $gt: new Date() } }]
    });

    let activeSessions = 0;
    if (mongoose.connection.db) {
      const sessionQuery = { status: 'active' };
      if (filter.institutionId) {
        sessionQuery.institutionId = filter.institutionId;
      }
      activeSessions = await mongoose.connection.db
        .collection('lecturesessions')
        .countDocuments(sessionQuery)
        .catch(() => 0);
    }

    res.status(200).json(success({
      totalDepartments,
      totalStudents,
      totalFaculty,
      activeSessions
    }));
  } catch (err) {
    console.error('[ReportsController] Failed to fetch dashboard stats:', err);
    res.status(500).json(fail('Internal server error'));
  }
};

const getHodDashboardStats = async (req, res) => {
  try {
    let departmentId = null;
    const hodRole = req.effectiveRoles?.find(r => r.role === 'HOD');
    if (hodRole && hodRole.departmentId) {
      departmentId = hodRole.departmentId;
    }

    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const filter = departmentId ? { departmentId } : {};
    if (tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      filter.institutionId = tenantId;
    }

    const totalStudents = await RoleAssignment.countDocuments({
      role: 'STUDENT',
      ...filter,
      $or: [{ validTo: null }, { validTo: { $gt: new Date() } }]
    });

    const totalFaculty = await RoleAssignment.countDocuments({
      role: 'FACULTY',
      ...filter,
      $or: [{ validTo: null }, { validTo: { $gt: new Date() } }]
    });

    res.status(200).json(success({
      totalStudents,
      totalFaculty
    }));
  } catch (err) {
    console.error('[ReportsController] Failed to fetch HOD stats:', err);
    res.status(500).json(fail('Internal server error'));
  }
};

module.exports = {
  getOverview,
  getAttendanceTrend,
  getAcademicPerformance,
  getFacultyWorkload,
  getDashboardStats,
  getHodDashboardStats
};

