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

const subjectRoutes = require('../routes/subject.route');
const batchRoutes = require('../routes/batch.route');
const teachingRoutes = require('../routes/teaching.route');

const Year = require('../models/Year.model');
const Semester = require('../models/Semester.model');
const Section = require('../models/Section.model');
const Subject = require('../models/Subject.model');
const Batch = require('../models/Batch.model');
const TeachingAssignment = require('../models/TeachingAssignment.model');

describe('PHASE 83 — Labs & Lab Batches Schema Retrofit [academic-service]', () => {
  let mongoServer;
  let app;
  const tenantId = new mongoose.Types.ObjectId();
  const deptId = new mongoose.Types.ObjectId();
  const hodUserId = new mongoose.Types.ObjectId().toString();

  let sectionA;
  let lectureSubject;
  let labSubject;

  beforeAll(async () => {
    const mongoUri = process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/test-academic-lab-batches';
    await mongoose.connect(mongoUri);

    // Clean up test collections
    await Promise.all([
      Year.deleteMany({ institutionId: tenantId }),
      Semester.deleteMany({ institutionId: tenantId }),
      Section.deleteMany({ institutionId: tenantId }),
      Subject.deleteMany({ institutionId: tenantId }),
      Batch.deleteMany({ institutionId: tenantId }),
      TeachingAssignment.deleteMany({ institutionId: tenantId }),
    ]);

    app = express();
    app.use(express.json());

    // Middleware simulating authenticated HOD with department scope
    app.use((req, res, next) => {
      req.user = {
        userId: hodUserId,
        roles: ['HOD'],
        institutionId: tenantId
      };
      req.effectiveRoles = [
        { role: 'HOD', departmentId: deptId.toString() }
      ];
      req.tenantId = tenantId.toString();
      next();
    });

    app.use('/subjects', subjectRoutes);
    app.use('/batches', batchRoutes);
    app.use('/teaching-assignments', teachingRoutes);

    // Initial setup: Year, Semester, Section
    const year = await Year.create({
      departmentId: deptId,
      yearNumber: 1,
      name: 'First Year',
      institutionId: tenantId
    });

    const semester = await Semester.create({
      yearId: year._id,
      departmentId: deptId,
      semesterNumber: 1,
      academicYear: '2026-2027',
      startDate: new Date('2026-08-01'),
      endDate: new Date('2026-12-15'),
      institutionId: tenantId
    });

    sectionA = await Section.create({
      semesterId: semester._id,
      name: 'Section A',
      institutionId: tenantId
    });
  });

  afterAll(async () => {
    await Promise.all([
      Year.deleteMany({ institutionId: tenantId }),
      Semester.deleteMany({ institutionId: tenantId }),
      Section.deleteMany({ institutionId: tenantId }),
      Subject.deleteMany({ institutionId: tenantId }),
      Batch.deleteMany({ institutionId: tenantId }),
      TeachingAssignment.deleteMany({ institutionId: tenantId }),
    ]);
    await mongoose.disconnect();
  });

  describe('1. Subject Retrofit (type: lecture | lab)', () => {
    it('creates lecture subject with default type: "lecture"', async () => {
      const res = await request(app)
        .post('/subjects')
        .send({
          name: 'Computer Networks',
          code: 'CS301',
          credits: 4
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.subject.type).toBe('lecture');
      lectureSubject = res.body.data.subject;
    });

    it('creates lab subject with explicit type: "lab"', async () => {
      const res = await request(app)
        .post('/subjects')
        .send({
          name: 'Computer Networks Lab',
          code: 'CS301L',
          credits: 2,
          type: 'lab'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.subject.type).toBe('lab');
      labSubject = res.body.data.subject;
    });

    it('rejects invalid subject type with 400', async () => {
      const res = await request(app)
        .post('/subjects')
        .send({
          name: 'Seminar',
          code: 'CS302',
          credits: 1,
          type: 'seminar'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/type must be either 'lecture' or 'lab'/i);
    });
  });

  describe('2. Batch Management (Batch schema and CRUD)', () => {
    let batch1Id;
    let batch2Id;
    const studentS1 = new mongoose.Types.ObjectId();
    const studentS2 = new mongoose.Types.ObjectId();
    const studentS3 = new mongoose.Types.ObjectId();
    const studentS4 = new mongoose.Types.ObjectId();

    beforeAll(async () => {
      await mongoose.connection.db.collection('roleassignments').insertMany([
        { userId: studentS1, role: 'STUDENT', sectionId: sectionA._id, institutionId: tenantId, validTo: null },
        { userId: studentS2, role: 'STUDENT', sectionId: sectionA._id, institutionId: tenantId, validTo: null },
        { userId: studentS3, role: 'STUDENT', sectionId: sectionA._id, institutionId: tenantId, validTo: null },
        { userId: studentS4, role: 'STUDENT', sectionId: sectionA._id, institutionId: tenantId, validTo: null }
      ]);
    });

    it('creates Batch 1 and Batch 2 under Section A with distinct students', async () => {
      const res1 = await request(app)
        .post('/batches')
        .send({
          sectionId: sectionA._id,
          name: 'Batch 1',
          studentIds: [studentS1, studentS2]
        });

      expect(res1.status).toBe(201);
      expect(res1.body.data.batch.name).toBe('Batch 1');
      expect(res1.body.data.batch.studentIds).toHaveLength(2);
      batch1Id = res1.body.data.batch._id;

      const res2 = await request(app)
        .post('/batches')
        .send({
          sectionId: sectionA._id,
          name: 'Batch 2',
          studentIds: [studentS3, studentS4]
        });

      expect(res2.status).toBe(201);
      expect(res2.body.data.batch.name).toBe('Batch 2');
      expect(res2.body.data.batch.studentIds).toHaveLength(2);
      batch2Id = res2.body.data.batch._id;
    });

    it('rejects duplicate batch name in the same section with 409', async () => {
      const res = await request(app)
        .post('/batches')
        .send({
          sectionId: sectionA._id,
          name: 'Batch 1'
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('lists batches filtered by sectionId', async () => {
      const res = await request(app)
        .get(`/batches?sectionId=${sectionA._id}`);

      expect(res.status).toBe(200);
      expect(res.body.data.batches).toHaveLength(2);
      expect(res.body.data.batches.map(b => b.name)).toEqual(['Batch 1', 'Batch 2']);
    });

    it('updates batch students', async () => {
      const studentS5 = new mongoose.Types.ObjectId();
      await mongoose.connection.db.collection('roleassignments').insertOne({
        userId: studentS5,
        role: 'STUDENT',
        sectionId: sectionA._id,
        institutionId: tenantId,
        validTo: null
      });

      const res = await request(app)
        .put(`/batches/${batch1Id}`)
        .send({
          studentIds: [studentS1, studentS2, studentS5]
        });

      expect(res.status).toBe(200);
      expect(res.body.data.batch.studentIds).toHaveLength(3);
    });
  });

  describe('3. TeachingAssignment Retrofit (batchId validation & multi-faculty lab)', () => {
    const faculty1 = new mongoose.Types.ObjectId().toString();
    const faculty2 = new mongoose.Types.ObjectId().toString();
    let batch1;
    let batch2;

    beforeAll(async () => {
      const batches = await Batch.find({ sectionId: sectionA._id }).sort({ name: 1 });
      batch1 = batches[0];
      batch2 = batches[1];
    });

    it('rejects creating a lab assignment without batchId with 400', async () => {
      const res = await request(app)
        .post('/teaching-assignments')
        .send({
          facultyId: faculty1,
          subjectId: labSubject._id,
          sectionId: sectionA._id,
          academicYearLabel: '2026-2027'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/batchId is required for lab subjects/i);
    });

    it('rejects lecture assignment if batchId is provided, and succeeds without batchId', async () => {
      const resBad = await request(app)
        .post('/teaching-assignments')
        .send({
          facultyId: faculty1,
          subjectId: lectureSubject._id,
          sectionId: sectionA._id,
          batchId: batch1._id,
          academicYearLabel: '2026-2027'
        });

      expect(resBad.status).toBe(400);
      expect(resBad.body.error).toContain('batchId cannot be provided for lecture subjects');

      const resOk = await request(app)
        .post('/teaching-assignments')
        .send({
          facultyId: faculty1,
          subjectId: lectureSubject._id,
          sectionId: sectionA._id,
          academicYearLabel: '2026-2027'
        });

      expect(resOk.status).toBe(201);
      expect(resOk.body.data.assignment.batchId).toBeNull();
    });

    it('assigns Faculty 1 to Section A + Lab + Batch 1 successfully', async () => {
      const res = await request(app)
        .post('/teaching-assignments')
        .send({
          facultyId: faculty1,
          subjectId: labSubject._id,
          sectionId: sectionA._id,
          batchId: batch1._id,
          academicYearLabel: '2026-2027'
        });

      expect(res.status).toBe(201);
      expect(res.body.data.assignment.batchId).toBe(batch1._id.toString());
    });

    it('assigns Faculty 2 to Section A + same Lab + Batch 2 successfully (multi-faculty lab)', async () => {
      const res = await request(app)
        .post('/teaching-assignments')
        .send({
          facultyId: faculty2,
          subjectId: labSubject._id,
          sectionId: sectionA._id,
          batchId: batch2._id,
          academicYearLabel: '2026-2027'
        });

      expect(res.status).toBe(201);
      expect(res.body.data.assignment.batchId).toBe(batch2._id.toString());
    });

    it('rejects duplicate assignment for the same faculty + lab + batch with 409', async () => {
      const res = await request(app)
        .post('/teaching-assignments')
        .send({
          facultyId: faculty1,
          subjectId: labSubject._id,
          sectionId: sectionA._id,
          batchId: batch1._id,
          academicYearLabel: '2026-2027'
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/duplicate assignment/i);
    });

    it('prevents deleting batch when teaching assignments reference it', async () => {
      const res = await request(app)
        .delete(`/batches/${batch1._id}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/cannot delete batch with existing teaching assignments/i);
    });
  });
});
