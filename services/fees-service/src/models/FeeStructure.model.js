const mongoose = require('mongoose');

const feeStructureSchema = new mongoose.Schema({
  institutionId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Institution', 
    required: true, 
    index: true 
  },
  departmentId: { type: mongoose.Schema.Types.ObjectId, required: true },
  year: { type: Number, required: true },
  totalAmount: { type: Number, required: true },
  installments: [{
    label: { type: String, required: true },
    amount: { type: Number, required: true },
    dueDate: { type: Date, required: true }
  }]
}, {
  timestamps: true
});

feeStructureSchema.index({ institutionId: 1, departmentId: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('FeeStructure', feeStructureSchema);
