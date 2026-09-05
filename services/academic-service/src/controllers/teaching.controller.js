const TeachingAssignment = require('../models/TeachingAssignment.model');
const Section = require('../models/Section.model');
const Semester = require('../models/Semester.model');
const { success, fail, logAudit } = require('@college-erp/shared-utils');
const { assertHODOwns } = require('../utils/assertOwnership');

const createTeachingAssignment = async (req, res) => {
  try {
    const { facultyId, subjectId, sectionId, academicYearLabel } = req.body;

    if (!facultyId || !subjectId || !sectionId || !academicYearLabel) {
      return res.status(400).json(fail('facultyId, subjectId, sectionId, and academicYearLabel are required'));
    }

    // Verify HOD owns the section's department chain
    const section = await Section.findById(sectionId);
    if (!section) return res.status(404).json(fail('Section not found'));

    const semester = await Semester.findById(section.semesterId);
    if (!semester) return res.status(404).json(fail('Parent semester not found'));
    if (!assertHODOwns(req, res, semester.departmentId)) return;

    // Invariant 1: Reject duplicate assignment
    const existing = await TeachingAssignment.findOne({
      facultyId,
      subjectId,
      sectionId,
      academicYearLabel
    });

    if (existing) {
      return res.status(409).json(fail(
        `Duplicate assignment: faculty already teaches this subject in this section for ${academicYearLabel}. Existing assignment ID: ${existing._id}`
      ));
    }

    const assignment = await TeachingAssignment.create({
      facultyId,
      subjectId,
      sectionId,
      academicYearLabel
    });

    await logAudit(req, 'TEACHING_ASSIGNMENT_CREATED', assignment._id.toString(), 'TeachingAssignment', {
      facultyId, subjectId, sectionId, academicYearLabel
    });

    res.status(201).json(success({ assignment }));
  } catch (err) {
    console.error(err);
    res.status(500).json(fail('Internal server error'));
  }
};

const listTeachingAssignments = async (req, res) => {
  try {
    const { sectionId, facultyId, academicYearLabel } = req.query;
    const filter = {};
    if (sectionId) filter.sectionId = sectionId;
    if (facultyId) filter.facultyId = facultyId;
    if (academicYearLabel) filter.academicYearLabel = academicYearLabel;

    const assignments = await TeachingAssignment.find(filter);
    res.json(success({ assignments }));
  } catch (err) {
    res.status(500).json(fail('Internal server error'));
  }
};

const updateTeachingAssignment = async (req, res) => {
  try {
    const assignment = await TeachingAssignment.findById(req.params.id);
    if (!assignment) return res.status(404).json(fail('Teaching assignment not found'));

    // Verify HOD still owns the section chain
    const section = await Section.findById(assignment.sectionId);
    const semester = section ? await Semester.findById(section.semesterId) : null;
    if (!semester || !assertHODOwns(req, res, semester.departmentId)) return;

    const { academicYearLabel } = req.body;
    if (academicYearLabel) assignment.academicYearLabel = academicYearLabel;

    // Duplicate check after modification
    const conflict = await TeachingAssignment.findOne({
      facultyId: assignment.facultyId,
      subjectId: assignment.subjectId,
      sectionId: assignment.sectionId,
      academicYearLabel: assignment.academicYearLabel,
      _id: { $ne: assignment._id }
    });
    if (conflict) {
      return res.status(409).json(fail(`Duplicate assignment would result. Existing ID: ${conflict._id}`));
    }

    await assignment.save();
    res.json(success({ assignment }));
  } catch (err) {
    res.status(500).json(fail('Internal server error'));
  }
};

const deleteTeachingAssignment = async (req, res) => {
  try {
    const assignment = await TeachingAssignment.findById(req.params.id);
    if (!assignment) return res.status(404).json(fail('Teaching assignment not found'));

    const section = await Section.findById(assignment.sectionId);
    const semester = section ? await Semester.findById(section.semesterId) : null;
    if (!semester || !assertHODOwns(req, res, semester.departmentId)) return;

    await assignment.deleteOne();
    await logAudit(req, 'TEACHING_ASSIGNMENT_DELETED', assignment._id.toString(), 'TeachingAssignment', {});
    res.json(success({ message: 'Teaching assignment deleted' }));
  } catch (err) {
    res.status(500).json(fail('Internal server error'));
  }
};

module.exports = {
  createTeachingAssignment,
  listTeachingAssignments,
  updateTeachingAssignment,
  deleteTeachingAssignment
};
