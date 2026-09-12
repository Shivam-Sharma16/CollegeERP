const mongoose = require('mongoose');

/**
 * AI-generated notice drafts.
 * Status is ALWAYS 'draft' — the Notice Drafting Agent cannot publish directly.
 * A human with notice-publish permission must explicitly change status to 'published'
 * via the notice-service API.
 */
const noticeDraftSchema = new mongoose.Schema({
  institutionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Institution',
    required: true,
    index: true,
  },
  title:  { type: String, required: true },
  body:   { type: String, required: true },
  targeting: {
    departments: [{ type: mongoose.Schema.Types.ObjectId }],
    years:       [{ type: Number }],
    sections:    [{ type: mongoose.Schema.Types.ObjectId }],
    roles:       [{ type: String }],
  },
  status:       { type: String, enum: ['draft'], default: 'draft' }, // ONLY 'draft' is allowed
  createdBy:    { type: mongoose.Schema.Types.ObjectId, required: true },
  aiGenerated:  { type: Boolean, default: true },
}, { timestamps: true });

noticeDraftSchema.index({ institutionId: 1, createdAt: -1 });

module.exports = mongoose.model('NoticeDraft', noticeDraftSchema);
