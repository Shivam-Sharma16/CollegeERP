const TeachingAssignment = require('../models/TeachingAssignment.model');
const Section = require('../models/Section.model');
const Semester = require('../models/Semester.model');
const Subject = require('../models/Subject.model');
const { success, fail, logAudit } = require('@college-erp/shared-utils');
const { assertHODOwns } = require('../utils/assertOwnership');

const createTeachingAssignment = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const { facultyId, subjectId, sectionId, academicYearLabel } = req.body;

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

    // Invariant 1: Reject duplicate assignment
    const query = {
      facultyId,
      subjectId,
      sectionId,
      academicYearLabel
    };
    if (tenantId) query.institutionId = tenantId;

    const existing = await TeachingAssignment.findOne(query);

    if (existing) {
      return res.status(409).json(fail(
        `Duplicate assignment: faculty already teaches this subject in this section for ${academicYearLabel}. Existing assignment ID: ${existing._id}`
      ));
    }

    const assignment = await TeachingAssignment.create({
      facultyId,
      subjectId,
      sectionId,
      academicYearLabel,
      ...(tenantId ? { institutionId: tenantId } : {})
    });

    await logAudit(req, 'TEACHING_ASSIGNMENT_CREATED', assignment._id.toString(), 'TeachingAssignment', {
      facultyId, subjectId, sectionId, academicYearLabel, institutionId: tenantId
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
    const { sectionId, facultyId, academicYearLabel, departmentId, subjectId } = req.query;
    const filter = {};
    if (sectionId) filter.sectionId = sectionId;
    if (facultyId) filter.facultyId = facultyId;
    if (academicYearLabel) filter.academicYearLabel = academicYearLabel;
    if (subjectId) filter.subjectId = subjectId;
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

    const { academicYearLabel } = req.body;
    if (academicYearLabel) assignment.academicYearLabel = academicYearLabel;

    // Duplicate check after modification
    const conflictQuery = {
      facultyId: assignment.facultyId,
      subjectId: assignment.subjectId,
      sectionId: assignment.sectionId,
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

module.exports = {
  createTeachingAssignment,
  listTeachingAssignments,
  updateTeachingAssignment,
  deleteTeachingAssignment
};
