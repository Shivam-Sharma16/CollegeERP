const mongoose = require('mongoose');

const noticeSchema = new mongoose.Schema({
  institutionId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Institution', 
    required: true, 
    index: true 
  },
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
noticeSchema.index({ institutionId: 1, publishedAt: -1 });
noticeSchema.index({ institutionId: 1, 'targeting.departments': 1 });
noticeSchema.index({ institutionId: 1, 'targeting.years': 1 });
noticeSchema.index({ institutionId: 1, 'targeting.sections': 1 });
noticeSchema.index({ institutionId: 1, 'targeting.roles': 1 });

module.exports = mongoose.model('Notice', noticeSchema);
