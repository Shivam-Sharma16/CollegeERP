const mongoose = require('mongoose');

const attendanceRecordSchema = new mongoose.Schema({
  institutionId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Institution', 
    required: true, 
    index: true 
  },
  lectureSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'LectureSession', required: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, required: true },
  status: { type: String, enum: ['present', 'absent', 'flagged'], required: true },
  verificationMethod: { type: String },
  deviceFingerprint: { type: String, required: true },
  gpsCoords: {
    lat: { type: Number },
    lng: { type: Number }
  },
  livenessPingResponses: [{
    pingId: { type: String },
    respondedAt: { type: Date },
    withinWindow: { type: Boolean }
  }],
  escalation: {
    escalatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason: { type: String },
    escalatedAt: { type: Date },
    status: { type: String, enum: ['pending', 'resolved'] },
    resolution: { type: String },
    resolvedAt: { type: Date },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }
}, {
  timestamps: true
});

attendanceRecordSchema.index({ institutionId: 1, lectureSessionId: 1, studentId: 1 }, { unique: true });
attendanceRecordSchema.index({ institutionId: 1, 'escalation.status': 1 });

module.exports = mongoose.model('AttendanceRecord', attendanceRecordSchema);
