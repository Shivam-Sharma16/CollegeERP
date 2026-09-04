const mongoose = require('mongoose');

const examTypeSchema = new mongoose.Schema({
  subjectId: { type: mongoose.Schema.Types.ObjectId, required: true },
  type: { type: String, enum: ['quiz', 'midterm', 'endterm', 'assignment'], required: true },
  maxMarks: { type: Number, required: true, min: 1 },
  weightage: { type: Number, required: true, min: 0, max: 1 }
}, {
  timestamps: true
});

module.exports = mongoose.model('ExamType', examTypeSchema);
