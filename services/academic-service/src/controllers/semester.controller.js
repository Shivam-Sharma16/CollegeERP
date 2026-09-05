const Semester = require('../models/Semester.model');
const Section = require('../models/Section.model');
const TeachingAssignment = require('../models/TeachingAssignment.model');
const Year = require('../models/Year.model');
const { success, fail, logAudit } = require('@college-erp/shared-utils');
const { assertHODOwns } = require('../utils/assertOwnership');

const createSemester = async (req, res) => {
  try {
    const { yearId, semesterNumber } = req.body;
    if (!yearId || !semesterNumber) {
      return res.status(400).json(fail('yearId and semesterNumber are required'));
    }

    // Fetch the parent Year and verify ownership chain
    const year = await Year.findById(yearId);
    if (!year) return res.status(404).json(fail('Year not found'));

    // CRITICAL: Reject cross-department nesting even with a valid yearId
    if (!assertHODOwns(req, res, year.departmentId)) return;

    const existing = await Semester.findOne({ yearId, semesterNumber });
    if (existing) {
      return res.status(409).json(fail(`Semester ${semesterNumber} already exists under this year`));
    }

    const semester = await Semester.create({
      departmentId: year.departmentId, // Always inherited from parent Year — never from body
      yearId,
      semesterNumber
    });

    await logAudit(req, 'SEMESTER_CREATED', semester._id.toString(), 'Semester', {
      departmentId: year.departmentId, yearId, semesterNumber
    });
    res.status(201).json(success({ semester }));
  } catch (err) {
    console.error(err);
    res.status(500).json(fail('Internal server error'));
  }
};

const listSemesters = async (req, res) => {
  try {
    const { yearId, departmentId } = req.query;
    const filter = {};
    if (yearId) filter.yearId = yearId;
    if (departmentId) filter.departmentId = departmentId;
    const semesters = await Semester.find(filter).sort({ semesterNumber: 1 });
    res.json(success({ semesters }));
  } catch (err) {
    res.status(500).json(fail('Internal server error'));
  }
};

const updateSemester = async (req, res) => {
  try {
    const semester = await Semester.findById(req.params.id);
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
    const semester = await Semester.findById(req.params.id);
    if (!semester) return res.status(404).json(fail('Semester not found'));
    if (!assertHODOwns(req, res, semester.departmentId)) return;

    // Explicit blocking checks — no silent cascade delete
    const sectionCount = await Section.countDocuments({ semesterId: semester._id });
    if (sectionCount > 0) {
      return res.status(409).json(fail(`${sectionCount} section(s) still active under this semester`));
    }

    const assignmentCount = await TeachingAssignment.countDocuments({ semesterId: semester._id });
    if (assignmentCount > 0) {
      return res.status(409).json(fail(`${assignmentCount} teaching assignment(s) still active under this semester`));
    }

    await semester.deleteOne();
    await logAudit(req, 'SEMESTER_DELETED', semester._id.toString(), 'Semester', {});
    res.json(success({ message: 'Semester deleted' }));
  } catch (err) {
    console.error(err);
    res.status(500).json(fail('Internal server error'));
  }
};

module.exports = { createSemester, listSemesters, updateSemester, deleteSemester };
