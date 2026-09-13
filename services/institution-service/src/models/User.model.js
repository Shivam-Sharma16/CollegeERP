const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  roles: [{ type: String }],
  institutionId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Institution',
    default: null 
  },
  phone: { type: String },
  avatarUrl: { type: String },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
