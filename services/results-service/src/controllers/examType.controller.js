const ExamType = require('../models/ExamType.model');
const { createExamType, updateExamType } = require('../services/results.service');
const { success, fail, logAudit } = require('@college-erp/shared-utils');

/**
 * POST /exam-types
 * Validates weightage sum <= 1.0 per Phase 5 via results.service.checkWeightage.
 * HOD/Admin scoped — route middleware enforces auth.
 */
const createExamTypeHandler = async (req, res) => {
  try {
    const { subjectId, type, maxMarks, weightage } = req.body;

    if (!subjectId || !type || !maxMarks || weightage === undefined) {
      return res.status(400).json(fail('subjectId, type, maxMarks, and weightage are required'));
    }

    const institutionId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId || req.body.institutionId;
    const examType = await createExamType({ institutionId, subjectId, type, maxMarks, weightage });

    await logAudit(req, 'EXAM_TYPE_CREATED', examType._id.toString(), 'ExamType', {
      institutionId, subjectId, type, maxMarks, weightage
    });

    res.status(201).json(success({ examType }));
  } catch (err) {
    // checkWeightage throws descriptive error when sum exceeds 1.0
    if (err.message.includes('Cannot add weightage')) {
      return res.status(422).json(fail(err.message));
    }
    console.error(err);
    res.status(500).json(fail('Internal server error'));
  }
};

const listExamTypesHandler = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const { subjectId } = req.query;
    const filter = {};
    if (subjectId) filter.subjectId = subjectId;
    if (tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      filter.institutionId = tenantId;
    }

    const examTypes = await ExamType.find(filter);
    res.json(success(examTypes));
  } catch (err) {
    console.error(err);
    res.status(500).json(fail('Internal server error'));
  }
};

const getExamTypeByIdHandler = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const filter = { _id: req.params.id };
    if (tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      filter.institutionId = tenantId;
    }

    const examType = await ExamType.findOne(filter);
    if (!examType) return res.status(404).json(fail('ExamType not found'));

    res.json(success(examType));
  } catch (err) {
    console.error(err);
    res.status(500).json(fail('Internal server error'));
  }
};

const updateExamTypeHandler = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const updated = await updateExamType(req.params.id, req.body, tenantId);
    if (!updated) return res.status(404).json(fail('ExamType not found'));

    res.json(success(updated));
  } catch (err) {
    if (err.message.includes('not found')) {
      return res.status(404).json(fail(err.message));
    }
    if (err.message.includes('Cannot add weightage')) {
      return res.status(422).json(fail(err.message));
    }
    console.error(err);
    res.status(500).json(fail('Internal server error'));
  }
};

module.exports = {
  createExamTypeHandler,
  listExamTypesHandler,
  getExamTypeByIdHandler,
  updateExamTypeHandler
};
