const mongoose = require('mongoose');

const sectionSchema = new mongoose.Schema({
  institutionId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Institution', 
    required: true, 
    index: true 
  },
  semesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Semester', required: true },
  name: { type: String, required: true },
  carriesForwardFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', default: null }
}, {
  timestamps: true
});

sectionSchema.index({ institutionId: 1, semesterId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Section', sectionSchema);
