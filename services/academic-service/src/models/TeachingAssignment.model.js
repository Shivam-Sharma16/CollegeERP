const mongoose = require('mongoose');

const teachingAssignmentSchema = new mongoose.Schema({
  facultyId: { type: mongoose.Schema.Types.ObjectId, required: true },
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', required: true },
  academicYearLabel: { type: String, required: true }
}, {
  timestamps: true
});

module.exports = mongoose.model('TeachingAssignment', teachingAssignmentSchema);
