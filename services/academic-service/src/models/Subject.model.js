const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
  institutionId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Institution', 
    required: true, 
    index: true 
  },
  departmentId: { type: mongoose.Schema.Types.ObjectId, required: true },
  name: { type: String, required: true },
  code: { type: String, required: true },
  credits: { type: Number, required: true, min: 1 },
  type: { 
    type: String, 
    enum: ['lecture', 'lab'], 
    default: 'lecture', 
    required: true 
  }
}, {
  timestamps: true
});

subjectSchema.index({ institutionId: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('Subject', subjectSchema);
