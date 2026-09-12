const mongoose = require('mongoose');

const institutionSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, uppercase: true, trim: true, unique: true },
  slug: { type: String, required: true, lowercase: true, trim: true, unique: true },
  domain: { type: String, default: null },
  status: { type: String, enum: ['ACTIVE', 'SUSPENDED'], default: 'ACTIVE' },
  adminUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  branding: {
    logoUrl: { type: String, default: '' },
    faviconUrl: { type: String, default: '' },
    primaryColor: { type: String, default: '#4f46e5' },
    secondaryColor: { type: String, default: '#06b6d4' }
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Institution', institutionSchema);
