const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  rollNumber: { type: String, sparse: true },
  passwordHash: { type: String, required: true },
  roles: [{ type: String }],
  institutionId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Institution',
    required: function () {
      return !this.roles || !this.roles.includes('SUPERADMIN');
    },
    default: null,
    index: true
  },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

userSchema.index({ institutionId: 1, rollNumber: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('User', userSchema);
