const mongoose = require('mongoose');

const lectureSessionSchema = new mongoose.Schema({
  institutionId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Institution', 
    required: true, 
    index: true 
  },
  teachingAssignmentId: { type: mongoose.Schema.Types.ObjectId, required: true },
  date: { type: Date, required: true },
  timeSlot: { type: String, required: true },
  topic: { type: String },
  qrTokenSecret: { type: String, required: true },
  qrTokenExpiresAt: { type: Date, required: true },
  geofence: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    radiusMeters: { type: Number, required: true }
  },
  status: { type: String, enum: ['scheduled', 'active', 'closed'], default: 'scheduled' }
}, {
  timestamps: true
});

lectureSessionSchema.index({ institutionId: 1, teachingAssignmentId: 1, date: 1 });

module.exports = mongoose.model('LectureSession', lectureSessionSchema);
