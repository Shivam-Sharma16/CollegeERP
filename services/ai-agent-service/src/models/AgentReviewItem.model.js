const mongoose = require('mongoose');

/**
 * Pending-review queue.
 * Written by the At-Risk Student Agent and Attendance Integrity Agent controllers.
 * A human (CC / HOD / Faculty) must review and act — the agent never acts directly.
 */
const agentReviewItemSchema = new mongoose.Schema({
  agentName: {
    type: String,
    required: true,
    enum: ['attendanceIntegrityAgent', 'atRiskStudentAgent'],
  },
  targetStudentId: { type: mongoose.Schema.Types.ObjectId, required: true },
  sessionId:       { type: mongoose.Schema.Types.ObjectId, default: null }, // attendance integrity only
  summary:         { type: String, required: true },
  suggestedAction: { type: String, default: '' },
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'dismissed'],
    default: 'pending',
  },
  createdBy:  { type: mongoose.Schema.Types.ObjectId, required: true },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, default: null },
  reviewedAt: { type: Date, default: null },
}, { timestamps: true });

agentReviewItemSchema.index({ status: 1, agentName: 1, createdAt: -1 });
agentReviewItemSchema.index({ targetStudentId: 1 });

module.exports = mongoose.model('AgentReviewItem', agentReviewItemSchema);
