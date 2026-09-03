const mongoose = require('mongoose');

const yearSchema = new mongoose.Schema({
  departmentId: { type: mongoose.Schema.Types.ObjectId, required: true },
  yearNumber: { type: Number, required: true, min: 1, max: 4 }
}, {
  timestamps: true
});

module.exports = mongoose.model('Year', yearSchema);
