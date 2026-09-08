const mongoose = require('mongoose');
const { ROLES } = require('@college-erp/shared-config');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  rollNumber: { type: String, unique: true, sparse: true },
  passwordHash: { type: String, required: true },
  roles: [{ 
    type: String, 
    enum: Object.values(ROLES) 
  }],
  phone: { type: String },
  avatarUrl: { type: String },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

module.exports = mongoose.model('User', userSchema);
