const mongoose = require('mongoose');
const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const FeeStructure = require('../models/FeeStructure.model');
const Payment = require('../models/Payment.model');

// POST /fee-structures
exports.createFeeStructure = async (req, res) => {
  try {
    const { departmentId, year, totalAmount, installments } = req.body;
    const feeStructure = new FeeStructure({
      departmentId,
      year,
      totalAmount,
      installments
    });
    await feeStructure.save();
    res.status(201).json({ success: true, data: feeStructure });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /payments/webhook
exports.paymentWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-signature'] || req.headers['x-webhook-signature'];
    const gatewaySecret = process.env.GATEWAY_SECRET || 'secret';
    
    if (!signature) {
      return res.status(400).json({ success: false, message: 'Missing signature' });
    }

    // Verify signature
    const payloadString = JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', gatewaySecret)
      .update(payloadString)
      .digest('hex');

    if (signature !== expectedSignature) {
      return res.status(400).json({ success: false, message: 'Invalid signature' });
    }

    const { paymentId, status, gatewayRef } = req.body;

    if (!paymentId || status !== 'paid') {
      return res.status(200).json({ success: true, message: 'Ignored or missing paymentId' });
    }

    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    // Idempotent operation
    if (payment.status === 'paid') {
      return res.status(200).json({ success: true, message: 'Already paid' });
    }

    payment.status = 'paid';
    payment.gatewayRef = gatewayRef || payment.gatewayRef;
    payment.paidAt = new Date();
    
    await payment.save();

    res.status(200).json({ success: true, message: 'Payment updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /defaulters
exports.getDefaulters = async (req, res) => {
  try {
    const { departmentId, year } = req.query;
    
    const matchObj = {};
    if (departmentId) matchObj['roleAssignment.departmentId'] = new mongoose.Types.ObjectId(departmentId);
    if (year) matchObj['yearDoc.yearNumber'] = Number(year);

    const pipeline = [
      { $match: { role: 'STUDENT' } },
      
      { $lookup: {
          from: 'sections',
          localField: 'sectionId',
          foreignField: '_id',
          as: 'section'
      }},
      { $unwind: '$section' },
      
      { $lookup: {
          from: 'semesters',
          localField: 'section.semesterId',
          foreignField: '_id',
          as: 'semester'
      }},
      { $unwind: '$semester' },
      
      { $lookup: {
          from: 'years',
          localField: 'semester.yearId',
          foreignField: '_id',
          as: 'yearDoc'
      }},
      { $unwind: '$yearDoc' },

      { $match: {
        ...(departmentId ? { departmentId: new mongoose.Types.ObjectId(departmentId) } : {}),
        ...(year ? { 'yearDoc.yearNumber': Number(year) } : {})
      }},

      { $lookup: {
          from: 'feestructures',
          let: { deptId: '$departmentId', yearNum: '$yearDoc.yearNumber' },
          pipeline: [
            { $match: {
                $expr: {
                  $and: [
                    { $eq: ['$departmentId', '$$deptId'] },
                    { $eq: ['$year', '$$yearNum'] }
                  ]
                }
            }}
          ],
          as: 'feeStructure'
      }},
      { $unwind: '$feeStructure' },
      
      { $unwind: { path: '$feeStructure.installments', includeArrayIndex: 'installmentIndex' } },
      
      { $match: { 'feeStructure.installments.dueDate': { $lt: new Date() } } },
      
      { $lookup: {
          from: 'payments',
          let: { 
            studentId: '$userId', 
            feeStructId: '$feeStructure._id', 
            instIndex: '$installmentIndex' 
          },
          pipeline: [
            { $match: {
                $expr: {
                  $and: [
                    { $eq: ['$studentId', '$$studentId'] },
                    { $eq: ['$feeStructureId', '$$feeStructId'] },
                    { $eq: ['$installmentIndex', '$$instIndex'] },
                    { $eq: ['$status', 'paid'] }
                  ]
                }
            }}
          ],
          as: 'paidPayments'
      }},
      
      { $match: { paidPayments: { $size: 0 } } },
      
      { $group: {
          _id: '$userId',
          departmentId: { $first: '$departmentId' },
          yearNumber: { $first: '$yearDoc.yearNumber' },
          overdueInstallments: {
            $push: {
              feeStructureId: '$feeStructure._id',
              installmentIndex: '$installmentIndex',
              amount: '$feeStructure.installments.amount',
              dueDate: '$feeStructure.installments.dueDate'
            }
          }
      }}
    ];

    const defaulters = await mongoose.connection.collection('roleassignments').aggregate(pipeline).toArray();
    res.status(200).json({ success: true, data: defaulters });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /payments/:id/receipt
exports.getReceipt = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id).populate('feeStructureId');
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    if (payment.status !== 'paid') {
      return res.status(400).json({ success: false, message: 'Cannot generate receipt for unpaid payment' });
    }

    // Generate PDF
    const doc = new PDFDocument();
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=receipt-${payment._id}.pdf`);
    
    doc.pipe(res);
    
    doc.fontSize(25).text('Payment Receipt', { align: 'center' });
    doc.moveDown();
    
    doc.fontSize(14).text(`Receipt ID: ${payment._id}`);
    doc.text(`Student ID: ${payment.studentId}`);
    doc.text(`Fee Structure ID: ${payment.feeStructureId ? payment.feeStructureId._id : 'N/A'}`);
    doc.text(`Installment Index: ${payment.installmentIndex}`);
    doc.text(`Amount: $${payment.amount}`);
    doc.text(`Status: ${payment.status}`);
    doc.text(`Paid At: ${payment.paidAt}`);
    if (payment.gatewayRef) {
      doc.text(`Gateway Reference: ${payment.gatewayRef}`);
    }
    
    doc.end();

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /students/me/status
exports.getOwnFeeStatus = async (req, res) => {
  try {
    const roleAssignment = await mongoose.connection.collection('roleassignments').findOne({
      userId: new mongoose.Types.ObjectId(req.user.id),
      role: 'STUDENT'
    });

    if (!roleAssignment) {
      return res.status(404).json({ success: false, message: 'Student role not found' });
    }

    const section = await mongoose.connection.collection('sections').findOne({ _id: roleAssignment.sectionId });
    if (!section) return res.status(404).json({ success: false, message: 'Section not found' });

    const semester = await mongoose.connection.collection('semesters').findOne({ _id: section.semesterId });
    if (!semester) return res.status(404).json({ success: false, message: 'Semester not found' });

    const yearDoc = await mongoose.connection.collection('years').findOne({ _id: semester.yearId });
    if (!yearDoc) return res.status(404).json({ success: false, message: 'Year not found' });

    const feeStructure = await FeeStructure.findOne({
      departmentId: roleAssignment.departmentId,
      year: yearDoc.yearNumber
    });

    if (!feeStructure) {
      return res.json({ success: true, data: { pendingAmount: 0, installments: [] } });
    }

    const payments = await Payment.find({
      studentId: req.user.id,
      feeStructureId: feeStructure._id
    });

    const installments = feeStructure.installments.map((inst, index) => {
      const payment = payments.find(p => p.installmentIndex === index);
      let status = 'pending';
      let paymentId = payment ? payment._id : null;
      
      if (payment && payment.status === 'paid') {
        status = 'paid';
      } else if (new Date(inst.dueDate) < new Date()) {
        status = 'overdue';
      }

      return {
        ...inst.toObject(),
        index,
        status,
        paymentId,
        paidAt: payment ? payment.paidAt : null,
      };
    });

    const pendingAmount = installments.filter(i => i.status !== 'paid').reduce((sum, i) => sum + i.amount, 0);

    res.json({ 
      success: true, 
      data: { 
        feeStructureId: feeStructure._id, 
        totalAmount: feeStructure.totalAmount, 
        pendingAmount, 
        installments 
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /payments/initiate
exports.initiatePayment = async (req, res) => {
  try {
    const { feeStructureId, installmentIndex, amount } = req.body;
    
    // Create or find pending payment
    let payment = await Payment.findOne({
      studentId: req.user.id,
      feeStructureId,
      installmentIndex,
      status: 'pending'
    });

    if (!payment) {
      payment = new Payment({
        studentId: req.user.id,
        feeStructureId,
        installmentIndex,
        amount,
        status: 'pending'
      });
      await payment.save();
    }

    const redirectUrl = `/mock-gateway/checkout?paymentId=${payment._id}`;

    // Simulate webhook firing after 3 seconds
    setTimeout(async () => {
      try {
        const p = await Payment.findById(payment._id);
        if (p && p.status !== 'paid') {
          p.status = 'paid';
          p.gatewayRef = 'mock-txn-' + Math.floor(Math.random() * 1000000);
          p.paidAt = new Date();
          await p.save();
        }
      } catch (err) {
        console.error('Mock webhook failed:', err);
      }
    }, 3000);

    res.status(200).json({ success: true, data: { paymentId: payment._id, redirectUrl } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
