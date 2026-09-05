const mongoose = require('mongoose');

const noticeSchema = new mongoose.Schema({
  title: { type: String, required: true },
  body: { type: String, required: true },
  attachments: [{ type: String }],
  targeting: {
    departments: [{ type: mongoose.Schema.Types.ObjectId }],
    years: [{ type: Number }],
    sections: [{ type: mongoose.Schema.Types.ObjectId }],
    roles: [{ type: String }]
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, required: true },
  publishedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Indexes for fast targeting lookups
noticeSchema.index({ 'targeting.departments': 1 });
noticeSchema.index({ 'targeting.years': 1 });
noticeSchema.index({ 'targeting.sections': 1 });
noticeSchema.index({ 'targeting.roles': 1 });
noticeSchema.index({ publishedAt: -1 });

module.exports = mongoose.model('Notice', noticeSchema);
