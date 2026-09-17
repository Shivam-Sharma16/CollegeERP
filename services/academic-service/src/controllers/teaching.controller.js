const TeachingAssignment = require('../models/TeachingAssignment.model');
const Section = require('../models/Section.model');
const Semester = require('../models/Semester.model');
const Subject = require('../models/Subject.model');
const Batch = require('../models/Batch.model');
const { success, fail, logAudit } = require('@college-erp/shared-utils');
const { assertHODOwns } = require('../utils/assertOwnership');

const createTeachingAssignment = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const { facultyId, subjectId, sectionId, batchId, academicYearLabel } = req.body;

    if (!facultyId || !subjectId || !sectionId || !academicYearLabel) {
      return res.status(400).json(fail('facultyId, subjectId, sectionId, and academicYearLabel are required'));
    }

    // Verify HOD owns the section's department chain within current tenant
    const secFilter = { _id: sectionId };
    if (tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      secFilter.institutionId = tenantId;
    }
    const section = await Section.findOne(secFilter);
    if (!section) return res.status(404).json(fail('Section not found'));

    const semFilter = { _id: section.semesterId };
    if (tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      semFilter.institutionId = tenantId;
    }
    const semester = await Semester.findOne(semFilter);
    if (!semester) return res.status(404).json(fail('Parent semester not found'));
    if (!assertHODOwns(req, res, semester.departmentId)) return;

    // Verify Subject exists and determine batch requirement
    const subFilter = { _id: subjectId };
    if (tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      subFilter.institutionId = tenantId;
    }
    const subject = await Subject.findOne(subFilter);
    if (!subject) return res.status(404).json(fail('Subject not found'));

    let finalBatchId = null;
    if (subject.type === 'lab') {
      if (!batchId) {
        return res.status(400).json(fail('batchId is required for lab subjects'));
      }
      const batchFilter = { _id: batchId, sectionId };
      if (tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
        batchFilter.institutionId = tenantId;
      }
      const batch = await Batch.findOne(batchFilter);
      if (!batch) {
        return res.status(404).json(fail('Batch not found in the specified section'));
      }
      finalBatchId = batch._id;
    } else {
      // For lecture subjects, batchId must not be provided
      if (batchId) {
        return res.status(400).json(fail('batchId cannot be provided for lecture subjects'));
      }
      finalBatchId = null;
    }

    // Invariant 1: Reject duplicate assignment
    const query = {
      facultyId,
      subjectId,
      sectionId,
      batchId: finalBatchId,
      academicYearLabel
    };
    if (tenantId) query.institutionId = tenantId;

    const existing = await TeachingAssignment.findOne(query);

    if (existing) {
      return res.status(409).json(fail(
        `Duplicate assignment: faculty already teaches this subject${finalBatchId ? ' (batch)' : ''} in this section for ${academicYearLabel}. Existing assignment ID: ${existing._id}`
      ));
    }

    const assignment = await TeachingAssignment.create({
      facultyId,
      subjectId,
      sectionId,
      batchId: finalBatchId,
      academicYearLabel,
      ...(tenantId ? { institutionId: tenantId } : {})
    });

    await logAudit(req, 'TEACHING_ASSIGNMENT_CREATED', assignment._id.toString(), 'TeachingAssignment', {
      facultyId, subjectId, sectionId, batchId: finalBatchId, academicYearLabel, institutionId: tenantId
    });

    res.status(201).json(success({ assignment }));
  } catch (err) {
    console.error(err);
    res.status(500).json(fail('Internal server error'));
  }
};

const listTeachingAssignments = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const { sectionId, facultyId, academicYearLabel, departmentId, subjectId, batchId } = req.query;
    const filter = {};
    if (sectionId) filter.sectionId = sectionId;
    if (facultyId) filter.facultyId = facultyId;
    if (academicYearLabel) filter.academicYearLabel = academicYearLabel;
    if (subjectId) filter.subjectId = subjectId;
    if (batchId) filter.batchId = batchId;
    if (tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      filter.institutionId = tenantId;
    }

    if (departmentId) {
      const subjectFilter = { departmentId };
      if (filter.institutionId) subjectFilter.institutionId = filter.institutionId;
      const subjects = await Subject.find(subjectFilter).select('_id');
      const sIds = subjects.map(s => s._id);
      filter.subjectId = { $in: sIds };
    }

    const assignments = await TeachingAssignment.find(filter);
    res.json(success({ assignments }));
  } catch (err) {
    res.status(500).json(fail('Internal server error'));
  }
};

