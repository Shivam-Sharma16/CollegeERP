const mongoose = require('mongoose');
const Department = require('../models/Department.model');
const { success, fail, logAudit } = require('@college-erp/shared-utils');

const createDepartment = async (req, res) => {
  try {
    const { name, code } = req.body;

    if (!name || !code) {
      return res.status(400).json(fail('Name and code are required'));
    }

    const institutionId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId || req.body.institutionId || null;
    const normalizedCode = code.trim().toUpperCase();

    const existing = await Department.findOne({ code: normalizedCode, institutionId });
    if (existing) {
      return res.status(409).json(fail('Department with this code already exists in this institution'));
    }

    const department = await Department.create({
      name: name.trim(),
      code: normalizedCode,
      institutionId
    });

    await logAudit(
      req,
      'DEPARTMENT_CREATED',
      department._id.toString(),
      'Department',
      { name, code: normalizedCode, institutionId }
    );

    res.status(201).json(success({ department }));
  } catch (err) {
    console.error(err);
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

    const departments = await Department.find(filter).sort({ name: 1 }).lean();
    res.status(200).json(success(departments));
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

    res.status(200).json(success(department));
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

    const updateData = {};
    if (req.body.name) updateData.name = req.body.name.trim();
    if (req.body.code) updateData.code = req.body.code.trim().toUpperCase();

    const department = await Department.findOneAndUpdate(filter, updateData, { new: true }).lean();
    if (!department) {
      return res.status(404).json(fail('Department not found'));
    }

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

    const department = await Department.findOneAndDelete(filter).lean();
    if (!department) {
      return res.status(404).json(fail('Department not found'));
    }

    await logAudit(
      req,
      'DEPARTMENT_DELETED',
      department._id.toString(),
      'Department',
      { institutionId: department.institutionId }
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
