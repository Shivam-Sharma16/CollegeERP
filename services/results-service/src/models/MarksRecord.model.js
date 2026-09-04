const mongoose = require('mongoose');

const marksRecordSchema = new mongoose.Schema({
  examTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'ExamType', required: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, required: true },
  marksObtained: { type: Number, required: true, min: 0 },
  enteredBy: { type: mongoose.Schema.Types.ObjectId, required: true }
}, {
  timestamps: true
});

module.exports = mongoose.model('MarksRecord', marksRecordSchema);
