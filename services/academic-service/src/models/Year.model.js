const mongoose = require('mongoose');

const yearSchema = new mongoose.Schema({
  institutionId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Institution', 
    required: true, 
    index: true 
  },
  departmentId: { type: mongoose.Schema.Types.ObjectId, required: true },
  yearNumber: { type: Number, required: true, min: 1, max: 4 }
}, {
  timestamps: true
});

yearSchema.index({ institutionId: 1, departmentId: 1, yearNumber: 1 }, { unique: true });

module.exports = mongoose.model('Year', yearSchema);
