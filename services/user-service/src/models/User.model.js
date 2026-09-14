const mongoose = require('mongoose');
const { ROLES } = require('@college-erp/shared-config');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  rollNumber: { type: String, sparse: true },
  passwordHash: { type: String, required: true },
  roles: [{ 
    type: String, 
    enum: Object.values(ROLES) 
  }],
  institutionId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Institution',
    required: function () {
      return !this.roles || !this.roles.includes('SUPERADMIN');
    },
    default: null,
    index: true
  },
  phone: { type: String },
  avatarUrl: { type: String },
  feeGroup: { 
    type: String, 
    default: 'general', 
    trim: true, 
    lowercase: true 
  },
  activeSemesterId: { type: mongoose.Schema.Types.ObjectId, default: null },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

userSchema.index({ institutionId: 1, email: 1 }, { unique: true });
userSchema.index(
  { institutionId: 1, rollNumber: 1 }, 
  { unique: true, partialFilterExpression: { rollNumber: { $type: 'string' } } }
);

module.exports = mongoose.model('User', userSchema);
