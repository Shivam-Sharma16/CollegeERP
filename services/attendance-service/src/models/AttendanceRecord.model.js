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
  }]
}, {
  timestamps: true
});

attendanceRecordSchema.index({ institutionId: 1, lectureSessionId: 1, studentId: 1 }, { unique: true });

module.exports = mongoose.model('AttendanceRecord', attendanceRecordSchema);
