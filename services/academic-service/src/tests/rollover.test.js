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

const rolloverRoutes = require('../routes/rollover.route');
const Year = require('../models/Year.model');
const Semester = require('../models/Semester.model');
const Section = require('../models/Section.model');

describe('PHASE 79 — Academic Semester Rollover', () => {
  let mongoServer;
  let app;
  const tenantId = new mongoose.Types.ObjectId();
  const deptId = new mongoose.Types.ObjectId();

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    app = express();
    app.use(express.json());

    app.use((req, res, next) => {
      if (req.headers.authorization) {
        const role = req.headers.authorization.split(' ')[1];
        req.user = {
          userId: new mongoose.Types.ObjectId().toString(),
          roles: [role],
          institutionId: tenantId
        };
        req.tenantId = tenantId.toString();
      }
      next();
    });

    app.use('/academic', rolloverRoutes);
    app.use('/api/academic', rolloverRoutes);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it('rolls over semester, carries forward sections, updates enrolled students, and leaves historical attendance/marks untouched', async () => {
    // 1. Setup Year and Semester 1
    const year = await Year.create({
      departmentId: deptId,
      yearNumber: 1,
      institutionId: tenantId
    });

    const sem1 = await Semester.create({
      departmentId: deptId,
      yearId: year._id,
      semesterNumber: 1,
      institutionId: tenantId
    });

    // 2. Setup Sections A and B in Semester 1
    const secA = await Section.create({
      semesterId: sem1._id,
      name: 'Section A',
      institutionId: tenantId
    });

    const secB = await Section.create({
      semesterId: sem1._id,
      name: 'Section B',
      institutionId: tenantId
    });

    // 3. Setup enrolled student in Section A and historical attendance/marks records
    const studentId = new mongoose.Types.ObjectId();
    const roleAssignmentsCol = mongoose.connection.db.collection('roleassignments');
    const attendanceCol = mongoose.connection.db.collection('attendancerecords');
    const marksCol = mongoose.connection.db.collection('marksrecords');

    await roleAssignmentsCol.insertOne({
      userId: studentId,
      role: 'STUDENT',
      departmentId: deptId,
      sectionId: secA._id,
      semesterId: sem1._id,
      institutionId: tenantId,
      validFrom: new Date(),
      validTo: null
    });

    // Historical Attendance Record tied to Semester 1
    const historicalSessionId = new mongoose.Types.ObjectId();
    const initialAttendance = await attendanceCol.insertOne({
      institutionId: tenantId,
      lectureSessionId: historicalSessionId,
      studentId: studentId,
      status: 'present',
      deviceFingerprint: 'fp-xyz-123'
    });

    // Historical Marks Record tied to Semester 1
    const historicalExamId = new mongoose.Types.ObjectId();
    const initialMarks = await marksCol.insertOne({
      institutionId: tenantId,
      examTypeId: historicalExamId,
      studentId: studentId,
      marksObtained: 85,
      enteredBy: new mongoose.Types.ObjectId()
    });

    // 4. Trigger Rollover via Admin
    const res = await request(app)
      .post('/academic/rollover')
      .set('Authorization', 'Bearer ADMIN')
      .send({
        departmentId: deptId.toString(),
        yearId: year._id.toString(),
        currentSemesterNumber: 1
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    expect(data.previousSemester.semesterNumber).toBe(1);
    expect(data.nextSemester.semesterNumber).toBe(2);
    expect(data.sectionsRolledOver).toBe(2);

    // 5. Verify Semester 2 was created in DB
    const sem2 = await Semester.findOne({ yearId: year._id, semesterNumber: 2 });
    expect(sem2).not.toBeNull();
    expect(sem2.semesterNumber).toBe(2);

    // 6. Verify Sections in Semester 2 have carriesForwardFrom pointing to Semester 1 sections
    const newSecA = await Section.findOne({ semesterId: sem2._id, name: 'Section A' });
    const newSecB = await Section.findOne({ semesterId: sem2._id, name: 'Section B' });

    expect(newSecA).not.toBeNull();
    expect(newSecA.carriesForwardFrom.toString()).toBe(secA._id.toString());
    expect(newSecB).not.toBeNull();
    expect(newSecB.carriesForwardFrom.toString()).toBe(secB._id.toString());

    // 7. Verify student's active reference was updated to new section and new semester
    const updatedStudentAssignment = await roleAssignmentsCol.findOne({ userId: studentId });
    expect(updatedStudentAssignment.sectionId.toString()).toBe(newSecA._id.toString());
    expect(updatedStudentAssignment.semesterId.toString()).toBe(sem2._id.toString());

    // 8. Explicitly verify historical AttendanceRecord and MarksRecord are UNTOUCHED
    const attendanceAfter = await attendanceCol.findOne({ _id: initialAttendance.insertedId });
    expect(attendanceAfter.lectureSessionId.toString()).toBe(historicalSessionId.toString());
    expect(attendanceAfter.status).toBe('present');

    const marksAfter = await marksCol.findOne({ _id: initialMarks.insertedId });
    expect(marksAfter.examTypeId.toString()).toBe(historicalExamId.toString());
    expect(marksAfter.marksObtained).toBe(85);
  });

  it('rejects rollover attempts from non-admin users', async () => {
    const res = await request(app)
      .post('/academic/rollover')
      .set('Authorization', 'Bearer STUDENT')
      .send({
        departmentId: deptId.toString(),
        yearId: new mongoose.Types.ObjectId().toString(),
        currentSemesterNumber: 1
      });

    expect(res.status).toBe(403);
  });
});
