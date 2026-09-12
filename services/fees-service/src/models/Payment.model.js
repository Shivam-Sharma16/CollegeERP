const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  institutionId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Institution', 
    required: true, 
    index: true 
  },
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

paymentSchema.index({ institutionId: 1, studentId: 1, feeStructureId: 1, installmentIndex: 1 });
paymentSchema.index({ institutionId: 1, studentId: 1, feeStructureId: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
