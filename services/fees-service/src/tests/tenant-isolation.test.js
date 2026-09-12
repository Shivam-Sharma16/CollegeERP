const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

jest.mock('@college-erp/shared-utils', () => ({
  authenticate: (req, res, next) => next(),
  requirePermission: () => (req, res, next) => next(),
  success: (data) => ({ success: true, data }),
  fail: (error) => ({ success: false, error }),
  logAudit: jest.fn().mockResolvedValue()
}));

const feesRoutes = require('../routes/fees.route');
const FeeStructure = require('../models/FeeStructure.model');
const Payment = require('../models/Payment.model');

describe('Phase 68: Fees Service Tenant Isolation Tests', () => {
  let mongoServer;
  let app;
  const tenantAId = new mongoose.Types.ObjectId();
  const tenantBId = new mongoose.Types.ObjectId();

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    app = express();
    app.use(express.json());

    app.use((req, res, next) => {
      const authHeader = req.headers.authorization;
      if (authHeader === 'Bearer TENANT_A_ADMIN') {
        req.user = { userId: new mongoose.Types.ObjectId().toString(), roles: ['ADMIN'], institutionId: tenantAId };
        req.tenantId = tenantAId.toString();
      } else if (authHeader === 'Bearer TENANT_B_ADMIN') {
        req.user = { userId: new mongoose.Types.ObjectId().toString(), roles: ['ADMIN'], institutionId: tenantBId };
        req.tenantId = tenantBId.toString();
      }
      next();
    });

    app.use('/api/fees', feesRoutes);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  let feeA, feeB, paymentA, paymentB;

  beforeEach(async () => {
    await FeeStructure.deleteMany({});
    await Payment.deleteMany({});

    const deptA = new mongoose.Types.ObjectId();
    const deptB = new mongoose.Types.ObjectId();

    feeA = await FeeStructure.create({
      departmentId: deptA,
      year: 1,
      totalAmount: 50000,
      installments: [{ label: 'Term 1', amount: 50000, dueDate: new Date() }],
      institutionId: tenantAId,
    });

    feeB = await FeeStructure.create({
      departmentId: deptB,
      year: 1,
      totalAmount: 50000,
      installments: [{ label: 'Term 1', amount: 50000, dueDate: new Date() }],
      institutionId: tenantBId,
    });

    paymentA = await Payment.create({
      studentId: new mongoose.Types.ObjectId(),
      feeStructureId: feeA._id,
      installmentIndex: 0,
      amount: 50000,
      status: 'paid',
      institutionId: tenantAId,
    });

    paymentB = await Payment.create({
      studentId: new mongoose.Types.ObjectId(),
      feeStructureId: feeB._id,
      installmentIndex: 0,
      amount: 50000,
      status: 'paid',
      institutionId: tenantBId,
    });
  });

  test('Tenant A cannot read Tenant B fee structure by ID (returns 404)', async () => {
    const res = await request(app)
      .get(`/api/fees/fee-structures/${feeB._id}`)
      .set('Authorization', 'Bearer TENANT_A_ADMIN');

    expect(res.status).toBe(404);
  });

  test('Tenant A listing fee structures only returns Tenant A fee structures', async () => {
    const res = await request(app)
      .get('/api/fees/fee-structures')
      .set('Authorization', 'Bearer TENANT_A_ADMIN');

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0]._id.toString()).toBe(feeA._id.toString());
  });

  test('Tenant A cannot read Tenant B payment receipt (returns 404)', async () => {
    const res = await request(app)
      .get(`/api/fees/payments/${paymentB._id}/receipt`)
      .set('Authorization', 'Bearer TENANT_A_ADMIN');

    expect(res.status).toBe(404);
  });
});
