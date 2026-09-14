const mongoose = require('mongoose');
const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const FeeStructure = require('../models/FeeStructure.model');
const Payment = require('../models/Payment.model');
const feesService = require('../services/fees.service');

// POST /fee-structures
exports.createFeeStructure = async (req, res) => {
  try {
    const { departmentId, year, studentGroup, totalAmount, installments } = req.body;
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId || req.body.institutionId;

    const feeStructure = new FeeStructure({
      departmentId,
      year,
      studentGroup: (studentGroup || 'general').trim().toLowerCase(),
      totalAmount,
      installments,
      ...(tenantId ? { institutionId: tenantId } : {})
    });
    await feeStructure.save();
    res.status(201).json({ success: true, data: feeStructure });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.listFeeStructures = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const { departmentId, year, studentGroup, feeGroup } = req.query;
    const filter = {};
    if (departmentId) filter.departmentId = departmentId;
    if (year) filter.year = year;
    const group = studentGroup || feeGroup;
    if (group) filter.studentGroup = group.trim().toLowerCase();
    if (tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      filter.institutionId = tenantId;
    }

    const feeStructures = await FeeStructure.find(filter);
    res.status(200).json({ success: true, data: feeStructures });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getFeeStructureById = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const filter = { _id: req.params.id };
    if (tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      filter.institutionId = tenantId;
    }

    const feeStructure = await FeeStructure.findOne(filter);
    if (!feeStructure) {
      return res.status(404).json({ success: false, message: 'Fee structure not found' });
    }

    res.status(200).json({ success: true, data: feeStructure });
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
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const { departmentId, year, feeGroup, studentGroup } = req.query;
    const targetGroup = feeGroup || studentGroup;

    const scopedTenantId = (!req.user?.roles?.includes('SUPERADMIN')) ? tenantId : null;
    const defaulters = await feesService.getDefaulters(departmentId, year, targetGroup, scopedTenantId);
    res.status(200).json({ success: true, data: defaulters });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /payments/:id/receipt
exports.getReceipt = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const filter = { _id: req.params.id };
    if (tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      filter.institutionId = tenantId;
    }

    const payment = await Payment.findOne(filter).populate('feeStructureId');
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
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const roleQuery = {
      userId: new mongoose.Types.ObjectId(req.user.id),
      role: 'STUDENT'
    };
    if (tenantId && !req.user?.roles?.includes('SUPERADMIN') && mongoose.Types.ObjectId.isValid(tenantId)) {
      roleQuery.institutionId = new mongoose.Types.ObjectId(tenantId);
    }

    const roleAssignment = await mongoose.connection.collection('roleassignments').findOne(roleQuery);

    if (!roleAssignment) {
      return res.status(404).json({ success: false, message: 'Student role not found' });
    }

    const secQuery = { _id: roleAssignment.sectionId };
    if (tenantId && !req.user?.roles?.includes('SUPERADMIN') && mongoose.Types.ObjectId.isValid(tenantId)) {
      secQuery.institutionId = new mongoose.Types.ObjectId(tenantId);
    }
    const section = await mongoose.connection.collection('sections').findOne(secQuery);
    if (!section) return res.status(404).json({ success: false, message: 'Section not found' });

    const semQuery = { _id: section.semesterId };
    if (tenantId && !req.user?.roles?.includes('SUPERADMIN') && mongoose.Types.ObjectId.isValid(tenantId)) {
      semQuery.institutionId = new mongoose.Types.ObjectId(tenantId);
    }
    const semester = await mongoose.connection.collection('semesters').findOne(semQuery);
    if (!semester) return res.status(404).json({ success: false, message: 'Semester not found' });

    const yrQuery = { _id: semester.yearId };
    if (tenantId && !req.user?.roles?.includes('SUPERADMIN') && mongoose.Types.ObjectId.isValid(tenantId)) {
      yrQuery.institutionId = new mongoose.Types.ObjectId(tenantId);
    }
    const yearDoc = await mongoose.connection.collection('years').findOne(yrQuery);
    if (!yearDoc) return res.status(404).json({ success: false, message: 'Year not found' });

    const studentUserId = req.user.id || req.user.userId;
    const userDoc = await mongoose.connection.collection('users').findOne({
      _id: new mongoose.Types.ObjectId(studentUserId)
    });
    const studentFeeGroup = (userDoc?.feeGroup || req.user?.feeGroup || 'general').trim().toLowerCase();

    const feeQuery = {
      departmentId: roleAssignment.departmentId,
      year: yearDoc.yearNumber,
      studentGroup: studentFeeGroup
    };
    if (tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      feeQuery.institutionId = tenantId;
    }

    let feeStructure = await FeeStructure.findOne(feeQuery);
    if (!feeStructure && studentFeeGroup !== 'general') {
      feeQuery.studentGroup = 'general';
      feeStructure = await FeeStructure.findOne(feeQuery);
    }

    if (!feeStructure) {
      return res.json({ success: true, data: { pendingAmount: 0, installments: [] } });
    }

    const payQuery = {
      studentId: new mongoose.Types.ObjectId(studentUserId),
      feeStructureId: feeStructure._id
    };
    if (tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      payQuery.institutionId = tenantId;
    }

    const payments = await Payment.find(payQuery);

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
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const { feeStructureId, installmentIndex, amount } = req.body;
    
    // Create or find pending payment
    const payQuery = {
      studentId: req.user.id,
      feeStructureId,
      installmentIndex,
      status: 'pending'
    };
    if (tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      payQuery.institutionId = tenantId;
    }

    let payment = await Payment.findOne(payQuery);

    if (!payment) {
      payment = new Payment({
        studentId: req.user.id,
        feeStructureId,
        installmentIndex,
        amount,
        status: 'pending',
        ...(tenantId ? { institutionId: tenantId } : {})
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

// GET /collection-summary
exports.getCollectionSummary = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const filter = { status: 'paid' };
    if (tenantId && !req.user?.roles?.includes('SUPERADMIN') && mongoose.Types.ObjectId.isValid(tenantId)) {
      filter.institutionId = new mongoose.Types.ObjectId(tenantId);
    }

    const totalAgg = await Payment.aggregate([
      { $match: filter },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]);

    const totalAmount = totalAgg[0]?.total || 0;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const trend = await Payment.aggregate([
      { $match: { ...filter, paidAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$paidAt" } },
          value: { $sum: "$amount" },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, date: "$_id", value: 1, count: 1 } }
    ]);

    // Segmented Collection by studentGroup
    const collectionByGroupAgg = await Payment.aggregate([
      { $match: filter },
      {
        $lookup: {
          from: 'feestructures',
          localField: 'feeStructureId',
          foreignField: '_id',
          as: 'feeStruct'
        }
      },
      { $unwind: { path: '$feeStruct', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'users',
          localField: 'studentId',
          foreignField: '_id',
          as: 'studentDoc'
        }
      },
      { $unwind: { path: '$studentDoc', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          group: {
            $toLower: {
              $ifNull: ['$feeStruct.studentGroup', { $ifNull: ['$studentDoc.feeGroup', 'general'] }]
            }
          }
        }
      },
      {
        $group: {
          _id: '$group',
          collectedAmount: { $sum: '$amount' },
          transactionsCount: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          studentGroup: '$_id',
          collectedAmount: 1,
          transactionsCount: 1
        }
      }
    ]);

    // Segmented Defaulters by studentGroup
    const scopedTenantId = (!req.user?.roles?.includes('SUPERADMIN')) ? tenantId : null;
    const allDefaulters = await feesService.getDefaulters(null, null, null, scopedTenantId);
    const defaultersByGroupMap = new Map();
    allDefaulters.forEach(d => {
      const grp = (d.feeGroup || 'general').toLowerCase();
      if (!defaultersByGroupMap.has(grp)) {
        defaultersByGroupMap.set(grp, { studentGroup: grp, defaultersCount: 0, overdueAmount: 0 });
      }
      const entry = defaultersByGroupMap.get(grp);
      entry.defaultersCount++;
      const overdue = (d.overdueInstallments || []).reduce((sum, i) => sum + (i.amount || 0), 0);
      entry.overdueAmount += overdue;
    });

    const defaultersByGroup = Array.from(defaultersByGroupMap.values());

    // Side-by-side merged segmentation by group
    const allGroups = new Set([
      ...collectionByGroupAgg.map(c => c.studentGroup),
      ...defaultersByGroup.map(d => d.studentGroup)
    ]);
    if (allGroups.size === 0) allGroups.add('general');

    const byGroup = Array.from(allGroups).map(grp => {
      const col = collectionByGroupAgg.find(c => c.studentGroup === grp);
      const def = defaultersByGroup.find(d => d.studentGroup === grp);
      return {
        studentGroup: grp,
        collectedAmount: col ? col.collectedAmount : 0,
        transactionsCount: col ? col.transactionsCount : 0,
        defaultersCount: def ? def.defaultersCount : 0,
        overdueAmount: def ? def.overdueAmount : 0
      };
    });

    res.status(200).json({
      success: true,
      data: {
        total: totalAmount,
        byGroup,
        collectionByGroup: collectionByGroupAgg,
        defaultersByGroup,
        totalDefaulters: allDefaulters.length,
        totalOverdueAmount: defaultersByGroup.reduce((sum, d) => sum + d.overdueAmount, 0),
        trend: trend || []
      }
    });
  } catch (error) {
    console.error('Failed to get collection summary:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /reports/collection-trend
exports.getCollectionTrend = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const filter = { status: 'paid' };
    if (tenantId && !req.user?.roles?.includes('SUPERADMIN') && mongoose.Types.ObjectId.isValid(tenantId)) {
      filter.institutionId = new mongoose.Types.ObjectId(tenantId);
    }

    const trend = await Payment.aggregate([
      { $match: filter },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$paidAt" } },
          value: { $sum: "$amount" },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, date: "$_id", value: 1, count: 1 } }
    ]);

    res.status(200).json({ success: true, data: trend || [] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
