const mongoose = require('mongoose');
const { ROLES } = require('@college-erp/shared-config');

const roleAssignmentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, enum: Object.values(ROLES), required: true },
  institutionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution' },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  sectionId: { type: mongoose.Schema.Types.ObjectId },
  validFrom: { type: Date, required: true },
  validTo: { type: Date, default: null } // null = current/ongoing
}, {
  timestamps: true
});

module.exports = mongoose.model('RoleAssignment', roleAssignmentSchema);
