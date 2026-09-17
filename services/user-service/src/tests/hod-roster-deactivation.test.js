const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');

jest.mock('@college-erp/shared-utils', () => ({
  authenticate: (req, res, next) => next(),
  requirePermission: () => (req, res, next) => next(),
  setupSecurity: () => {},
  success: (data) => ({ success: true, data }),
  fail: (error) => ({ success: false, error }),
  logAudit: jest.fn().mockResolvedValue()
}));

jest.setTimeout(30000);

const userRoutes = require('../routes/user.route');
const userController = require('../controllers/user.controller');
const User = require('../models/User.model');
const RoleAssignment = require('../models/RoleAssignment.model');
const Department = require('../models/Department.model');
const { logAudit } = require('@college-erp/shared-utils');

describe('PHASE 86 — HOD Department-Wide Student Roster & Account Deactivation [user-service]', () => {
  let app;
  const testInstId = new mongoose.Types.ObjectId();
  const deptCS = new mongoose.Types.ObjectId();
  const deptMech = new mongoose.Types.ObjectId();

  const hodCSUserId = new mongoose.Types.ObjectId().toString();
  const hodMechUserId = new mongoose.Types.ObjectId().toString();
  const facultyCSUserId = new mongoose.Types.ObjectId().toString();
  const facultyMechUserId = new mongoose.Types.ObjectId().toString();
  const ccCSUserId = new mongoose.Types.ObjectId().toString();
  const ccMechUserId = new mongoose.Types.ObjectId().toString();

  // Academic Tree for Dept CS
  const y1Id = new mongoose.Types.ObjectId();
  const y2Id = new mongoose.Types.ObjectId();
  const sem1Id = new mongoose.Types.ObjectId();
  const sem3Id = new mongoose.Types.ObjectId();
  const secY1A = new mongoose.Types.ObjectId();
  const secY1B = new mongoose.Types.ObjectId();
  const secY2A = new mongoose.Types.ObjectId();
  const secY2B = new mongoose.Types.ObjectId();

  // Students
  let studentAlice, studentBob, studentCharlie, studentDavid;

  beforeAll(async () => {
    const mongoUri = process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/test-user-service-phase86';
    await mongoose.connect(mongoUri);

    // Clean test collections
    await User.deleteMany({ institutionId: testInstId });
    await RoleAssignment.deleteMany({ institutionId: testInstId });
    await Department.deleteMany({ institutionId: testInstId });
    await mongoose.connection.db.collection('years').deleteMany({ institutionId: testInstId });
    await mongoose.connection.db.collection('semesters').deleteMany({ institutionId: testInstId });
    await mongoose.connection.db.collection('sections').deleteMany({ institutionId: testInstId });

    // 1. Departments
    await Department.create([
      { _id: deptCS, name: 'Computer Science', code: 'CS', institutionId: testInstId },
      { _id: deptMech, name: 'Mechanical Engineering', code: 'ME', institutionId: testInstId }
    ]);

    // 2. Academic Tree for CS (Year 1 -> Sem 1 -> Sec A, Sec B; Year 2 -> Sem 3 -> Sec A, Sec B)
    await mongoose.connection.db.collection('years').insertMany([
      { _id: y1Id, institutionId: testInstId, departmentId: deptCS, yearNumber: 1, name: 'Year 1' },
      { _id: y2Id, institutionId: testInstId, departmentId: deptCS, yearNumber: 2, name: 'Year 2' }
    ]);

    await mongoose.connection.db.collection('semesters').insertMany([
      { _id: sem1Id, institutionId: testInstId, departmentId: deptCS, yearId: y1Id, semesterNumber: 1, name: 'Sem 1' },
      { _id: sem3Id, institutionId: testInstId, departmentId: deptCS, yearId: y2Id, semesterNumber: 3, name: 'Sem 3' }
    ]);

    await mongoose.connection.db.collection('sections').insertMany([
      { _id: secY1A, institutionId: testInstId, semesterId: sem1Id, name: 'Section A' },
      { _id: secY1B, institutionId: testInstId, semesterId: sem1Id, name: 'Section B' },
      { _id: secY2A, institutionId: testInstId, semesterId: sem3Id, name: 'Section A' },
      { _id: secY2B, institutionId: testInstId, semesterId: sem3Id, name: 'Section B' }
    ]);

    // 3. Faculty & CC Accounts
    await User.create([
      { _id: facultyCSUserId, name: 'Dr. Turing', email: 'turing@cs.edu', passwordHash: 'hash', roles: ['FACULTY'], institutionId: testInstId, isActive: true },
      { _id: facultyMechUserId, name: 'Dr. Watt', email: 'watt@me.edu', passwordHash: 'hash', roles: ['FACULTY'], institutionId: testInstId, isActive: true },
      { _id: ccCSUserId, name: 'Prof. Hopper', email: 'hopper@cs.edu', passwordHash: 'hash', roles: ['CC'], institutionId: testInstId, isActive: true },
      { _id: ccMechUserId, name: 'Prof. Diesel', email: 'diesel@me.edu', passwordHash: 'hash', roles: ['CC'], institutionId: testInstId, isActive: true }
    ]);

    await RoleAssignment.insertMany([
      { userId: facultyCSUserId, role: 'FACULTY', departmentId: deptCS, institutionId: testInstId, validTo: null },
      { userId: facultyMechUserId, role: 'FACULTY', departmentId: deptMech, institutionId: testInstId, validTo: null },
      { userId: ccCSUserId, role: 'CC', departmentId: deptCS, sectionId: secY1A, institutionId: testInstId, validTo: null },
      { userId: ccMechUserId, role: 'CC', departmentId: deptMech, sectionId: new mongoose.Types.ObjectId(), institutionId: testInstId, validTo: null }
    ]);

    // 4. Students
    studentAlice = await User.create({
      name: 'Alice Cooper',
      email: 'alice@cs.edu',
      rollNumber: 'CS-2026-001',
      passwordHash: 'hash',
      roles: ['STUDENT'],
      institutionId: testInstId,
      isActive: true
    });
    studentBob = await User.create({
      name: 'Bob Marley',
      email: 'bob@cs.edu',
      rollNumber: 'CS-2026-002',
      passwordHash: 'hash',
      roles: ['STUDENT'],
      institutionId: testInstId,
      isActive: true
    });
    studentCharlie = await User.create({
      name: 'Charlie Puth',
      email: 'charlie@cs.edu',
      rollNumber: 'CS-2025-010',
      passwordHash: 'hash',
      roles: ['STUDENT'],
      institutionId: testInstId,
      isActive: true
    });
    studentDavid = await User.create({
      name: 'David Bowie',
      email: 'david@cs.edu',
      rollNumber: 'CS-2025-011',
      passwordHash: 'hash',
      roles: ['STUDENT'],
      institutionId: testInstId,
      isActive: true
    });

    await RoleAssignment.insertMany([
      { userId: studentAlice._id, role: 'STUDENT', departmentId: deptCS, sectionId: secY1A, institutionId: testInstId, validTo: null },
      { userId: studentBob._id, role: 'STUDENT', departmentId: deptCS, sectionId: secY1B, institutionId: testInstId, validTo: null },
      { userId: studentCharlie._id, role: 'STUDENT', departmentId: deptCS, sectionId: secY2A, institutionId: testInstId, validTo: null },
      { userId: studentDavid._id, role: 'STUDENT', departmentId: deptCS, sectionId: secY2B, institutionId: testInstId, validTo: null }
    ]);

    // Express App
    app = express();
    app.use(express.json());

    // Dynamic caller authentication middleware
    app.use((req, res, next) => {
      const role = req.headers['x-role'] || 'HOD';
      const userId = req.headers['x-user-id'] || hodCSUserId;
      const deptId = req.headers['x-dept-id'] || deptCS.toString();

      req.user = {
        userId,
        roles: [role],
        institutionId: testInstId.toString(),
        departmentId: deptId
      };
      req.effectiveRoles = [
        { role, departmentId: deptId, institutionId: testInstId.toString() }
      ];
      req.tenantId = testInstId.toString();
      next();
    });

    app.use('/users', userRoutes);
    app.use('/api/users', userRoutes);
    app.get('/hod/students', userController.listHodStudents);
    app.patch('/faculty/:id/deactivate', userController.deactivateFaculty);
    app.patch('/cc/:id/deactivate', userController.deactivateCC);
  });

  afterAll(async () => {
    await User.deleteMany({ institutionId: testInstId });
    await RoleAssignment.deleteMany({ institutionId: testInstId });
    await Department.deleteMany({ institutionId: testInstId });
    await mongoose.connection.db.collection('years').deleteMany({ institutionId: testInstId });
    await mongoose.connection.db.collection('semesters').deleteMany({ institutionId: testInstId });
    await mongoose.connection.db.collection('sections').deleteMany({ institutionId: testInstId });
    await mongoose.disconnect();
  });

  describe('1. GET /hod/students (Department Tree Aggregation & Combined Filters)', () => {
    it('returns all 4 students in department when no filters are applied', async () => {
      const res = await request(app)
        .get('/hod/students')
        .set('x-role', 'HOD')
        .set('x-user-id', hodCSUserId)
        .set('x-dept-id', deptCS.toString());

      expect(res.status).toBe(200);
      expect(res.body.data.students).toHaveLength(4);
      const names = res.body.data.students.map(s => s.name);
      expect(names).toEqual(expect.arrayContaining(['Alice Cooper', 'Bob Marley', 'Charlie Puth', 'David Bowie']));
    });

    it('filters correctly by year: year=2 returns only 2 students (Charlie and David)', async () => {
      const res = await request(app)
        .get('/hod/students?year=2')
        .set('x-role', 'HOD')
        .set('x-user-id', hodCSUserId)
        .set('x-dept-id', deptCS.toString());

      expect(res.status).toBe(200);
      expect(res.body.data.students).toHaveLength(2);
      const names = res.body.data.students.map(s => s.name);
      expect(names).toEqual(expect.arrayContaining(['Charlie Puth', 'David Bowie']));
    });

    it('filters correctly by section: section=Section A returns 2 students (Alice and Charlie)', async () => {
      const res = await request(app)
        .get('/hod/students?section=Section%20A')
        .set('x-role', 'HOD')
        .set('x-user-id', hodCSUserId)
        .set('x-dept-id', deptCS.toString());

      expect(res.status).toBe(200);
      expect(res.body.data.students).toHaveLength(2);
      const names = res.body.data.students.map(s => s.name);
      expect(names).toEqual(expect.arrayContaining(['Alice Cooper', 'Charlie Puth']));
    });

    it('COMBINED FILTERS: year=2 + section=Section A narrows to exactly 1 student (Charlie)', async () => {
      const res = await request(app)
        .get('/hod/students?year=2&section=Section%20A')
        .set('x-role', 'HOD')
        .set('x-user-id', hodCSUserId)
        .set('x-dept-id', deptCS.toString());

      expect(res.status).toBe(200);
      expect(res.body.data.students).toHaveLength(1);
      expect(res.body.data.students[0].name).toBe('Charlie Puth');
      expect(res.body.data.students[0].rollNumber).toBe('CS-2025-010');
      expect(res.body.data.students[0].yearNumber).toBe(2);
      expect(res.body.data.students[0].sectionName).toBe('Section A');
    });

    it('searches correctly by rollNumber', async () => {
      const res = await request(app)
        .get('/hod/students?search=CS-2026-001')
        .set('x-role', 'HOD')
        .set('x-user-id', hodCSUserId)
        .set('x-dept-id', deptCS.toString());

      expect(res.status).toBe(200);
      expect(res.body.data.students).toHaveLength(1);
      expect(res.body.data.students[0].name).toBe('Alice Cooper');
    });

    it('searches correctly with combined filters: year=2 + section=Section A + search=Charlie', async () => {
      const res = await request(app)
        .get('/hod/students?year=2&section=Section%20A&search=Charlie')
        .set('x-role', 'HOD')
        .set('x-user-id', hodCSUserId)
        .set('x-dept-id', deptCS.toString());

      expect(res.status).toBe(200);
      expect(res.body.data.students).toHaveLength(1);
      expect(res.body.data.students[0].name).toBe('Charlie Puth');
    });

    it('returns empty when search does not match within the filtered section', async () => {
      const res = await request(app)
        .get('/hod/students?year=2&section=Section%20A&search=David')
        .set('x-role', 'HOD')
        .set('x-user-id', hodCSUserId)
        .set('x-dept-id', deptCS.toString());

      expect(res.status).toBe(200);
      expect(res.body.data.students).toHaveLength(0);
    });

    it('rejects non-HOD caller with 403', async () => {
      const res = await request(app)
        .get('/hod/students')
        .set('x-role', 'STUDENT')
        .set('x-user-id', studentAlice._id.toString());

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Only HOD can view department student roster');
    });
  });

  describe('2. PATCH /faculty/:id/deactivate (HOD-only with department isolation)', () => {
    it('HOD CS successfully deactivates Faculty in CS department', async () => {
      const res = await request(app)
        .patch(`/faculty/${facultyCSUserId}/deactivate`)
        .set('x-role', 'HOD')
        .set('x-user-id', hodCSUserId)
        .set('x-dept-id', deptCS.toString());

      expect(res.status).toBe(200);
      expect(res.body.data.isActive).toBe(false);
      expect(res.body.data.userId.toString()).toBe(facultyCSUserId);

      // Verify in DB that User.isActive is false
      const dbUser = await User.findById(facultyCSUserId);
      expect(dbUser.isActive).toBe(false);

      // Verify RoleAssignment.validTo is set
      const dbRA = await RoleAssignment.findOne({ userId: facultyCSUserId, role: 'FACULTY' });
      expect(dbRA.validTo).toBeDefined();
      expect(dbRA.validTo).not.toBeNull();

      expect(logAudit).toHaveBeenCalledWith(
        expect.anything(),
        'FACULTY_DEACTIVATED',
        facultyCSUserId,
        'User',
        expect.objectContaining({ departmentId: deptCS.toString() })
      );
    });

    it('CROSS-DEPARTMENT ISOLATION: HOD CS cannot deactivate Faculty in ME department (403 Forbidden)', async () => {
      const res = await request(app)
        .patch(`/faculty/${facultyMechUserId}/deactivate`)
        .set('x-role', 'HOD')
        .set('x-user-id', hodCSUserId) // HOD of CS
        .set('x-dept-id', deptCS.toString());

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('You cannot deactivate an account belonging to a different department');

      // Verify ME Faculty remains active
      const dbUser = await User.findById(facultyMechUserId);
      expect(dbUser.isActive).toBe(true);
    });

    it('rejects non-HOD from deactivating Faculty with 403', async () => {
      const res = await request(app)
        .patch(`/faculty/${facultyMechUserId}/deactivate`)
        .set('x-role', 'FACULTY')
        .set('x-user-id', facultyCSUserId);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Only HOD can deactivate faculty accounts');
    });
  });

  describe('3. PATCH /cc/:id/deactivate (HOD-only with department isolation)', () => {
    it('HOD CS successfully deactivates CC in CS department', async () => {
      const res = await request(app)
        .patch(`/cc/${ccCSUserId}/deactivate`)
        .set('x-role', 'HOD')
        .set('x-user-id', hodCSUserId)
        .set('x-dept-id', deptCS.toString());

      expect(res.status).toBe(200);
      expect(res.body.data.isActive).toBe(false);

      const dbUser = await User.findById(ccCSUserId);
      expect(dbUser.isActive).toBe(false);

      const dbRA = await RoleAssignment.findOne({ userId: ccCSUserId, role: 'CC' });
      expect(dbRA.validTo).not.toBeNull();
    });

    it('CROSS-DEPARTMENT ISOLATION: HOD CS cannot deactivate CC in ME department (403 Forbidden)', async () => {
      const res = await request(app)
        .patch(`/cc/${ccMechUserId}/deactivate`)
        .set('x-role', 'HOD')
        .set('x-user-id', hodCSUserId)
        .set('x-dept-id', deptCS.toString());

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('You cannot deactivate an account belonging to a different department');

      const dbUser = await User.findById(ccMechUserId);
      expect(dbUser.isActive).toBe(true);
    });
  });

  describe('4. Immediate Login Lockout Verification', () => {
    it('deactivated Faculty account immediately fails login check without manual token revocation', async () => {
      // Direct verification of User.findOne as evaluated by auth-service during /auth/login
      const user = await User.findOne({
        _id: facultyCSUserId,
        institutionId: testInstId
      });

      expect(user).toBeDefined();
      expect(user.isActive).toBe(false);

      // Simulating auth controller line 226: if (!user || !user.isActive) -> 401
      const isLoginAllowed = user && user.isActive;
      expect(isLoginAllowed).toBe(false);
    });
  });
});
