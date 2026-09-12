const Semester = require('../models/Semester.model');
const Section = require('../models/Section.model');
const TeachingAssignment = require('../models/TeachingAssignment.model');
const Year = require('../models/Year.model');
const { success, fail, logAudit } = require('@college-erp/shared-utils');
const { assertHODOwns } = require('../utils/assertOwnership');

const createSemester = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const { yearId, semesterNumber } = req.body;
    if (!yearId || !semesterNumber) {
      return res.status(400).json(fail('yearId and semesterNumber are required'));
    }

    // Fetch the parent Year and verify ownership chain
    const yearFilter = { _id: yearId };
    if (tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      yearFilter.institutionId = tenantId;
    }
    const year = await Year.findOne(yearFilter);
    if (!year) return res.status(404).json(fail('Year not found'));

    // CRITICAL: Reject cross-department nesting even with a valid yearId
    if (!assertHODOwns(req, res, year.departmentId)) return;

    const query = { yearId, semesterNumber };
    if (tenantId) query.institutionId = tenantId;

    const existing = await Semester.findOne(query);
    if (existing) {
      return res.status(409).json(fail(`Semester ${semesterNumber} already exists under this year`));
    }

    const semester = await Semester.create({
      departmentId: year.departmentId, // Always inherited from parent Year — never from body
      yearId,
      semesterNumber,
      ...(tenantId ? { institutionId: tenantId } : {})
    });

    await logAudit(req, 'SEMESTER_CREATED', semester._id.toString(), 'Semester', {
      departmentId: year.departmentId, yearId, semesterNumber, institutionId: tenantId
    });
    res.status(201).json(success({ semester }));
  } catch (err) {
    console.error(err);
    res.status(500).json(fail('Internal server error'));
  }
};

const listSemesters = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const { yearId, departmentId } = req.query;
    const filter = {};
    if (yearId) filter.yearId = yearId;
    if (departmentId) filter.departmentId = departmentId;
    if (tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      filter.institutionId = tenantId;
    }

    const semesters = await Semester.find(filter).sort({ semesterNumber: 1 });
    res.json(success({ semesters }));
  } catch (err) {
    res.status(500).json(fail('Internal server error'));
  }
};

const getSemesterById = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const filter = { _id: req.params.id };
    if (tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      filter.institutionId = tenantId;
    }

    const semester = await Semester.findOne(filter);
    if (!semester) return res.status(404).json(fail('Semester not found'));
    if (!assertHODOwns(req, res, semester.departmentId)) return;

    res.json(success({ semester }));
  } catch (err) {
    res.status(500).json(fail('Internal server error'));
  }
};

const updateSemester = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const filter = { _id: req.params.id };
    if (tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      filter.institutionId = tenantId;
    }

    const semester = await Semester.findOne(filter);
    if (!semester) return res.status(404).json(fail('Semester not found'));
    if (!assertHODOwns(req, res, semester.departmentId)) return;

    const { semesterNumber } = req.body;
    if (semesterNumber) semester.semesterNumber = semesterNumber;
    await semester.save();
    res.json(success({ semester }));
  } catch (err) {
    res.status(500).json(fail('Internal server error'));
  }
};

const deleteSemester = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const filter = { _id: req.params.id };
    if (tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      filter.institutionId = tenantId;
    }

    const semester = await Semester.findOne(filter);
    if (!semester) return res.status(404).json(fail('Semester not found'));
    if (!assertHODOwns(req, res, semester.departmentId)) return;

    // Explicit blocking checks — no silent cascade delete
    const secFilter = { semesterId: semester._id };
    if (tenantId) secFilter.institutionId = tenantId;
    const sectionCount = await Section.countDocuments(secFilter);
    if (sectionCount > 0) {
      return res.status(409).json(fail(`${sectionCount} section(s) still active under this semester`));
    }

    const assignFilter = { semesterId: semester._id };
    if (tenantId) assignFilter.institutionId = tenantId;
    const assignmentCount = await TeachingAssignment.countDocuments(assignFilter);
    if (assignmentCount > 0) {
      return res.status(409).json(fail(`${assignmentCount} teaching assignment(s) still active under this semester`));
    }

    await semester.deleteOne();
    await logAudit(req, 'SEMESTER_DELETED', semester._id.toString(), 'Semester', { institutionId: tenantId });
    res.json(success({ message: 'Semester deleted' }));
  } catch (err) {
    console.error(err);
    res.status(500).json(fail('Internal server error'));
  }
};

module.exports = { createSemester, listSemesters, getSemesterById, updateSemester, deleteSemester };
