const mongoose = require('mongoose');
const Batch = require('../models/Batch.model');
const Section = require('../models/Section.model');
const Semester = require('../models/Semester.model');
const TeachingAssignment = require('../models/TeachingAssignment.model');
const { success, fail, logAudit } = require('@college-erp/shared-utils');
const { assertHODOwns } = require('../utils/assertOwnership');

/**
 * Validates that every studentId in the array actually belongs to the given section
 * by querying the active roleassignments collection.
 */
const validateStudentsBelongToSection = async (sectionId, studentIds, tenantId = null) => {
  if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
    return { valid: true };
  }

  const studentOids = studentIds.map(id => (typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id));
  const sectionOid = typeof sectionId === 'string' ? new mongoose.Types.ObjectId(sectionId) : sectionId;

  const query = {
    userId: { $in: studentOids },
    sectionId: sectionOid,
    role: 'STUDENT',
    $or: [{ validTo: null }, { validTo: { $gt: new Date() } }]
  };
  if (tenantId && mongoose.Types.ObjectId.isValid(tenantId)) {
    query.institutionId = new mongoose.Types.ObjectId(tenantId);
  }

  const assignments = await mongoose.connection.db
    .collection('roleassignments')
    .find(query)
    .toArray();

  const assignedStudentIdStrs = new Set(assignments.map(a => a.userId.toString()));
  const unassignedStudents = studentIds.filter(id => !assignedStudentIdStrs.has(id.toString()));

  if (unassignedStudents.length > 0) {
    return {
      valid: false,
      invalidIds: unassignedStudents,
      error: `The following student(s) do not belong to this section: ${unassignedStudents.join(', ')}`
    };
  }

  return { valid: true };
};

// POST /sections/:id/batches — HOD creates batch under specific section
const createSectionBatch = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const sectionId = req.params.id;
    const { name, studentIds } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json(fail('Batch name is required'));
    }

    // Verify section exists and HOD owns parent department
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

    // Validate students belong to this section
    const studentList = Array.isArray(studentIds) ? studentIds : [];
    if (studentList.length > 0) {
      const validation = await validateStudentsBelongToSection(sectionId, studentList, tenantId);
      if (!validation.valid) {
        return res.status(400).json(fail(validation.error));
      }
    }

    // Duplicate check within section
    const query = { sectionId, name: name.trim() };
    if (tenantId) query.institutionId = tenantId;

    const existing = await Batch.findOne(query);
    if (existing) {
      return res.status(409).json(fail(`Batch '${name.trim()}' already exists in this section`));
    }

    const batch = await Batch.create({
      sectionId,
      name: name.trim(),
      studentIds: studentList,
      ...(tenantId ? { institutionId: tenantId } : {})
    });

    await logAudit(req, 'SECTION_BATCH_CREATED', batch._id.toString(), 'Batch', {
      sectionId, name: batch.name, studentCount: batch.studentIds.length, institutionId: tenantId
    });

    res.status(201).json(success({ batch }));
  } catch (err) {
    console.error(err);
    res.status(500).json(fail('Internal server error'));
  }
};

// GET /sections/:id/batches — List all batches for a specific section
const listSectionBatches = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const sectionId = req.params.id;

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
    if (!semester || !assertHODOwns(req, res, semester.departmentId)) return;

    const filter = { sectionId };
    if (tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      filter.institutionId = tenantId;
    }

    const batches = await Batch.find(filter).sort({ name: 1 });
    res.json(success({ batches }));
  } catch (err) {
    res.status(500).json(fail('Internal server error'));
  }
};

// POST /batches — General batch creation
const createBatch = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const { sectionId, name, studentIds } = req.body;

    if (!sectionId || !name) {
      return res.status(400).json(fail('sectionId and name are required'));
    }

    // Verify section exists and HOD owns parent department
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

    // Validate students belong to this section
    const studentList = Array.isArray(studentIds) ? studentIds : [];
    if (studentList.length > 0) {
      const validation = await validateStudentsBelongToSection(sectionId, studentList, tenantId);
      if (!validation.valid) {
        return res.status(400).json(fail(validation.error));
      }
    }

    // Duplicate check within section
    const query = { sectionId, name: name.trim() };
    if (tenantId) query.institutionId = tenantId;

    const existing = await Batch.findOne(query);
    if (existing) {
      return res.status(409).json(fail(`Batch '${name}' already exists in this section`));
    }

    const batch = await Batch.create({
      sectionId,
      name: name.trim(),
      studentIds: studentList,
      ...(tenantId ? { institutionId: tenantId } : {})
    });

    await logAudit(req, 'BATCH_CREATED', batch._id.toString(), 'Batch', {
      sectionId, name: batch.name, studentCount: batch.studentIds.length, institutionId: tenantId
    });

    res.status(201).json(success({ batch }));
  } catch (err) {
    console.error(err);
    res.status(500).json(fail('Internal server error'));
  }
};

