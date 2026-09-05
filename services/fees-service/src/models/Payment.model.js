const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, required: true },
  feeStructureId: { type: mongoose.Schema.Types.ObjectId, ref: 'FeeStructure', required: true },
  installmentIndex: { type: Number, required: true },
  amount: { type: Number, required: true },
  status: { 
    type: String, 
    enum: ['pending', 'paid', 'failed'], 
    default: 'pending' 
  },
  gatewayRef: { type: String },
  paidAt: { type: Date }
}, {
  timestamps: true
});

// Index for high performance aggregation checks
paymentSchema.index({ studentId: 1, feeStructureId: 1, installmentIndex: 1, status: 1 });
paymentSchema.index({ studentId: 1, feeStructureId: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
