const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  institutionId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Institution', 
    required: true, 
    index: true 
  },
  action: { type: String, required: true },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  actorRole: [{ type: String }],
  targetId: { type: mongoose.Schema.Types.ObjectId, default: null },
  targetType: { type: String },
  details: { type: mongoose.Schema.Types.Mixed, default: {} },
  timestamp: { type: Date, default: Date.now, index: true },
  ipAddress: { type: String, default: null }
}, {
  collection: 'auditlogs',
  timestamps: false
});

auditLogSchema.index({ institutionId: 1, timestamp: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
