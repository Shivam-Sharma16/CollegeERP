const mongoose = require('mongoose');

const sectionAssignmentSchema = new mongoose.Schema({
  institutionId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Institution', 
    required: true, 
    index: true 
  },
  sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', required: true },
  semesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Semester', required: true },
  ccUserId: { type: mongoose.Schema.Types.ObjectId, required: true },
  validFrom: { type: Date, required: true },
  validTo: { type: Date, default: null }
}, {
  timestamps: true
});

sectionAssignmentSchema.index({ institutionId: 1, sectionId: 1, semesterId: 1 });

module.exports = mongoose.model('SectionAssignment', sectionAssignmentSchema);
