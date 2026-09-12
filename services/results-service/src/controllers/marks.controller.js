const mongoose = require('mongoose');
const MarksRecord = require('../models/MarksRecord.model');
const ExamType = require('../models/ExamType.model');
const { success, fail, logAudit } = require('@college-erp/shared-utils');

/**
 * Verify faculty has an active TeachingAssignment for the given subjectId.
 * Queries the shared 'teachingassignments' collection (Phase 3 getFacultyLoad equivalent).
 * The check is against the DB — not trusted from the request body.
 */
const verifyFacultyTeachesSubject = async (facultyId, subjectId, tenantId = null) => {
  const query = {
    facultyId: new mongoose.Types.ObjectId(facultyId),
    subjectId: new mongoose.Types.ObjectId(subjectId)
  };
  if (tenantId && mongoose.Types.ObjectId.isValid(tenantId)) {
    query.institutionId = new mongoose.Types.ObjectId(tenantId);
  }

  const assignment = await mongoose.connection.db
    .collection('teachingassignments')
    .findOne(query);
  return assignment !== null;
};

/**
 * POST /marks
 * Single marks entry. Faculty-scoped.
 */
const enterMarks = async (req, res) => {
  try {
    const { examTypeId, studentId, marksObtained } = req.body;
    const facultyId = req.user.userId;
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;

    if (!examTypeId || !studentId || marksObtained === undefined) {
      return res.status(400).json(fail('examTypeId, studentId, and marksObtained are required'));
    }

    // Resolve subjectId from examTypeId for the ownership check within tenant
    const examFilter = { _id: examTypeId };
    if (tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      examFilter.institutionId = tenantId;
    }
    const examType = await ExamType.findOne(examFilter);
    if (!examType) return res.status(404).json(fail('ExamType not found'));

    // Gate: verify faculty teaches this subject (Phase 3 getFacultyLoad logic)
    const teaches = await verifyFacultyTeachesSubject(facultyId, examType.subjectId, tenantId);
    if (!teaches) {
      return res.status(403).json(fail('You do not have a TeachingAssignment for this subject'));
    }

    // Validate marks within bounds
    if (marksObtained > examType.maxMarks) {
      return res.status(422).json(fail(`marksObtained (${marksObtained}) exceeds maxMarks (${examType.maxMarks})`));
    }

    // Upsert: if faculty already entered marks for this student+examType, update
    const recordQuery = { examTypeId, studentId };
    if (tenantId) recordQuery.institutionId = tenantId;

    const record = await MarksRecord.findOneAndUpdate(
      recordQuery,
      {
        examTypeId,
        studentId,
        marksObtained,
        enteredBy: facultyId,
        ...(tenantId ? { institutionId: tenantId } : {})
      },
      { upsert: true, new: true }
    );

    await logAudit(req, 'MARKS_ENTERED', record._id.toString(), 'MarksRecord', {
      examTypeId, studentId, marksObtained, subjectId: examType.subjectId, institutionId: tenantId
    });

    res.status(201).json(success({ record }));
  } catch (err) {
    console.error(err);
    res.status(500).json(fail('Internal server error'));
  }
};

/**
 * POST /marks/bulk
 * Bulk marks entry for the same examType across multiple students.
 * One faculty ownership check; individual marks validation per entry.
 */
const enterMarksBulk = async (req, res) => {
  try {
    const { examTypeId, entries } = req.body; // entries: [{studentId, marksObtained}]
    const facultyId = req.user.userId;
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;

    if (!examTypeId || !Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json(fail('examTypeId and non-empty entries array are required'));
    }

    const examFilter = { _id: examTypeId };
    if (tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      examFilter.institutionId = tenantId;
    }
    const examType = await ExamType.findOne(examFilter);
    if (!examType) return res.status(404).json(fail('ExamType not found'));

    // Single ownership check for the whole bulk operation
    const teaches = await verifyFacultyTeachesSubject(facultyId, examType.subjectId, tenantId);
    if (!teaches) {
      return res.status(403).json(fail('You do not have a TeachingAssignment for this subject'));
    }

    const results = { inserted: 0, errors: [] };

    for (const entry of entries) {
      const { studentId, marksObtained } = entry;

      if (!studentId || marksObtained === undefined) {
        results.errors.push({ studentId, error: 'studentId and marksObtained are required' });
        continue;
      }

      if (marksObtained > examType.maxMarks || marksObtained < 0) {
        results.errors.push({ studentId, error: `marksObtained must be between 0 and ${examType.maxMarks}` });
        continue;
      }

      const itemQuery = { examTypeId, studentId };
      if (tenantId) itemQuery.institutionId = tenantId;

      await MarksRecord.findOneAndUpdate(
        itemQuery,
        {
          examTypeId,
          studentId,
          marksObtained,
          enteredBy: facultyId,
          ...(tenantId ? { institutionId: tenantId } : {})
        },
        { upsert: true }
      );
      results.inserted++;
    }

    await logAudit(req, 'MARKS_BULK_ENTERED', examTypeId, 'MarksRecord', {
      examTypeId, inserted: results.inserted, errors: results.errors.length,
      subjectId: examType.subjectId, institutionId: tenantId
    });

    res.status(201).json(success({ results }));
  } catch (err) {
    console.error(err);
    res.status(500).json(fail('Internal server error'));
  }
};

const getMarksRecordById = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const filter = { _id: req.params.id };
    if (tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      filter.institutionId = tenantId;
    }

    const record = await MarksRecord.findOne(filter);
    if (!record) return res.status(404).json(fail('MarksRecord not found'));

    res.json(success(record));
  } catch (err) {
    console.error(err);
    res.status(500).json(fail('Internal server error'));
  }
};

const listMarks = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const { examTypeId, studentId } = req.query;
    const filter = {};
    if (examTypeId) filter.examTypeId = examTypeId;
    if (studentId) filter.studentId = studentId;
    if (tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      filter.institutionId = tenantId;
    }

    const records = await MarksRecord.find(filter);
    res.json(success(records));
  } catch (err) {
    console.error(err);
    res.status(500).json(fail('Internal server error'));
  }
};

module.exports = { enterMarks, enterMarksBulk, getMarksRecordById, listMarks };
