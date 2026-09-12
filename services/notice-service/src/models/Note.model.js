const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  institutionId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Institution', 
    required: true, 
    index: true 
  },
  subjectId: { type: mongoose.Schema.Types.ObjectId, required: true },
  sectionId: { type: mongoose.Schema.Types.ObjectId },
  yearLevel: { type: Number },
  departmentLevel: { type: mongoose.Schema.Types.ObjectId },
  fileUrl: { type: String, required: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, required: true }
}, {
  timestamps: true
});

noteSchema.index({ institutionId: 1, subjectId: 1 });

module.exports = mongoose.model('Note', noteSchema);