const updateTeachingAssignment = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const filter = { _id: req.params.id };
    if (tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      filter.institutionId = tenantId;
    }

    const assignment = await TeachingAssignment.findOne(filter);
    if (!assignment) return res.status(404).json(fail('Teaching assignment not found'));

    // Verify HOD still owns the section chain
    const secFilter = { _id: assignment.sectionId };
    if (tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      secFilter.institutionId = tenantId;
    }
    const section = await Section.findOne(secFilter);
    const semFilter = section ? { _id: section.semesterId } : null;
    if (semFilter && tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      semFilter.institutionId = tenantId;
    }
    const semester = semFilter ? await Semester.findOne(semFilter) : null;
    if (!semester || !assertHODOwns(req, res, semester.departmentId)) return;

    const { academicYearLabel, batchId } = req.body;
    if (academicYearLabel) assignment.academicYearLabel = academicYearLabel;

    if (batchId !== undefined) {
      const sub = await Subject.findById(assignment.subjectId);
      if (sub && sub.type === 'lab') {
        if (!batchId) {
          return res.status(400).json(fail('batchId is required for lab subjects'));
        }
        const b = await Batch.findOne({ _id: batchId, sectionId: assignment.sectionId });
        if (!b) {
          return res.status(404).json(fail('Batch not found in the specified section'));
        }
        assignment.batchId = b._id;
      } else {
        if (batchId) {
          return res.status(400).json(fail('batchId cannot be provided for lecture subjects'));
        }
        assignment.batchId = null;
      }
    }

    // Duplicate check after modification
    const conflictQuery = {
      facultyId: assignment.facultyId,
      subjectId: assignment.subjectId,
      sectionId: assignment.sectionId,
      batchId: assignment.batchId,
      academicYearLabel: assignment.academicYearLabel,
      _id: { $ne: assignment._id }
    };
    if (tenantId) conflictQuery.institutionId = tenantId;

    const conflict = await TeachingAssignment.findOne(conflictQuery);
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
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const filter = { _id: req.params.id };
    if (tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      filter.institutionId = tenantId;
    }

    const assignment = await TeachingAssignment.findOne(filter);
    if (!assignment) return res.status(404).json(fail('Teaching assignment not found'));

    const secFilter = { _id: assignment.sectionId };
    if (tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      secFilter.institutionId = tenantId;
    }
    const section = await Section.findOne(secFilter);
    const semFilter = section ? { _id: section.semesterId } : null;
    if (semFilter && tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      semFilter.institutionId = tenantId;
    }
    const semester = semFilter ? await Semester.findOne(semFilter) : null;
    if (!semester || !assertHODOwns(req, res, semester.departmentId)) return;

    await assignment.deleteOne();
    await logAudit(req, 'TEACHING_ASSIGNMENT_DELETED', assignment._id.toString(), 'TeachingAssignment', { institutionId: tenantId });
    res.json(success({ message: 'Teaching assignment deleted' }));
  } catch (err) {
    res.status(500).json(fail('Internal server error'));
  }
};

/**
 * GET /faculty-load/:facultyId
 * Returns a summary of all teaching assignments for a faculty member:
 * { sessions, subjects: [], sections: [], assignments: [] }
 */
const getFacultyLoad = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const { facultyId } = req.params;

    if (!facultyId) {
      return res.status(400).json(fail('facultyId is required'));
    }

    const filter = { facultyId };
    if (tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      filter.institutionId = tenantId;
    }

    const assignments = await TeachingAssignment.find(filter)
      .populate('subjectId', 'name code type credits')
      .populate('sectionId', 'name capacity')
      .populate('batchId', 'name studentIds');

    const subjects = [];
    const sections = [];
    const seenSubjects = new Set();
    const seenSections = new Set();

    for (const a of assignments) {
      if (a.subjectId && !seenSubjects.has(a.subjectId._id?.toString())) {
        subjects.push(a.subjectId);
        seenSubjects.add(a.subjectId._id?.toString());
      }
      if (a.sectionId && !seenSections.has(a.sectionId._id?.toString())) {
        sections.push(a.sectionId);
        seenSections.add(a.sectionId._id?.toString());
      }
    }

    res.json(success({
      facultyId,
      sessions: assignments.length,
      subjects,
      sections,
      assignments
    }));
  } catch (err) {
    console.error(err);
    res.status(500).json(fail('Internal server error'));
  }
};

module.exports = {
  createTeachingAssignment,
  listTeachingAssignments,
  updateTeachingAssignment,
  deleteTeachingAssignment,
  getFacultyLoad
};
