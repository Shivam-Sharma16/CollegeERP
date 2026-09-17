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
const sectionRoutes = require('../routes/section.route');
const teachingRoutes = require('../routes/teaching.route');

const Year = require('../models/Year.model');
const Semester = require('../models/Semester.model');
const Section = require('../models/Section.model');
const Subject = require('../models/Subject.model');
const Batch = require('../models/Batch.model');
const TeachingAssignment = require('../models/TeachingAssignment.model');

describe('PHASE 84 — HOD Academic Structure Endpoints: Labs & Batches [academic-service]', () => {
  let app;
  const tenantId = new mongoose.Types.ObjectId();
  const deptId = new mongoose.Types.ObjectId();
  const otherDeptId = new mongoose.Types.ObjectId();
  const hodUserId = new mongoose.Types.ObjectId().toString();

  let sectionA;
  let sectionB;
  let student1, student2, studentOtherSection, studentUnassigned;
  let labSubject;
  let lectureSubject;

  beforeAll(async () => {
    const mongoUri = process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/test-academic-phase84';
    await mongoose.connect(mongoUri);

    // Clean up test collections
    await Promise.all([
      Year.deleteMany({ institutionId: tenantId }),
      Semester.deleteMany({ institutionId: tenantId }),
      Section.deleteMany({ institutionId: tenantId }),
      Subject.deleteMany({ institutionId: tenantId }),
      Batch.deleteMany({ institutionId: tenantId }),
      TeachingAssignment.deleteMany({ institutionId: tenantId }),
      mongoose.connection.db.collection('roleassignments').deleteMany({ institutionId: tenantId })
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
    app.use('/sections', sectionRoutes);
    app.use('/batches', batchRoutes);
    app.use('/teaching-assignments', teachingRoutes);

    // Setup Year & Semester
    const year = await Year.create({
      departmentId: deptId,
      yearNumber: 2,
      name: 'Second Year',
      institutionId: tenantId
    });

    const semester = await Semester.create({
      yearId: year._id,
      departmentId: deptId,
      semesterNumber: 3,
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

    sectionB = await Section.create({
      semesterId: semester._id,
      name: 'Section B',
      institutionId: tenantId
    });

    // Mock students in roleassignments
    student1 = new mongoose.Types.ObjectId();
    student2 = new mongoose.Types.ObjectId();
    studentOtherSection = new mongoose.Types.ObjectId();
    studentUnassigned = new mongoose.Types.ObjectId();

    await mongoose.connection.db.collection('roleassignments').insertMany([
      {
        userId: student1,
        role: 'STUDENT',
        sectionId: sectionA._id,
        institutionId: tenantId,
        validTo: null
      },
      {
        userId: student2,
        role: 'STUDENT',
        sectionId: sectionA._id,
        institutionId: tenantId,
        validTo: null
      },
      {
        userId: studentOtherSection,
        role: 'STUDENT',
        sectionId: sectionB._id,
        institutionId: tenantId,
        validTo: null
      }
    ]);
  });

  afterAll(async () => {
    await Promise.all([
      Year.deleteMany({ institutionId: tenantId }),
      Semester.deleteMany({ institutionId: tenantId }),
      Section.deleteMany({ institutionId: tenantId }),
      Subject.deleteMany({ institutionId: tenantId }),
      Batch.deleteMany({ institutionId: tenantId }),
      TeachingAssignment.deleteMany({ institutionId: tenantId }),
      mongoose.connection.db.collection('roleassignments').deleteMany({ institutionId: tenantId })
    ]);
    await mongoose.disconnect();
  });

  describe('1. POST /subjects accepts type: "lecture" | "lab"', () => {
    it('creates a lecture subject when type is lecture or omitted', async () => {
      const res = await request(app)
        .post('/subjects')
        .send({
          name: 'Data Structures',
          code: 'CS201',
          credits: 4,
          type: 'lecture'
        });

      expect(res.status).toBe(201);
      expect(res.body.data.subject.type).toBe('lecture');
      lectureSubject = res.body.data.subject;
    });

    it('creates a lab subject when type is lab', async () => {
      const res = await request(app)
        .post('/subjects')
        .send({
          name: 'Data Structures Lab',
          code: 'CS201L',
          credits: 2,
          type: 'lab'
        });

      expect(res.status).toBe(201);
      expect(res.body.data.subject.type).toBe('lab');
      labSubject = res.body.data.subject;
    });

    it('rejects invalid subject type', async () => {
      const res = await request(app)
        .post('/subjects')
        .send({
          name: 'Invalid Type Course',
          code: 'CS201X',
          credits: 2,
          type: 'workshop'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("type must be either 'lecture' or 'lab'");
    });
  });

  describe('2. POST /sections/:id/batches (HOD creates batch and validates section membership)', () => {
    it('creates batch successfully when all studentIds belong to section', async () => {
      const res = await request(app)
        .post(`/sections/${sectionA._id}/batches`)
        .send({
          name: 'Batch A1',
          studentIds: [student1.toString(), student2.toString()]
        });

      expect(res.status).toBe(201);
      expect(res.body.data.batch.name).toBe('Batch A1');
      expect(res.body.data.batch.sectionId.toString()).toBe(sectionA._id.toString());
      expect(res.body.data.batch.studentIds).toHaveLength(2);
    });

    it('rejects batch creation if any studentId belongs to another section', async () => {
      const res = await request(app)
        .post(`/sections/${sectionA._id}/batches`)
        .send({
          name: 'Batch A2-Bad',
          studentIds: [student1.toString(), studentOtherSection.toString()]
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('do not belong to this section');
      expect(res.body.error).toContain(studentOtherSection.toString());
    });

    it('rejects batch creation if a studentId is completely unassigned', async () => {
      const res = await request(app)
        .post(`/sections/${sectionA._id}/batches`)
        .send({
          name: 'Batch A3-Bad',
          studentIds: [studentUnassigned.toString()]
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('do not belong to this section');
      expect(res.body.error).toContain(studentUnassigned.toString());
    });

    it('rejects duplicate batch name within the same section', async () => {
      const res = await request(app)
        .post(`/sections/${sectionA._id}/batches`)
        .send({
          name: 'Batch A1',
          studentIds: [student1.toString()]
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain("Batch 'Batch A1' already exists in this section");
    });
  });

  describe('3. GET /sections/:id/batches', () => {
    it('retrieves all batches created under that section', async () => {
      const res = await request(app)
        .get(`/sections/${sectionA._id}/batches`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.batches)).toBe(true);
      expect(res.body.data.batches.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.batches[0].sectionId.toString()).toBe(sectionA._id.toString());
    });
  });

  describe('4. PATCH /batches/:id', () => {
    let testBatch;

    beforeAll(async () => {
      testBatch = await Batch.create({
        sectionId: sectionA._id,
        name: 'Batch To Patch',
        studentIds: [student1],
        institutionId: tenantId
      });
    });

    it('updates batch name successfully', async () => {
      const res = await request(app)
        .patch(`/batches/${testBatch._id}`)
        .send({
          name: 'Batch Patched Name'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.batch.name).toBe('Batch Patched Name');
    });

    it('rejects studentIds replacement if student is from another section', async () => {
      const res = await request(app)
        .patch(`/batches/${testBatch._id}`)
        .send({
          studentIds: [studentOtherSection.toString()]
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('do not belong to this section');
    });

    it('adds students via addStudentIds when valid', async () => {
      const res = await request(app)
        .patch(`/batches/${testBatch._id}`)
        .send({
          addStudentIds: [student2.toString()]
        });

      expect(res.status).toBe(200);
      const studentStrs = res.body.data.batch.studentIds.map(s => s.toString());
      expect(studentStrs).toContain(student1.toString());
      expect(studentStrs).toContain(student2.toString());
    });

    it('removes students via removeStudentIds', async () => {
      const res = await request(app)
        .patch(`/batches/${testBatch._id}`)
        .send({
          removeStudentIds: [student1.toString()]
        });

      expect(res.status).toBe(200);
      const studentStrs = res.body.data.batch.studentIds.map(s => s.toString());
      expect(studentStrs).not.toContain(student1.toString());
      expect(studentStrs).toContain(student2.toString());
    });
  });

  describe('5. Teaching Assignment batchId validation (lab vs lecture)', () => {
    let createdBatch;
    const facultyId = new mongoose.Types.ObjectId().toString();

    beforeAll(async () => {
      createdBatch = await Batch.create({
        sectionId: sectionA._id,
        name: 'Batch TA Test',
        studentIds: [student1],
        institutionId: tenantId
      });
    });

    it('REJECTS lab assignment when batchId is missing with specific validation error naming the missing field', async () => {
      const res = await request(app)
        .post('/teaching-assignments')
        .send({
          facultyId,
          subjectId: labSubject._id,
          sectionId: sectionA._id,
          academicYearLabel: '2026-2027'
        });

      expect(res.status).toBe(400);
      // Requirement: returns a specific validation error naming the missing field (batchId), not a generic 400
      expect(res.body.error).toBe('batchId is required for lab subjects');
      expect(res.body.error).toContain('batchId');
    });

    it('REJECTS lecture assignment when batchId IS provided', async () => {
      const res = await request(app)
        .post('/teaching-assignments')
        .send({
          facultyId,
          subjectId: lectureSubject._id,
          sectionId: sectionA._id,
          batchId: createdBatch._id.toString(),
          academicYearLabel: '2026-2027'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('batchId cannot be provided for lecture subjects');
    });

    it('ACCEPTS lab assignment when valid batchId is provided', async () => {
      const res = await request(app)
        .post('/teaching-assignments')
        .send({
          facultyId,
          subjectId: labSubject._id,
          sectionId: sectionA._id,
          batchId: createdBatch._id.toString(),
          academicYearLabel: '2026-2027'
        });

      expect(res.status).toBe(201);
      expect(res.body.data.assignment.batchId.toString()).toBe(createdBatch._id.toString());
    });

    it('ACCEPTS lecture assignment without batchId', async () => {
      const res = await request(app)
        .post('/teaching-assignments')
        .send({
          facultyId,
          subjectId: lectureSubject._id,
          sectionId: sectionA._id,
          academicYearLabel: '2026-2027'
        });

      expect(res.status).toBe(201);
      expect(res.body.data.assignment.batchId).toBeNull();
    });
  });
});
