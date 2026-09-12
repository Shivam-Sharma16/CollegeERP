const mongoose = require('mongoose');

const examTypeSchema = new mongoose.Schema({
  institutionId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Institution', 
    required: true, 
    index: true 
  },
  subjectId: { type: mongoose.Schema.Types.ObjectId, required: true },
  type: { type: String, enum: ['quiz', 'midterm', 'endterm', 'assignment'], required: true },
  maxMarks: { type: Number, required: true, min: 1 },
  weightage: { type: Number, required: true, min: 0, max: 1 }
}, {
  timestamps: true
});

examTypeSchema.index({ institutionId: 1, subjectId: 1, type: 1 }, { unique: true });

module.exports = mongoose.model('ExamType', examTypeSchema);
