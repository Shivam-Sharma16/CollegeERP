const mongoose = require('mongoose');

const semesterSchema = new mongoose.Schema({
  institutionId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Institution', 
    required: true, 
    index: true 
  },
  departmentId: { type: mongoose.Schema.Types.ObjectId, required: true },
  yearId: { type: mongoose.Schema.Types.ObjectId, ref: 'Year', required: true },
  semesterNumber: { type: Number, required: true, min: 1, max: 8 }
}, {
  timestamps: true
});

semesterSchema.index({ institutionId: 1, yearId: 1, semesterNumber: 1 }, { unique: true });

module.exports = mongoose.model('Semester', semesterSchema);
