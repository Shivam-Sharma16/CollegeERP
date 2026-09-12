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
  // Backward compatibility fields for existing frontend and microservice consumers
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

// Pre-save hook to synchronize backward compatibility fields
institutionSchema.pre('save', function (next) {
  if (this.subdomain && !this.slug) {
    this.slug = this.subdomain;
  }
  if (this.slug && !this.subdomain) {
    this.subdomain = this.slug;
  }
  if (this.customDomain && !this.domain) {
    this.domain = this.customDomain;
  }
  if (this.themeConfig) {
    this.branding = {
      logoUrl: this.logoUrl || this.themeConfig.faviconUrl || '',
      faviconUrl: this.themeConfig.faviconUrl || '',
      primaryColor: this.themeConfig.primaryColor || '#4f46e5',
      secondaryColor: this.themeConfig.secondaryColor || '#06b6d4'
    };
  }
  if (this.isActive !== undefined) {
    this.status = this.isActive ? 'ACTIVE' : 'SUSPENDED';
  }
  next();
});

module.exports = mongoose.model('Institution', institutionSchema);
