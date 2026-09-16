const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true },
  institutionId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Institution', 
    required: true, 
    index: true 
  },
  description: { type: String, trim: true, default: '' },
  isActive: { type: Boolean, default: true, index: true },
  contactEmail: { type: String, trim: true, lowercase: true, default: '' },
  contactPhone: { type: String, trim: true, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true
});

departmentSchema.index({ institutionId: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('Department', departmentSchema);
