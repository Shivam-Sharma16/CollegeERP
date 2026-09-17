const mongoose = require('mongoose');

const batchSchema = new mongoose.Schema({
  institutionId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Institution', 
    required: true, 
    index: true 
  },
  sectionId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Section', 
    required: true, 
    index: true 
  },
  name: { 
    type: String, 
    required: true 
  },
  studentIds: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }]
}, {
  timestamps: true
});

batchSchema.index({ institutionId: 1, sectionId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Batch', batchSchema);
