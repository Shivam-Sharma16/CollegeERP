const mongoose = require('mongoose');

const teachingAssignmentSchema = new mongoose.Schema({
  institutionId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Institution', 
    required: true, 
    index: true 
  },
  facultyId: { type: mongoose.Schema.Types.ObjectId, required: true },
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', required: true },
  academicYearLabel: { type: String, required: true }
}, {
  timestamps: true
});

teachingAssignmentSchema.index({
  institutionId: 1,
  facultyId: 1,
  subjectId: 1,
  sectionId: 1,
  academicYearLabel: 1
});

module.exports = mongoose.model('TeachingAssignment', teachingAssignmentSchema);
