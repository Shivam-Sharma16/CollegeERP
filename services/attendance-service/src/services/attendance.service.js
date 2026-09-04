const mongoose = require('mongoose');
const LectureSession = require('../models/LectureSession.model');
const AttendanceRecord = require('../models/AttendanceRecord.model');

// Haversine distance in meters
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // metres
  const p1 = lat1 * Math.PI/180;
  const p2 = lat2 * Math.PI/180;
  const dp = (lat2-lat1) * Math.PI/180;
  const dl = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(dp/2) * Math.sin(dp/2) +
          Math.cos(p1) * Math.cos(p2) *
          Math.sin(dl/2) * Math.sin(dl/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}

const verifyCheckIn = async ({ lectureSessionId, studentId, qrToken, deviceFingerprint, gpsCoords }) => {
  const session = await LectureSession.findById(lectureSessionId);
  if (!session) {
    throw new Error('LectureSession not found');
  }

  // 1. Validate QR token -> fail fast
  const now = new Date();
  if (qrToken !== session.qrTokenSecret || now >= session.qrTokenExpiresAt) {
    throw new Error('Invalid or expired QR token');
  }

  let status = 'present';
  let verificationMethod = 'qr+geofence';

  // 2. Geofence check
  if (gpsCoords && typeof gpsCoords.lat === 'number' && typeof gpsCoords.lng === 'number' && session.geofence) {
    const dist = getDistance(gpsCoords.lat, gpsCoords.lng, session.geofence.lat, session.geofence.lng);
    if (dist > session.geofence.radiusMeters) {
      status = 'flagged';
      verificationMethod = 'geofence_fail';
    }
  } else {
    // Missing coords implies geofence check failed
    status = 'flagged';
    verificationMethod = 'geofence_fail';
  }

  // 3. Device fingerprint check
  const existingRecord = await AttendanceRecord.findOne({
    lectureSessionId: session._id,
    deviceFingerprint
  });

  if (existingRecord && existingRecord.studentId.toString() !== studentId.toString()) {
    status = 'flagged';
    verificationMethod = 'duplicate_device';
    
    // Flag the existing record as well
    existingRecord.status = 'flagged';
    existingRecord.verificationMethod = 'duplicate_device';
    await existingRecord.save();
  } else if (existingRecord && existingRecord.studentId.toString() === studentId.toString()) {
    // Already checked in with same device? Just return the existing record or update it?
    // Let's assume they shouldn't check in twice, but if they do we can just return it
    return existingRecord;
  }

  // 4. Create record
  const record = new AttendanceRecord({
    lectureSessionId: session._id,
    studentId,
    status,
    verificationMethod,
    deviceFingerprint,
    gpsCoords
  });
  
  await record.save();

  return record;
};

const getStudentAttendancePercent = async (studentId) => {
  const studentObjectId = typeof studentId === 'string' ? new mongoose.Types.ObjectId(studentId) : studentId;
  
  const result = await AttendanceRecord.aggregate([
    { $match: { studentId: studentObjectId } },
    {
      $group: {
        _id: null,
        totalSessions: { $sum: 1 },
        presentCount: {
          $sum: {
            $cond: [{ $eq: ['$status', 'present'] }, 1, 0]
          }
        }
      }
    }
  ]);

  if (!result || result.length === 0) return 0;
  
  const { totalSessions, presentCount } = result[0];
  return totalSessions > 0 ? (presentCount / totalSessions) * 100 : 0;
};

module.exports = {
  verifyCheckIn,
  getStudentAttendancePercent,
  getDistance
};
