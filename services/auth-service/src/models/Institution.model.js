const mongoose = require('mongoose');

const institutionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Institution name is required'],
    trim: true
  },
  subdomain: {
    type: String,
    required: [true, 'Subdomain is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[a-z0-9-]+$/, 'Subdomain must contain only lowercase letters, numbers, and hyphens']
  },
  customDomain: {
    type: String,
    default: null,
    trim: true,
    lowercase: true,
    unique: true,
    sparse: true
  },
  logoUrl: {
    type: String,
    default: ''
  },
  themeConfig: {
    primaryColor: { type: String, default: '#4f46e5' },
    secondaryColor: { type: String, default: '#06b6d4' },
    faviconUrl: { type: String, default: '' }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  slug: {
    type: String,
    lowercase: true,
    trim: true
  },
  code: {
    type: String,
    uppercase: true,
    trim: true
  },
  domain: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'SUSPENDED'],
    default: 'ACTIVE'
  },
  adminUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
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