// GET /batches — List batches with optional sectionId query
const listBatches = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const { sectionId } = req.query;
    const filter = {};
    if (sectionId) filter.sectionId = sectionId;
    if (tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      filter.institutionId = tenantId;
    }

    const batches = await Batch.find(filter).sort({ name: 1 });
    res.json(success({ batches }));
  } catch (err) {
    res.status(500).json(fail('Internal server error'));
  }
};

// GET /batches/:id
const getBatchById = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const filter = { _id: req.params.id };
    if (tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      filter.institutionId = tenantId;
    }

    const batch = await Batch.findOne(filter);
    if (!batch) return res.status(404).json(fail('Batch not found'));

    // Check ownership via section -> semester
    const secFilter = { _id: batch.sectionId };
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

    res.json(success({ batch }));
  } catch (err) {
    res.status(500).json(fail('Internal server error'));
  }
};

// PATCH/PUT /batches/:id — Update batch (name, studentIds, addStudentIds, removeStudentIds)
const updateBatch = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const filter = { _id: req.params.id };
    if (tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      filter.institutionId = tenantId;
    }

    const batch = await Batch.findOne(filter);
    if (!batch) return res.status(404).json(fail('Batch not found'));

    // Check ownership
    const secFilter = { _id: batch.sectionId };
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

    const { name, studentIds, addStudentIds, removeStudentIds } = req.body;

    // 1. Update Name
    if (name && name.trim() !== batch.name) {
      const conflictQuery = {
        sectionId: batch.sectionId,
        name: name.trim(),
        _id: { $ne: batch._id }
      };
      if (tenantId) conflictQuery.institutionId = tenantId;
      const conflict = await Batch.findOne(conflictQuery);
      if (conflict) {
        return res.status(409).json(fail(`Batch '${name}' already exists in this section`));
      }
      batch.name = name.trim();
    }

    // 2. Full studentIds replacement
    if (Array.isArray(studentIds)) {
      if (studentIds.length > 0) {
        const validation = await validateStudentsBelongToSection(batch.sectionId, studentIds, tenantId);
        if (!validation.valid) {
          return res.status(400).json(fail(validation.error));
        }
      }
      batch.studentIds = studentIds;
    }

    // 3. Selective add students
    if (Array.isArray(addStudentIds) && addStudentIds.length > 0) {
      const validation = await validateStudentsBelongToSection(batch.sectionId, addStudentIds, tenantId);
      if (!validation.valid) {
        return res.status(400).json(fail(validation.error));
      }

      const existingSet = new Set(batch.studentIds.map(id => id.toString()));
      for (const sid of addStudentIds) {
        if (!existingSet.has(sid.toString())) {
          batch.studentIds.push(sid);
          existingSet.add(sid.toString());
        }
      }
    }

    // 4. Selective remove students
    if (Array.isArray(removeStudentIds) && removeStudentIds.length > 0) {
      const removeSet = new Set(removeStudentIds.map(id => id.toString()));
      batch.studentIds = batch.studentIds.filter(id => !removeSet.has(id.toString()));
    }

    await batch.save();
    res.json(success({ batch }));
  } catch (err) {
    res.status(500).json(fail('Internal server error'));
  }
};

// DELETE /batches/:id
const deleteBatch = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const filter = { _id: req.params.id };
    if (tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      filter.institutionId = tenantId;
    }

    const batch = await Batch.findOne(filter);
    if (!batch) return res.status(404).json(fail('Batch not found'));

    // Check ownership
    const secFilter = { _id: batch.sectionId };
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

    // Check if teaching assignments exist for this batch
    const taQuery = { batchId: batch._id };
    if (tenantId) taQuery.institutionId = tenantId;
    const assignmentExists = await TeachingAssignment.findOne(taQuery);
    if (assignmentExists) {
      return res.status(400).json(fail('Cannot delete batch with existing teaching assignments'));
    }

    await batch.deleteOne();
    await logAudit(req, 'BATCH_DELETED', batch._id.toString(), 'Batch', { institutionId: tenantId });
    res.json(success({ message: 'Batch deleted successfully' }));
  } catch (err) {
    res.status(500).json(fail('Internal server error'));
  }
};

module.exports = {
  createSectionBatch,
  listSectionBatches,
  createBatch,
  listBatches,
  getBatchById,
  updateBatch,
  deleteBatch,
  validateStudentsBelongToSection
};
