const crypto = require('crypto');
const mongoose = require('mongoose');
const LectureSession = require('../models/LectureSession.model');
const AttendanceRecord = require('../models/AttendanceRecord.model');
const { verifyCheckIn, getStudentAttendancePercent } = require('../services/attendance.service');
const { success, fail, logAudit } = require('@college-erp/shared-utils');

const QR_WINDOW_SECONDS = 30;

const generateQRToken = () => crypto.randomUUID();

/**
 * Verifies the caller (facultyId) has a TeachingAssignment for the given teachingAssignmentId.
 * Queries the shared 'teachingassignments' collection directly (cross-service DB access).
 */
const verifyFacultyOwnsAssignment = async (facultyId, teachingAssignmentId) => {
  const assignment = await mongoose.connection.db
    .collection('teachingassignments')
    .findOne({
      _id: new mongoose.Types.ObjectId(teachingAssignmentId),
      facultyId: new mongoose.Types.ObjectId(facultyId)
    });
  return assignment !== null;
};

// POST /sessions
const createSession = async (req, res) => {
  try {
    const { teachingAssignmentId, date, timeSlot, topic, geofence } = req.body;
    const facultyId = req.user.userId;

    if (!teachingAssignmentId || !date || !timeSlot || !geofence) {
      return res.status(400).json(fail('teachingAssignmentId, date, timeSlot, and geofence are required'));
    }

    // Gate: verify faculty owns this teaching assignment BEFORE creating session
    const owns = await verifyFacultyOwnsAssignment(facultyId, teachingAssignmentId);
    if (!owns) {
      return res.status(403).json(fail('You do not have a TeachingAssignment for this subject/section'));
    }

    const qrTokenSecret = generateQRToken();
    const qrTokenExpiresAt = new Date(Date.now() + QR_WINDOW_SECONDS * 1000);

    const institutionId = req.user?.institutionId || req.body.institutionId;

    const session = await LectureSession.create({
      institutionId,
      teachingAssignmentId,
      date: new Date(date),
      timeSlot,
      topic,
      qrTokenSecret,
      qrTokenExpiresAt,
      geofence,
      status: 'active'
    });

    await logAudit(req, 'SESSION_CREATED', session._id.toString(), 'LectureSession', {
      teachingAssignmentId, date, timeSlot
    });

    res.status(201).json(success({
      session: { ...session.toObject(), qrTokenSecret } // Return initial token on creation
    }));
  } catch (err) {
    console.error(err);
    res.status(500).json(fail('Internal server error'));
  }
};

// GET /sessions/:id/qr — Rotate and return fresh QR token
const rotateQR = async (req, res) => {
  try {
    const session = await LectureSession.findById(req.params.id);
    if (!session) return res.status(404).json(fail('Session not found'));
    if (session.status === 'closed') return res.status(400).json(fail('Session is already closed'));

    // Verify faculty owns the session
    const owns = await verifyFacultyOwnsAssignment(req.user.userId, session.teachingAssignmentId);
    if (!owns) return res.status(403).json(fail('Access denied'));

    // Rotate token
    session.qrTokenSecret = generateQRToken();
    session.qrTokenExpiresAt = new Date(Date.now() + QR_WINDOW_SECONDS * 1000);
    await session.save();

    res.json(success({
      qrToken: session.qrTokenSecret,
      expiresAt: session.qrTokenExpiresAt
    }));
  } catch (err) {
    console.error(err);
    res.status(500).json(fail('Internal server error'));
  }
};

// POST /sessions/:id/checkin — Full Phase 4 verification pipeline
const checkIn = async (req, res) => {
  try {
    const { studentId, qrToken, deviceFingerprint, gpsCoords } = req.body;

    if (!studentId || !qrToken || !deviceFingerprint) {
      return res.status(400).json(fail('studentId, qrToken, and deviceFingerprint are required'));
    }

    // Gate: ensure session is still active
    const session = await LectureSession.findById(req.params.id);
    if (!session) return res.status(404).json(fail('Session not found'));
    if (session.status === 'closed') {
      return res.status(400).json(fail('Session is closed — check-ins are no longer accepted'));
    }

    // Delegate to the full verification pipeline
    const record = await verifyCheckIn({
      lectureSessionId: req.params.id,
      studentId,
      qrToken,
      deviceFingerprint,
      gpsCoords
    });

    res.status(201).json(success({ record }));
  } catch (err) {
    // verifyCheckIn throws descriptive errors (invalid QR, expired, etc.)
    if (err.message.includes('Invalid or expired QR token')) {
      return res.status(400).json(fail(err.message));
    }
    if (err.message.includes('not found')) {
      return res.status(404).json(fail(err.message));
    }
    console.error(err);
    res.status(500).json(fail('Internal server error'));
  }
};

// POST /sessions/:id/close — Lock session, aggregate, fire event
const closeSession = async (req, res) => {
  try {
    const session = await LectureSession.findById(req.params.id);
    if (!session) return res.status(404).json(fail('Session not found'));
    if (session.status === 'closed') return res.status(400).json(fail('Session already closed'));

    // Verify faculty owns the session
    const owns = await verifyFacultyOwnsAssignment(req.user.userId, session.teachingAssignmentId);
    if (!owns) return res.status(403).json(fail('Access denied'));

    session.status = 'closed';
    await session.save();

    // Final aggregation of all students in section
    const records = await AttendanceRecord.find({ lectureSessionId: session._id });
    const presentCount = records.filter(r => r.status === 'present').length;

    await logAudit(req, 'SESSION_CLOSED', session._id.toString(), 'LectureSession', {
      teachingAssignmentId: session.teachingAssignmentId,
      totalRecords: records.length,
      presentCount
    });

    // Fire session.closed event to notification-service (fire-and-forget)
    const notificationUrl = process.env.NOTIFICATION_SERVICE_URL;
    if (notificationUrl) {
      fetch(`${notificationUrl}/internal/session-closed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session._id.toString(),
          teachingAssignmentId: session.teachingAssignmentId.toString(),
          presentCount,
          totalRecords: records.length
        })
      }).catch(err => console.error('[session.close] Failed to notify notification-service:', err.message));
    }

    res.json(success({
      message: 'Session closed',
      summary: { totalRecords: records.length, presentCount }
    }));
  } catch (err) {
    console.error(err);
    res.status(500).json(fail('Internal server error'));
  }
};

module.exports = { createSession, rotateQR, checkIn, closeSession };
