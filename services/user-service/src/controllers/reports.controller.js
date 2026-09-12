const mongoose = require('mongoose');
const Department = require('../models/Department.model');
const RoleAssignment = require('../models/RoleAssignment.model');
const { success, fail } = require('@college-erp/shared-utils');

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
  getDashboardStats,
  getHodDashboardStats
};
