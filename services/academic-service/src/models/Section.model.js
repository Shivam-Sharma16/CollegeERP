const mongoose = require('mongoose');

const sectionSchema = new mongoose.Schema({
  semesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Semester', required: true },
  name: { type: String, required: true },
  carriesForwardFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', default: null }
}, {
  timestamps: true
});

module.exports = mongoose.model('Section', sectionSchema);
