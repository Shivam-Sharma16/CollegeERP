const mongoose = require('mongoose');
const Department = require('../models/Department.model');
const { success, fail, logAudit } = require('@college-erp/shared-utils');

const createDepartment = async (req, res) => {
  try {
    const { name, code } = req.body;

    if (!name || !code) {
      return res.status(400).json(fail('Name and code are required'));
    }

    const institutionId = req.user?.institutionId || req.body.institutionId || null;
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
    const filter = {};
    if (req.user?.institutionId) {
      filter.institutionId = req.user.institutionId;
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

const resolveDeptTree = async (req, res) => {
  try {
    const filter = {};
    if (req.user?.institutionId) {
      filter.institutionId = req.user.institutionId;
    } else if (req.query.institutionId) {
      filter.institutionId = req.query.institutionId;
    }

    const departments = await Department.find(filter).sort({ name: 1 }).lean();

    const tree = await Promise.all(departments.map(async (dept) => {
      let years = [];
      if (mongoose.connection.db) {
        years = await mongoose.connection.db.collection('years')
          .find({ departmentId: dept._id })
          .sort({ yearNumber: 1 })
          .toArray();

        years = await Promise.all(years.map(async (yr) => {
          let semesters = await mongoose.connection.db.collection('semesters')
            .find({ yearId: yr._id })
            .sort({ semesterNumber: 1 })
            .toArray();

          semesters = await Promise.all(semesters.map(async (sem) => {
            const sections = await mongoose.connection.db.collection('sections')
              .find({ semesterId: sem._id })
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
  resolveDeptTree
};
