const mongoose = require('mongoose');

const feeStructureSchema = new mongoose.Schema({
  departmentId: { type: mongoose.Schema.Types.ObjectId, required: true },
  year: { type: Number, required: true }, // representing the academic year number (1, 2, 3, 4)
  totalAmount: { type: Number, required: true },
  installments: [{
    label: { type: String, required: true },
    amount: { type: Number, required: true },
    dueDate: { type: Date, required: true }
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('FeeStructure', feeStructureSchema);
