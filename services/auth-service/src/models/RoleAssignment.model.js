const mongoose = require('mongoose');

const roleAssignmentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, required: true },
  departmentId: { type: mongoose.Schema.Types.ObjectId },
  sectionId: { type: mongoose.Schema.Types.ObjectId },
  validFrom: { type: Date, required: true },
  validTo: { type: Date, default: null }
}, {
  timestamps: true
});

module.exports = mongoose.model('RoleAssignment', roleAssignmentSchema);
