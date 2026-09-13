const mongoose = require('mongoose');
const AttendanceRecord = require('../models/AttendanceRecord.model');
const LectureSession = require('../models/LectureSession.model');
const { getStudentAttendancePercent } = require('../services/attendance.service');
const { success, fail, logAudit } = require('@college-erp/shared-utils');

const VALID_STATUSES = ['present', 'absent', 'flagged'];

/**
 * GET /records/me
 * Student fetches their own attendance records.
 */
const listOwnRecords = async (req, res) => {
  try {
    const studentId = req.user.userId;
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const filter = {
      studentId: new mongoose.Types.ObjectId(studentId)
    };
    if (tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      filter.institutionId = tenantId;
    }

    const records = await AttendanceRecord.find(filter)
      .populate('lectureSessionId')
      .sort({ createdAt: -1 });

    res.json(success(records));
  } catch (err) {
    console.error(err);
    res.status(500).json(fail('Internal server error'));
  }
};

const getRecordById = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const filter = { _id: req.params.id };
    if (tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      filter.institutionId = tenantId;
    }

    const record = await AttendanceRecord.findOne(filter).populate('lectureSessionId');
    if (!record) return res.status(404).json(fail('Attendance record not found'));

    res.json(success(record));
  } catch (err) {
    console.error(err);
    res.status(500).json(fail('Internal server error'));
  }
};

const getOwnSummary = async (req, res) => {
  try {
    const studentId = req.user.userId;
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const percentage = await getStudentAttendancePercent(studentId, tenantId);

    const baseFilter = {
      studentId: new mongoose.Types.ObjectId(studentId)
    };
    if (tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      baseFilter.institutionId = tenantId;
    }

    const totalRecords = await AttendanceRecord.countDocuments(baseFilter);
    const presentRecords = await AttendanceRecord.countDocuments({
      ...baseFilter,
      status: 'present'
    });
    const flaggedRecords = await AttendanceRecord.countDocuments({
      ...baseFilter,
      status: 'flagged'
    });

    res.json(success({
      overallPercentage: percentage,
      totalRecords,
      presentRecords,
      flaggedRecords
    }));
  } catch (err) {
    console.error(err);
    res.status(500).json(fail('Internal server error'));
  }
};

const overrideRecord = async (req, res) => {
  try {
    const { newStatus, reason } = req.body;
    const facultyId = req.user.userId;
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;

    if (!newStatus || !VALID_STATUSES.includes(newStatus)) {
      return res.status(400).json(fail(`newStatus must be one of: ${VALID_STATUSES.join(', ')}`));
    }

    const recordFilter = { _id: req.params.id };
    if (tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      recordFilter.institutionId = tenantId;
    }
    const record = await AttendanceRecord.findOne(recordFilter);
    if (!record) return res.status(404).json(fail('Attendance record not found'));

    // Verify the faculty owns the session's teaching assignment
    const sessionFilter = { _id: record.lectureSessionId };
    if (tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      sessionFilter.institutionId = tenantId;
    }
    const session = await LectureSession.findOne(sessionFilter);
    if (!session) return res.status(404).json(fail('Parent session not found'));

    const assignmentQuery = {
      _id: new mongoose.Types.ObjectId(session.teachingAssignmentId),
      facultyId: new mongoose.Types.ObjectId(facultyId)
    };
    if (tenantId && mongoose.Types.ObjectId.isValid(tenantId)) {
      assignmentQuery.institutionId = new mongoose.Types.ObjectId(tenantId);
    }
    const assignment = await mongoose.connection.db
      .collection('teachingassignments')
      .findOne(assignmentQuery);

    if (!assignment) {
      return res.status(403).json(fail('You can only override attendance for sessions you teach'));
    }

    const oldStatus = record.status;

    // Apply override
    record.status = newStatus;
    record.verificationMethod = 'manual_override';
    await record.save();

    // Full audit trail — who, when, old status, new status, reason
    await logAudit(req, 'ATTENDANCE_OVERRIDE', record._id.toString(), 'AttendanceRecord', {
      overriddenBy: facultyId,
      studentId: record.studentId.toString(),
      lectureSessionId: record.lectureSessionId.toString(),
      oldStatus,
      newStatus,
      reason: reason || 'No reason provided',
      overriddenAt: new Date().toISOString(),
      institutionId: tenantId
    });

    res.json(success({ record, audit: { oldStatus, newStatus, reason } }));
  } catch (err) {
    console.error(err);
    res.status(500).json(fail('Internal server error'));
  }
};

/**
 * GET /institution-summary
 * Admin-facing institution-wide attendance summary & trend.
 */
const getInstitutionSummary = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const filter = {};
    if (tenantId && !req.user?.roles?.includes('SUPERADMIN') && mongoose.Types.ObjectId.isValid(tenantId)) {
      filter.institutionId = new mongoose.Types.ObjectId(tenantId);
    }

    const totalRecords = await AttendanceRecord.countDocuments(filter);
    const presentRecords = await AttendanceRecord.countDocuments({
      ...filter,
      status: 'present'
    });

    const percentage = totalRecords > 0 ? Math.round((presentRecords / totalRecords) * 100) : 0;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const trendAgg = await AttendanceRecord.aggregate([
      { $match: { ...filter, createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          total: { $sum: 1 },
          present: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } }
        }
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          date: "$_id",
          value: {
            $cond: [
              { $gt: ["$total", 0] },
              { $round: [{ $multiply: [{ $divide: ["$present", "$total"] }, 100] }, 0] },
              0
            ]
          }
        }
      }
    ]);

    res.json(success({
      percentage,
      totalRecords,
      presentRecords,
      trend: trendAgg || []
    }));
  } catch (err) {
    console.error('Failed to get institution summary:', err);
    res.status(500).json(fail('Internal server error'));
  }
};

/**
 * GET /reports/trend
 */
const getAttendanceTrend = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const filter = {};
    if (tenantId && !req.user?.roles?.includes('SUPERADMIN') && mongoose.Types.ObjectId.isValid(tenantId)) {
      filter.institutionId = new mongoose.Types.ObjectId(tenantId);
    }
    res.json(success([]));
  } catch (err) {
    res.status(500).json(fail('Internal server error'));
  }
};

module.exports = { 
  overrideRecord, 
  listOwnRecords, 
  getRecordById, 
  getOwnSummary,
  getInstitutionSummary,
  getAttendanceTrend
};

