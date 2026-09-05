const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  subjectId: { type: mongoose.Schema.Types.ObjectId, required: true },
  sectionId: { type: mongoose.Schema.Types.ObjectId },
  yearLevel: { type: Number },
  departmentLevel: { type: mongoose.Schema.Types.ObjectId },
  fileUrl: { type: String, required: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, required: true }
}, {
  timestamps: true
});

module.exports = mongoose.model('Note', noteSchema);
