const { createExamType } = require('../services/results.service');
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

    const institutionId = req.user?.institutionId || req.body.institutionId;
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

module.exports = { createExamTypeHandler };
