const mongoose = require('mongoose');

const marksRecordSchema = new mongoose.Schema({
  institutionId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Institution', 
    required: true, 
    index: true 
  },
  examTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'ExamType', required: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, required: true },
  marksObtained: { type: Number, required: true, min: 0 },
  enteredBy: { type: mongoose.Schema.Types.ObjectId, required: true }
}, {
  timestamps: true
});

marksRecordSchema.index({ institutionId: 1, examTypeId: 1, studentId: 1 }, { unique: true });

module.exports = mongoose.model('MarksRecord', marksRecordSchema);
