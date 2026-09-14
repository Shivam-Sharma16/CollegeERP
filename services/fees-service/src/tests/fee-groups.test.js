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

describe('Phase 78: Fee Structure With Student Groups Tests', () => {
  let mongoServer;
  let app;

  const tenantId = new mongoose.Types.ObjectId();
  const deptId = new mongoose.Types.ObjectId();
  const yearNumber = 2;

  let studentTfwsId = new mongoose.Types.ObjectId();
  let studentGeneralId = new mongoose.Types.ObjectId();

  let tfwsFeeStructure;
  let generalFeeStructure;

  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - 5); // 5 days ago (overdue)

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    app = express();
    app.use(express.json());

    // Middleware simulating authentication & tenant resolution
    app.use((req, res, next) => {
      const authHeader = req.headers.authorization;
      if (authHeader === 'Bearer ADMIN_TOKEN') {
        req.user = { id: new mongoose.Types.ObjectId().toString(), roles: ['ADMIN'], institutionId: tenantId };
        req.tenantId = tenantId.toString();
      } else if (authHeader === 'Bearer TFWS_STUDENT_TOKEN') {
        req.user = { id: studentTfwsId.toString(), roles: ['STUDENT'], feeGroup: 'tfws', institutionId: tenantId };
        req.tenantId = tenantId.toString();
      } else if (authHeader === 'Bearer GENERAL_STUDENT_TOKEN') {
        req.user = { id: studentGeneralId.toString(), roles: ['STUDENT'], feeGroup: 'general', institutionId: tenantId };
        req.tenantId = tenantId.toString();
      }
      next();
    });

    app.use('/api/fees', feesRoutes);

    // Setup Academic Hierarchy in DB
    const yearObj = await mongoose.connection.collection('years').insertOne({
      departmentId: deptId,
      yearNumber: yearNumber,
      institutionId: tenantId
    });

    const semObj = await mongoose.connection.collection('semesters').insertOne({
      departmentId: deptId,
      yearId: yearObj.insertedId,
      semesterNumber: 3,
      institutionId: tenantId
    });

    const secObj = await mongoose.connection.collection('sections').insertOne({
      semesterId: semObj.insertedId,
      name: 'CSE-A',
      institutionId: tenantId
    });

    // Seed Users in 'users' collection with their respective feeGroups
    await mongoose.connection.collection('users').insertMany([
      {
        _id: studentTfwsId,
        name: 'TFWS Scholar Student',
        email: 'tfws@college.edu',
        feeGroup: 'tfws',
        institutionId: tenantId
      },
      {
        _id: studentGeneralId,
        name: 'General Category Student',
        email: 'general@college.edu',
        feeGroup: 'general',
        institutionId: tenantId
      }
    ]);

    // Seed RoleAssignments for both students in the same department and section
    await mongoose.connection.collection('roleassignments').insertMany([
      {
        userId: studentTfwsId,
        role: 'STUDENT',
        departmentId: deptId,
        sectionId: secObj.insertedId,
        institutionId: tenantId,
        validFrom: new Date('2025-01-01')
      },
      {
        userId: studentGeneralId,
        role: 'STUDENT',
        departmentId: deptId,
        sectionId: secObj.insertedId,
        institutionId: tenantId,
        validFrom: new Date('2025-01-01')
      }
    ]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  beforeEach(async () => {
    await FeeStructure.deleteMany({});
    await Payment.deleteMany({});

    // Create TFWS FeeStructure (5,000 total)
    tfwsFeeStructure = await FeeStructure.create({
      institutionId: tenantId,
      departmentId: deptId,
      year: yearNumber,
      studentGroup: 'tfws',
      totalAmount: 5000,
      installments: [
        { label: 'Term 1 Subsidized', amount: 5000, dueDate: pastDate }
      ]
    });

    // Create General FeeStructure (50,000 total) in the EXACT same department and year
    generalFeeStructure = await FeeStructure.create({
      institutionId: tenantId,
      departmentId: deptId,
      year: yearNumber,
      studentGroup: 'general',
      totalAmount: 50000,
      installments: [
        { label: 'Term 1 Full Tuition', amount: 50000, dueDate: pastDate }
      ]
    });
  });

  describe('1. FeeStructure Creation & Compound Indexing', () => {
    it('allows creating separate fee structures for the same department and year with different studentGroups', async () => {
      const res = await request(app)
        .get(`/api/fees/fee-structures?departmentId=${deptId}&year=${yearNumber}`)
        .set('Authorization', 'Bearer ADMIN_TOKEN');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(2);

      const groups = res.body.data.map(f => f.studentGroup);
      expect(groups).toContain('tfws');
      expect(groups).toContain('general');
    });

    it('rejects duplicate fee structure for the SAME department, year, and studentGroup', async () => {
      const res = await request(app)
        .post('/api/fees/fee-structures')
        .set('Authorization', 'Bearer ADMIN_TOKEN')
        .send({
          departmentId: deptId,
          year: yearNumber,
          studentGroup: 'tfws',
          totalAmount: 6000,
          installments: [{ label: 'Duplicate', amount: 6000, dueDate: new Date() }]
        });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/duplicate key/i);
    });
  });

  describe('2. Dual Billing Resolution per Student Group', () => {
    it('correctly bills TFWS student 5,000 and General student 50,000 in the same department+year', async () => {
      // TFWS student fee status
      const resTfws = await request(app)
        .get('/api/fees/students/me/status')
        .set('Authorization', 'Bearer TFWS_STUDENT_TOKEN');

      expect(resTfws.status).toBe(200);
      expect(resTfws.body.success).toBe(true);
      expect(resTfws.body.data.feeStructureId.toString()).toBe(tfwsFeeStructure._id.toString());
      expect(resTfws.body.data.totalAmount).toBe(5000);
      expect(resTfws.body.data.pendingAmount).toBe(5000);

      // General student fee status
      const resGeneral = await request(app)
        .get('/api/fees/students/me/status')
        .set('Authorization', 'Bearer GENERAL_STUDENT_TOKEN');

      expect(resGeneral.status).toBe(200);
      expect(resGeneral.body.success).toBe(true);
      expect(resGeneral.body.data.feeStructureId.toString()).toBe(generalFeeStructure._id.toString());
      expect(resGeneral.body.data.totalAmount).toBe(50000);
      expect(resGeneral.body.data.pendingAmount).toBe(50000);
    });
  });

  describe('3. Defaulter Reporting with Group Filtering', () => {
    beforeEach(async () => {
      // General student pays their 50,000 installment
      await Payment.create({
        institutionId: tenantId,
        studentId: studentGeneralId,
        feeStructureId: generalFeeStructure._id,
        installmentIndex: 0,
        amount: 50000,
        status: 'paid',
        paidAt: new Date()
      });
      // TFWS student does NOT pay (remains overdue)
    });

    it('returns TFWS student as defaulter and excludes General student who paid', async () => {
      const res = await request(app)
        .get('/api/fees/defaulters')
        .set('Authorization', 'Bearer ADMIN_TOKEN');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);

      const defaulter = res.body.data[0];
      expect(defaulter._id.toString()).toBe(studentTfwsId.toString());
      expect(defaulter.feeGroup).toBe('tfws');
      expect(defaulter.overdueInstallments[0].amount).toBe(5000);
    });

    it('filters defaulters by feeGroup=tfws and includes TFWS student', async () => {
      const res = await request(app)
        .get('/api/fees/defaulters?feeGroup=tfws')
        .set('Authorization', 'Bearer ADMIN_TOKEN');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0]._id.toString()).toBe(studentTfwsId.toString());
      expect(res.body.data[0].feeGroup).toBe('tfws');
    });

    it('excludes TFWS student when filtering by feeGroup=general (returns 0 defaulters)', async () => {
      const res = await request(app)
        .get('/api/fees/defaulters?feeGroup=general')
        .set('Authorization', 'Bearer ADMIN_TOKEN');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // General student paid, so 0 defaulters in general group
      expect(res.body.data.length).toBe(0);
    });
  });

  describe('4. Admin Fee Dashboard Segmented by Group Side-by-Side', () => {
    beforeEach(async () => {
      // General student paid 50,000
      await Payment.create({
        institutionId: tenantId,
        studentId: studentGeneralId,
        feeStructureId: generalFeeStructure._id,
        installmentIndex: 0,
        amount: 50000,
        status: 'paid',
        paidAt: new Date()
      });
      // TFWS student remains defaulter for 5,000
    });

    it('returns collection and defaulter metrics segmented by student group side-by-side', async () => {
      const res = await request(app)
        .get('/api/fees/collection-summary')
        .set('Authorization', 'Bearer ADMIN_TOKEN');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const { total, byGroup, collectionByGroup, defaultersByGroup } = res.body.data;

      // Overall total collected
      expect(total).toBe(50000);

      // Collections segmented by group
      expect(collectionByGroup).toBeInstanceOf(Array);
      const generalCollection = collectionByGroup.find(c => c.studentGroup === 'general');
      expect(generalCollection).toBeDefined();
      expect(generalCollection.collectedAmount).toBe(50000);
      expect(generalCollection.transactionsCount).toBe(1);

      // Defaulters segmented by group
      expect(defaultersByGroup).toBeInstanceOf(Array);
      const tfwsDefaulters = defaultersByGroup.find(d => d.studentGroup === 'tfws');
      expect(tfwsDefaulters).toBeDefined();
      expect(tfwsDefaulters.defaultersCount).toBe(1);
      expect(tfwsDefaulters.overdueAmount).toBe(5000);

      // Side-by-side merged breakdown
      expect(byGroup).toBeInstanceOf(Array);
      const generalRow = byGroup.find(g => g.studentGroup === 'general');
      const tfwsRow = byGroup.find(g => g.studentGroup === 'tfws');

      expect(generalRow).toBeDefined();
      expect(generalRow.collectedAmount).toBe(50000);
      expect(generalRow.defaultersCount).toBe(0);

      expect(tfwsRow).toBeDefined();
      expect(tfwsRow.collectedAmount).toBe(0);
      expect(tfwsRow.defaultersCount).toBe(1);
      expect(tfwsRow.overdueAmount).toBe(5000);
    });
  });
});
