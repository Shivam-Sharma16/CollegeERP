const mongoose = require('mongoose');

const sectionAssignmentSchema = new mongoose.Schema({
  sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', required: true },
  semesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Semester', required: true },
  ccUserId: { type: mongoose.Schema.Types.ObjectId, required: true },
  validFrom: { type: Date, required: true },
  validTo: { type: Date, default: null }
}, {
  timestamps: true
});

module.exports = mongoose.model('SectionAssignment', sectionAssignmentSchema);
