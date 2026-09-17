const Batch = require('../models/Batch.model');
const Section = require('../models/Section.model');
const Semester = require('../models/Semester.model');
const TeachingAssignment = require('../models/TeachingAssignment.model');
const { success, fail, logAudit } = require('@college-erp/shared-utils');
const { assertHODOwns } = require('../utils/assertOwnership');

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
      studentIds: Array.isArray(studentIds) ? studentIds : [],
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

    const { name, studentIds } = req.body;

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

    if (Array.isArray(studentIds)) {
      batch.studentIds = studentIds;
    }

    await batch.save();
    res.json(success({ batch }));
  } catch (err) {
    res.status(500).json(fail('Internal server error'));
  }
};

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
  createBatch,
  listBatches,
  getBatchById,
  updateBatch,
  deleteBatch
};
