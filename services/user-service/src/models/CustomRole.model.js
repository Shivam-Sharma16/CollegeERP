const mongoose = require('mongoose');
const { PERMISSION_CATALOG } = require('@college-erp/shared-config');

const customRoleSchema = new mongoose.Schema({
  institutionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Institution',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  permissions: [{
    type: String,
    enum: PERMISSION_CATALOG,
    required: true
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// An institution cannot have two custom roles with the same name
customRoleSchema.index({ institutionId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('CustomRole', customRoleSchema);
