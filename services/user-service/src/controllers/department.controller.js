const mongoose = require('mongoose');
const Department = require('../models/Department.model');
const RoleAssignment = require('../models/RoleAssignment.model');
const User = require('../models/User.model');
const { success, fail, logAudit } = require('@college-erp/shared-utils');

const createDepartment = async (req, res) => {
  try {
    // Phase 69: SuperAdmin cannot create departments — Admin-only
    if (req.user?.roles?.includes('SUPERADMIN') || !req.user?.roles?.includes('ADMIN')) {
      return res.status(403).json(fail('Access Denied: Only Admin can create departments'));
    }

    const { name, code, description, contactEmail, contactPhone, isActive, hodId } = req.body;

    if (!name || !code) {
      return res.status(400).json(fail('Name and code are required'));
    }

    const trimmedName = String(name).trim();
    if (trimmedName.length < 2 || trimmedName.length > 100) {
      return res.status(400).json(fail('Department name must be between 2 and 100 characters'));
    }

    const normalizedCode = String(code).trim().toUpperCase();
    if (normalizedCode.length < 2 || normalizedCode.length > 10 || !/^[A-Z0-9_-]+$/.test(normalizedCode)) {
      return res.status(400).json(fail('Department code must be 2 to 10 uppercase alphanumeric characters (hyphens and underscores allowed)'));
    }

    const trimmedPhone = contactPhone ? String(contactPhone).trim() : '';
    if (trimmedPhone && !/^\d{10}$/.test(trimmedPhone)) {
      return res.status(400).json(fail('Contact phone number must be exactly 10 digits'));
    }

    const trimmedEmail = contactEmail ? String(contactEmail).trim().toLowerCase() : '';
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return res.status(400).json(fail('Please provide a valid email address'));
    }

    const trimmedDesc = description ? String(description).trim() : '';
    if (trimmedDesc.length > 500) {
      return res.status(400).json(fail('Description cannot exceed 500 characters'));
    }

    // Strictly scoped to Admin's own institutionId (ignoring any forged body.institutionId)
    const institutionId = req.user?.institutionId;
    if (!institutionId) {
      return res.status(403).json(fail('Admin must be associated with an institution'));
    }

    const existing = await Department.findOne({ code: normalizedCode, institutionId });
    if (existing) {
      return res.status(409).json(fail('Department with this code already exists in this institution'));
    }

    const department = await Department.create({
      name: trimmedName,
      code: normalizedCode,
      description: trimmedDesc,
      contactEmail: trimmedEmail,
      contactPhone: trimmedPhone,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
      institutionId,
      createdBy: req.user?.userId || req.user?._id
    });

    // Optional: Assign initial HOD if hodId provided
    if (hodId && mongoose.Types.ObjectId.isValid(hodId)) {
      const hodUser = await User.findOne({ _id: hodId, institutionId, isActive: true });
      if (hodUser) {
        if (!hodUser.roles.includes('HOD')) {
          hodUser.roles.push('HOD');
          await hodUser.save();
        }
        await RoleAssignment.create({
          userId: hodUser._id,
          role: 'HOD',
          institutionId,
          departmentId: department._id,
          validFrom: new Date()
        });
      }
    }

    await logAudit(
      req,
      'DEPARTMENT_CREATED',
      department._id.toString(),
      'Department',
      { name: department.name, code: normalizedCode, institutionId }
    );

    res.status(201).json(success({ department }));
  } catch (err) {
    console.error('[DepartmentController] Create error:', err);
    res.status(500).json(fail('Internal server error'));
  }
};

const listDepartments = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const filter = {};
    if (tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      filter.institutionId = tenantId;
    } else if (req.query.institutionId) {
      filter.institutionId = req.query.institutionId;
    }

    if (req.query.status === 'active') {
      filter.isActive = true;
    } else if (req.query.status === 'inactive') {
      filter.isActive = false;
    }

    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search.trim(), 'i');
      filter.$or = [{ name: searchRegex }, { code: searchRegex }];
    }

    const departments = await Department.find(filter).sort({ name: 1 }).lean();
    const deptIds = departments.map(d => d._id);

    // Aggregate real-time members from RoleAssignments
    let assignments = [];
    if (deptIds.length > 0) {
      assignments = await RoleAssignment.find({
        departmentId: { $in: deptIds },
        $or: [{ validTo: null }, { validTo: { $gt: new Date() } }]
      })
        .populate('userId', 'name email avatarUrl isActive')
        .lean();
    }

    // Map stats per department
    const enriched = departments.map(dept => {
      const deptAssignments = assignments.filter(
        a => a.departmentId && a.departmentId.toString() === dept._id.toString()
      );

      const hodAssignments = deptAssignments.filter(
        a => a.role === 'HOD' && a.userId && a.userId.isActive
      );
      const activeHod = hodAssignments[0]?.userId || null;

      const facultyAssignments = deptAssignments.filter(
        a => a.role === 'FACULTY' && a.userId && a.userId.isActive
      );
      const studentAssignments = deptAssignments.filter(
        a => a.role === 'STUDENT' && a.userId && a.userId.isActive
      );

      return {
        ...dept,
        hod: activeHod ? {
          _id: activeHod._id,
          name: activeHod.name,
          email: activeHod.email,
          avatarUrl: activeHod.avatarUrl || null
        } : null,
        hodCount: hodAssignments.length,
        facultyCount: facultyAssignments.length,
        studentCount: studentAssignments.length
      };
    });

    res.status(200).json(success(enriched));
  } catch (err) {
    console.error('[DepartmentController] Failed to list departments:', err);
    res.status(500).json(fail('Internal server error'));
  }
};

