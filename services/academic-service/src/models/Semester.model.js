const mongoose = require('mongoose');

const semesterSchema = new mongoose.Schema({
  departmentId: { type: mongoose.Schema.Types.ObjectId, required: true },
  yearId: { type: mongoose.Schema.Types.ObjectId, ref: 'Year', required: true },
  semesterNumber: { type: Number, required: true, min: 1, max: 8 }
}, {
  timestamps: true
});

module.exports = mongoose.model('Semester', semesterSchema);
