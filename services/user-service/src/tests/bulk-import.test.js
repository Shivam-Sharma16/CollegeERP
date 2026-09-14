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

jest.setTimeout(30000);

const userRoutes = require('../routes/user.route');
const User = require('../models/User.model');
const RoleAssignment = require('../models/RoleAssignment.model');
const Department = require('../models/Department.model');

let mongoServer;
const app = express();
app.use(express.text({ type: ['text/csv', 'text/plain'] }));
app.use(express.json());

const testInstId = new mongoose.Types.ObjectId();

app.use((req, res, next) => {
  if (req.headers.authorization) {
    const role = req.headers.authorization.split(' ')[1];
    req.user = {
      userId: new mongoose.Types.ObjectId().toString(),
      roles: [role],
      institutionId: testInstId
    };
    req.tenantId = testInstId;
  }
  next();
});

app.use('/users', userRoutes);
app.use('/api/users', userRoutes);

describe('PHASE 79 — Bulk User Import', () => {
  let testDept;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    testDept = await Department.create({
      name: 'Computer Science and Engineering',
      code: 'CSE',
      institutionId: testInstId
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await RoleAssignment.deleteMany({});
  });

  it('imports N-1 valid rows successfully when 1 row is intentionally malformed (missing email)', async () => {
    // 4 rows: 3 valid, 1 malformed (row 3 has missing email)
    const csvData = [
      'name,email,role,rollNumber,departmentId,feeGroup',
      `Alice Smith,alice@example.com,STUDENT,CS101,${testDept._id},general`,
      `Bob Jones,bob@example.com,STUDENT,CS102,${testDept._id},tfws`,
      `Charlie Brown,,STUDENT,CS103,${testDept._id},general`, // Missing email!
      `Dr. Diane,diane@example.com,FACULTY,,${testDept._id},general`
    ].join('\n');

    const res = await request(app)
      .post('/users/bulk-import')
      .set('Authorization', 'Bearer ADMIN')
      .send({ csv: csvData });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    expect(data.totalRows).toBe(4);
    expect(data.importedCount).toBe(3); // 4 - 1 = 3 succeeded
    expect(data.failedCount).toBe(1);   // 1 failed

    // Verify the specific failed row and reason
    expect(data.failed).toHaveLength(1);
    expect(data.failed[0].row).toBe(4); // 4th line in CSV file (header is line 1, Charlie is line 4)
    expect(data.failed[0].error).toMatch(/Email is required/i);

    // Verify the successful users were created in DB
    expect(data.successful).toHaveLength(3);
    const alice = await User.findOne({ email: 'alice@example.com' });
    expect(alice).not.toBeNull();
    expect(alice.name).toBe('Alice Smith');
    expect(alice.rollNumber).toBe('CS101');
    expect(alice.feeGroup).toBe('general');

    const bob = await User.findOne({ email: 'bob@example.com' });
    expect(bob).not.toBeNull();
    expect(bob.feeGroup).toBe('tfws');

    const diane = await User.findOne({ email: 'diane@example.com' });
    expect(diane).not.toBeNull();

    // Verify Charlie was not created
    const charlie = await User.findOne({ name: 'Charlie Brown' });
    expect(charlie).toBeNull();

    // Verify role assignments were created
    const aliceRoles = await RoleAssignment.find({ userId: alice._id });
    expect(aliceRoles).toHaveLength(1);
    expect(aliceRoles[0].role).toBe('STUDENT');
    expect(aliceRoles[0].departmentId.toString()).toBe(testDept._id.toString());
  });

  it('rejects rows with duplicate email or duplicate rollNumber within institution', async () => {
    await User.create({
      name: 'Existing Student',
      email: 'existing@example.com',
      rollNumber: 'CS999',
      passwordHash: 'hash',
      institutionId: testInstId
    });

    const csvData = [
      'name,email,role,rollNumber,departmentId',
      `New Student,existing@example.com,STUDENT,CS105,${testDept._id}`, // Email duplicate
      `Another Student,new@example.com,STUDENT,CS999,${testDept._id}`,   // Roll number duplicate
      `Valid Student,valid@example.com,STUDENT,CS106,${testDept._id}`    // Valid
    ].join('\n');

    const res = await request(app)
      .post('/users/bulk-import')
      .set('Authorization', 'Bearer ADMIN')
      .send({ csv: csvData });

    expect(res.status).toBe(200);
    expect(res.body.data.importedCount).toBe(1);
    expect(res.body.data.failedCount).toBe(2);

    const errors = res.body.data.failed.map(f => f.error);
    expect(errors.some(e => e.includes('already exists'))).toBe(true);
  });

  it('enforces HOD hierarchy: only one active HOD per department', async () => {
    const csvData = [
      'name,email,role,departmentId',
      `HOD One,hod1@example.com,HOD,${testDept._id}`,
      `HOD Two,hod2@example.com,HOD,${testDept._id}` // Second HOD for same dept
    ].join('\n');

    const res = await request(app)
      .post('/users/bulk-import')
      .set('Authorization', 'Bearer ADMIN')
      .send({ csv: csvData });

    expect(res.status).toBe(200);
    expect(res.body.data.importedCount).toBe(1);
    expect(res.body.data.failedCount).toBe(1);
    expect(res.body.data.failed[0].error).toMatch(/already has an active HOD/i);
  });

  it('denies non-admin callers from performing bulk import', async () => {
    const res = await request(app)
      .post('/users/bulk-import')
      .set('Authorization', 'Bearer STUDENT')
      .send({ csv: 'name,email\nTest,test@example.com' });

    expect(res.status).toBe(403);
  });
});