const getDepartmentById = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const filter = { _id: req.params.id };
    if (tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      filter.institutionId = tenantId;
    }

    const department = await Department.findOne(filter).lean();
    if (!department) {
      return res.status(404).json(fail('Department not found'));
    }

    // Fetch members and counts
    const assignments = await RoleAssignment.find({
      departmentId: department._id,
      $or: [{ validTo: null }, { validTo: { $gt: new Date() } }]
    })
      .populate('userId', 'name email avatarUrl isActive phone')
      .lean();

    const hodAssignments = assignments.filter(
      a => a.role === 'HOD' && a.userId && a.userId.isActive
    );
    const activeHod = hodAssignments[0]?.userId || null;

    const facultyCount = assignments.filter(
      a => a.role === 'FACULTY' && a.userId && a.userId.isActive
    ).length;

    const studentCount = assignments.filter(
      a => a.role === 'STUDENT' && a.userId && a.userId.isActive
    ).length;

    // Optional: academic structure count if years collection exists
    let yearsCount = 0;
    if (mongoose.connection.db) {
      yearsCount = await mongoose.connection.db.collection('years')
        .countDocuments({ departmentId: department._id });
    }

    res.status(200).json(success({
      ...department,
      hod: activeHod ? {
        _id: activeHod._id,
        name: activeHod.name,
        email: activeHod.email,
        phone: activeHod.phone || null,
        avatarUrl: activeHod.avatarUrl || null
      } : null,
      hodCount: hodAssignments.length,
      facultyCount,
      studentCount,
      yearsCount
    }));
  } catch (err) {
    console.error('[DepartmentController] Failed to get department:', err);
    res.status(500).json(fail('Internal server error'));
  }
};

const updateDepartment = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const filter = { _id: req.params.id };
    if (tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      filter.institutionId = tenantId;
    }

    const existingDept = await Department.findOne(filter);
    if (!existingDept) {
      return res.status(404).json(fail('Department not found'));
    }

    const updateData = {};
    if (req.body.name !== undefined) {
      const trimmedName = String(req.body.name).trim();
      if (trimmedName.length < 2 || trimmedName.length > 100) {
        return res.status(400).json(fail('Department name must be between 2 and 100 characters'));
      }
      updateData.name = trimmedName;
    }

    if (req.body.code !== undefined) {
      const normalizedCode = String(req.body.code).trim().toUpperCase();
      if (normalizedCode.length < 2 || normalizedCode.length > 10 || !/^[A-Z0-9_-]+$/.test(normalizedCode)) {
        return res.status(400).json(fail('Department code must be 2 to 10 uppercase alphanumeric characters (hyphens and underscores allowed)'));
      }
      if (normalizedCode !== existingDept.code) {
        const duplicate = await Department.findOne({
          code: normalizedCode,
          institutionId: existingDept.institutionId,
          _id: { $ne: existingDept._id }
        });
        if (duplicate) {
          return res.status(409).json(fail('Department with this code already exists in this institution'));
        }
        updateData.code = normalizedCode;
      }
    }

    if (req.body.description !== undefined) {
      const trimmedDesc = String(req.body.description).trim();
      if (trimmedDesc.length > 500) {
        return res.status(400).json(fail('Description cannot exceed 500 characters'));
      }
      updateData.description = trimmedDesc;
    }

    if (req.body.isActive !== undefined) updateData.isActive = Boolean(req.body.isActive);

    if (req.body.contactEmail !== undefined) {
      const trimmedEmail = String(req.body.contactEmail).trim().toLowerCase();
      if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        return res.status(400).json(fail('Please provide a valid email address'));
      }
      updateData.contactEmail = trimmedEmail;
    }

    if (req.body.contactPhone !== undefined) {
      const trimmedPhone = String(req.body.contactPhone).trim();
      if (trimmedPhone && !/^\d{10}$/.test(trimmedPhone)) {
        return res.status(400).json(fail('Contact phone number must be exactly 10 digits'));
      }
      updateData.contactPhone = trimmedPhone;
    }

    // HOD Assignment / Reassignment
    if (req.body.hodId !== undefined) {
      if (!req.body.hodId) {
        // Unassign current HOD
        await RoleAssignment.updateMany(
          { departmentId: existingDept._id, role: 'HOD', validTo: null },
          { $set: { validTo: new Date() } }
        );
      } else if (mongoose.Types.ObjectId.isValid(req.body.hodId)) {
        const hodUser = await User.findOne({
          _id: req.body.hodId,
          institutionId: existingDept.institutionId,
          isActive: true
        });

        if (hodUser) {
          if (!hodUser.roles.includes('HOD')) {
            hodUser.roles.push('HOD');
            await hodUser.save();
          }

          // Retire previous HOD assignment
          await RoleAssignment.updateMany(
            { departmentId: existingDept._id, role: 'HOD', validTo: null },
            { $set: { validTo: new Date() } }
          );

          // Create new HOD assignment
          await RoleAssignment.create({
            userId: hodUser._id,
            role: 'HOD',
            institutionId: existingDept.institutionId,
            departmentId: existingDept._id,
            validFrom: new Date()
          });
        }
      }
    }

    const department = await Department.findOneAndUpdate(filter, updateData, { new: true }).lean();

    await logAudit(
      req,
      'DEPARTMENT_UPDATED',
      department._id.toString(),
      'Department',
      { updates: updateData, institutionId: department.institutionId }
    );

    res.status(200).json(success(department));
  } catch (err) {
    console.error('[DepartmentController] Failed to update department:', err);
    res.status(500).json(fail('Internal server error'));
  }
};

