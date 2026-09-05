const mongoose = require('mongoose');
const AttendanceRecord = require('../models/AttendanceRecord.model');
const LectureSession = require('../models/LectureSession.model');
const { success, fail, logAudit } = require('@college-erp/shared-utils');

const VALID_STATUSES = ['present', 'absent', 'flagged'];

/**
 * POST /records/:id/override
 * Faculty-only manual correction. Writes a full AuditLog with before/after status.
 */
const overrideRecord = async (req, res) => {
  try {
    const { newStatus, reason } = req.body;
    const facultyId = req.user.userId;

    if (!newStatus || !VALID_STATUSES.includes(newStatus)) {
      return res.status(400).json(fail(`newStatus must be one of: ${VALID_STATUSES.join(', ')}`));
    }

    const record = await AttendanceRecord.findById(req.params.id);
    if (!record) return res.status(404).json(fail('Attendance record not found'));

    // Verify the faculty owns the session's teaching assignment
    const session = await LectureSession.findById(record.lectureSessionId);
    if (!session) return res.status(404).json(fail('Parent session not found'));

    const assignment = await mongoose.connection.db
      .collection('teachingassignments')
      .findOne({
        _id: new mongoose.Types.ObjectId(session.teachingAssignmentId),
        facultyId: new mongoose.Types.ObjectId(facultyId)
      });

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
      overriddenAt: new Date().toISOString()
    });

    res.json(success({ record, audit: { oldStatus, newStatus, reason } }));
  } catch (err) {
    console.error(err);
    res.status(500).json(fail('Internal server error'));
  }
};

module.exports = { overrideRecord };