const deleteDepartment = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const filter = { _id: req.params.id };
    if (tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      filter.institutionId = tenantId;
    }

    const department = await Department.findOne(filter);
    if (!department) {
      return res.status(404).json(fail('Department not found'));
    }

    // Safety guard: Check for active enrolled students or faculty in this department
    const activeMembersCount = await RoleAssignment.countDocuments({
      departmentId: department._id,
      role: { $in: ['STUDENT', 'FACULTY'] },
      $or: [{ validTo: null }, { validTo: { $gt: new Date() } }]
    });

    if (activeMembersCount > 0) {
      return res.status(400).json(fail(
        `Cannot delete department with ${activeMembersCount} active students or faculty. Reassign members first or set department status to Inactive.`
      ));
    }

    // End any HOD assignment
    await RoleAssignment.updateMany(
      { departmentId: department._id, validTo: null },
      { $set: { validTo: new Date() } }
    );

    await Department.findOneAndDelete(filter);

    await logAudit(
      req,
      'DEPARTMENT_DELETED',
      department._id.toString(),
      'Department',
      { name: department.name, code: department.code, institutionId: department.institutionId }
    );

    res.status(200).json(success({ message: 'Department deleted successfully' }));
  } catch (err) {
    console.error('[DepartmentController] Failed to delete department:', err);
    res.status(500).json(fail('Internal server error'));
  }
};

const resolveDeptTree = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const filter = {};
    if (tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      filter.institutionId = tenantId;
    } else if (req.query.institutionId) {
      filter.institutionId = req.query.institutionId;
    }

    const departments = await Department.find(filter).sort({ name: 1 }).lean();

    const tree = await Promise.all(departments.map(async (dept) => {
      let years = [];
      if (mongoose.connection.db) {
        const yearFilter = { departmentId: dept._id };
        if (filter.institutionId) yearFilter.institutionId = filter.institutionId;
        years = await mongoose.connection.db.collection('years')
          .find(yearFilter)
          .sort({ yearNumber: 1 })
          .toArray();

        years = await Promise.all(years.map(async (yr) => {
          const semFilter = { yearId: yr._id };
          if (filter.institutionId) semFilter.institutionId = filter.institutionId;
          let semesters = await mongoose.connection.db.collection('semesters')
            .find(semFilter)
            .sort({ semesterNumber: 1 })
            .toArray();

          semesters = await Promise.all(semesters.map(async (sem) => {
            const secFilter = { semesterId: sem._id };
            if (filter.institutionId) secFilter.institutionId = filter.institutionId;
            const sections = await mongoose.connection.db.collection('sections')
              .find(secFilter)
              .sort({ name: 1 })
              .toArray();

            return {
              _id: sem._id,
              semester: sem.semesterNumber ?? sem.semester ?? 1,
              sections: sections.map(s => ({ _id: s._id, name: s.name }))
            };
          }));

          return {
            _id: yr._id,
            year: yr.yearNumber ?? yr.year ?? 1,
            semesters
          };
        }));
      }

      return {
        ...dept,
        years
      };
    }));

    res.status(200).json(success({ departments: tree }));
  } catch (err) {
    console.error('[DepartmentController] Failed to resolve dept tree:', err);
    res.status(500).json(fail('Internal server error'));
  }
};

module.exports = {
  createDepartment,
  listDepartments,
  getDepartmentById,
  updateDepartment,
  deleteDepartment,
  resolveDeptTree
};
