process.env.PORT = '4004';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/test-attendance-phase85';
process.env.REDIS_URL = 'redis://127.0.0.1:6379';
process.env.JWT_SECRET = 'test';
process.env.INTERNAL_SERVICE_KEY = 'test';

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

const recordRoutes = require('../routes/record.route');
const disputeRoutes = require('../routes/dispute.route');

const LectureSession = require('../models/LectureSession.model');
const AttendanceRecord = require('../models/AttendanceRecord.model');
const { logAudit } = require('@college-erp/shared-utils');

describe('PHASE 85 — Escalated Attendance Dispute Resolution [attendance-service]', () => {
  let app;
  const institutionId = new mongoose.Types.ObjectId();
  const deptCS = new mongoose.Types.ObjectId();
  const deptOther = new mongoose.Types.ObjectId();

  const semesterCS = new mongoose.Types.ObjectId();
  const sectionA = new mongoose.Types.ObjectId();
  const sectionB = new mongoose.Types.ObjectId();

  const subjectCS1 = new mongoose.Types.ObjectId();
  const subjectCS2 = new mongoose.Types.ObjectId();

  const taAId = new mongoose.Types.ObjectId();
  const taBId = new mongoose.Types.ObjectId();

  const cc1UserId = new mongoose.Types.ObjectId().toString(); // CC Section A
  const cc2UserId = new mongoose.Types.ObjectId().toString(); // CC Section B
  const hodUserId = new mongoose.Types.ObjectId().toString(); // HOD CS
  const hodOtherUserId = new mongoose.Types.ObjectId().toString(); // HOD Other Dept
  const student1Id = new mongoose.Types.ObjectId().toString();
  const student2Id = new mongoose.Types.ObjectId().toString();

  let sessionA;
  let sessionB;
  let recordA;
  let recordB;
  let recordPresent;

  beforeAll(async () => {
    const mongoUri = process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/test-attendance-phase85';
    await mongoose.connect(mongoUri);

    // Clean test collections
    await LectureSession.deleteMany({ institutionId });
    await AttendanceRecord.deleteMany({ institutionId });
    await mongoose.connection.db.collection('semesters').deleteMany({ institutionId });
    await mongoose.connection.db.collection('sections').deleteMany({ institutionId });
    await mongoose.connection.db.collection('subjects').deleteMany({ institutionId });
    await mongoose.connection.db.collection('teachingassignments').deleteMany({ institutionId });
    await mongoose.connection.db.collection('roleassignments').deleteMany({ institutionId });

    // 1. Seed Semesters & Sections
    await mongoose.connection.db.collection('semesters').insertMany([
      { _id: semesterCS, institutionId, departmentId: deptCS, semesterNumber: 3, name: 'Sem 3' }
    ]);

    await mongoose.connection.db.collection('sections').insertMany([
      { _id: sectionA, institutionId, semesterId: semesterCS, name: 'Section A' },
      { _id: sectionB, institutionId, semesterId: semesterCS, name: 'Section B' }
    ]);

    // 2. Seed Subjects
    await mongoose.connection.db.collection('subjects').insertMany([
      { _id: subjectCS1, institutionId, departmentId: deptCS, name: 'Operating Systems', code: 'CS301' },
      { _id: subjectCS2, institutionId, departmentId: deptCS, name: 'Database Systems', code: 'CS302' }
    ]);

    // 3. Seed RoleAssignments (CC A, CC B, HOD CS, HOD Other)
    await mongoose.connection.db.collection('roleassignments').insertMany([
      {
        userId: new mongoose.Types.ObjectId(cc1UserId),
        institutionId,
        role: 'CC',
        departmentId: deptCS,
        sectionId: sectionA,
        validTo: null
      },
      {
        userId: new mongoose.Types.ObjectId(cc2UserId),
        institutionId,
        role: 'CC',
        departmentId: deptCS,
        sectionId: sectionB,
        validTo: null
      },
      {
        userId: new mongoose.Types.ObjectId(hodUserId),
        institutionId,
        role: 'HOD',
        departmentId: deptCS,
        validTo: null
      },
      {
        userId: new mongoose.Types.ObjectId(hodOtherUserId),
        institutionId,
        role: 'HOD',
        departmentId: deptOther,
        validTo: null
      }
    ]);

    // 4. Seed Teaching Assignments (TA A -> Section A, TA B -> Section B)
    await mongoose.connection.db.collection('teachingassignments').insertMany([
      {
        _id: taAId,
        institutionId,
        facultyId: new mongoose.Types.ObjectId(),
        subjectId: subjectCS1,
        sectionId: sectionA,
        academicYearLabel: '2026-2027'
      },
      {
        _id: taBId,
        institutionId,
        facultyId: new mongoose.Types.ObjectId(),
        subjectId: subjectCS2,
        sectionId: sectionB,
        academicYearLabel: '2026-2027'
      }
    ]);

    // 5. Create Sessions
    sessionA = await LectureSession.create({
      institutionId,
      teachingAssignmentId: taAId,
      date: new Date(),
      timeSlot: '09:00 - 10:00',
      topic: 'Processes & Threads',
      qrTokenSecret: 'secA',
      qrTokenExpiresAt: new Date(Date.now() + 3600000),
      geofence: { lat: 12.97, lng: 77.59, radiusMeters: 50 },
      status: 'closed'
    });

    sessionB = await LectureSession.create({
      institutionId,
      teachingAssignmentId: taBId,
      date: new Date(),
      timeSlot: '10:00 - 11:00',
      topic: 'Relational Algebra',
      qrTokenSecret: 'secB',
      qrTokenExpiresAt: new Date(Date.now() + 3600000),
      geofence: { lat: 12.97, lng: 77.59, radiusMeters: 50 },
      status: 'closed'
    });

    // 6. Create Attendance Records
    recordA = await AttendanceRecord.create({
      institutionId,
      lectureSessionId: sessionA._id,
      studentId: new mongoose.Types.ObjectId(student1Id),
      status: 'flagged',
      verificationMethod: 'geofence_fail',
      deviceFingerprint: 'dev-A-1'
    });

    recordB = await AttendanceRecord.create({
      institutionId,
      lectureSessionId: sessionB._id,
      studentId: new mongoose.Types.ObjectId(student2Id),
      status: 'flagged',
      verificationMethod: 'device_conflict',
      deviceFingerprint: 'dev-B-2'
    });

    recordPresent = await AttendanceRecord.create({
      institutionId,
      lectureSessionId: sessionA._id,
      studentId: new mongoose.Types.ObjectId(),
      status: 'present',
      verificationMethod: 'qr_scan',
      deviceFingerprint: 'dev-A-3'
    });

    // Express app setup with test auth simulation
    app = express();
    app.use(express.json());

    app.use((req, res, next) => {
      const role = req.headers['x-role'] || 'STUDENT';
      const userId = req.headers['x-user-id'] || student1Id;
      const dept = req.headers['x-dept-id'] || null;
      const sec = req.headers['x-section-id'] || null;

      req.user = {
        userId,
        roles: [role],
        institutionId: institutionId.toString(),
        departmentId: dept
      };
      req.effectiveRoles = [
        { role, departmentId: dept, sectionId: sec, institutionId: institutionId.toString() }
      ];
      req.tenantId = institutionId.toString();
      next();
    });

    app.use('/records', recordRoutes);
    app.use('/disputes', disputeRoutes);
  });

  afterAll(async () => {
    await LectureSession.deleteMany({ institutionId });
    await AttendanceRecord.deleteMany({ institutionId });
    await mongoose.connection.db.collection('semesters').deleteMany({ institutionId });
    await mongoose.connection.db.collection('sections').deleteMany({ institutionId });
    await mongoose.connection.db.collection('subjects').deleteMany({ institutionId });
    await mongoose.connection.db.collection('teachingassignments').deleteMany({ institutionId });
    await mongoose.connection.db.collection('roleassignments').deleteMany({ institutionId });
    await mongoose.disconnect();
  });

  describe('1. POST /records/:id/escalate (CC-only and flagged-only)', () => {
    it('rejects non-CC user from escalating an attendance record', async () => {
      const res = await request(app)
        .post(`/records/${recordA._id}/escalate`)
        .set('x-role', 'STUDENT')
        .set('x-user-id', student1Id)
        .send({ reason: 'Legitimate network glitch' });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Only Class Coordinators can escalate');
    });

    it('rejects escalating a record that is not in flagged status', async () => {
      const res = await request(app)
        .post(`/records/${recordPresent._id}/escalate`)
        .set('x-role', 'CC')
        .set('x-user-id', cc1UserId)
        .set('x-section-id', sectionA.toString())
        .send({ reason: 'Student was present' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Only flagged attendance records can be escalated');
    });

    it('rejects CC from escalating a record of a different section', async () => {
      const res = await request(app)
        .post(`/records/${recordB._id}/escalate`)
        .set('x-role', 'CC')
        .set('x-user-id', cc1UserId) // CC of Section A
        .set('x-section-id', sectionA.toString())
        .send({ reason: 'Trying to escalate section B record' });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('You are not the Class Coordinator for this section');
    });

    it('rejects escalation when reason is missing', async () => {
      const res = await request(app)
        .post(`/records/${recordA._id}/escalate`)
        .set('x-role', 'CC')
        .set('x-user-id', cc1UserId)
        .set('x-section-id', sectionA.toString())
        .send({ reason: '' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Escalation reason is required');
    });

    it('CC in Section A escalates Record A successfully', async () => {
      const res = await request(app)
        .post(`/records/${recordA._id}/escalate`)
        .set('x-role', 'CC')
        .set('x-user-id', cc1UserId)
        .set('x-section-id', sectionA.toString())
        .send({ reason: 'Verified device hardware GPS issue during rain' });

      expect(res.status).toBe(200);
      expect(res.body.data.record.escalation).toBeDefined();
      expect(res.body.data.record.escalation.status).toBe('pending');
      expect(res.body.data.record.escalation.reason).toBe('Verified device hardware GPS issue during rain');
      expect(res.body.data.record.escalation.escalatedBy.toString()).toBe(cc1UserId);
      expect(logAudit).toHaveBeenCalledWith(
        expect.anything(),
        'ATTENDANCE_DISPUTE_ESCALATED',
        recordA._id.toString(),
        'AttendanceRecord',
        expect.objectContaining({
          reason: 'Verified device hardware GPS issue during rain'
        })
      );
    });

    it('rejects re-escalating an already pending record', async () => {
      const res = await request(app)
        .post(`/records/${recordA._id}/escalate`)
        .set('x-role', 'CC')
        .set('x-user-id', cc1UserId)
        .set('x-section-id', sectionA.toString())
        .send({ reason: 'Trying to escalate again' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('already pending escalation');
    });

    it('CC in Section B escalates Record B successfully', async () => {
      const res = await request(app)
        .post(`/records/${recordB._id}/escalate`)
        .set('x-role', 'CC')
        .set('x-user-id', cc2UserId)
        .set('x-section-id', sectionB.toString())
        .send({ reason: 'Shared sibling device in same hall' });

      expect(res.status).toBe(200);
      expect(res.body.data.record.escalation.status).toBe('pending');
      expect(res.body.data.record.escalation.reason).toBe('Shared sibling device in same hall');
      expect(res.body.data.record.escalation.escalatedBy.toString()).toBe(cc2UserId);
    });
  });

  describe('2. GET /disputes/escalated (Department-wide aggregation)', () => {
    it('rejects non-HOD user from listing escalated disputes', async () => {
      const res = await request(app)
        .get('/disputes/escalated')
        .set('x-role', 'CC')
        .set('x-user-id', cc1UserId);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Only HOD can view escalated disputes');
    });

    it('HOD receives disputes from BOTH Section A and Section B in single aggregated list', async () => {
      const res = await request(app)
        .get('/disputes/escalated')
        .set('x-role', 'HOD')
        .set('x-user-id', hodUserId)
        .set('x-dept-id', deptCS.toString());

      expect(res.status).toBe(200);
      const disputes = res.body.data.disputes;
      expect(Array.isArray(disputes)).toBe(true);
      expect(disputes.length).toBe(2);

      const recordIds = disputes.map(d => d._id.toString());
      expect(recordIds).toContain(recordA._id.toString());
      expect(recordIds).toContain(recordB._id.toString());

      const sectionNames = disputes.map(d => d.sectionName);
      expect(sectionNames).toContain('Section A');
      expect(sectionNames).toContain('Section B');

      const subjectCodes = disputes.map(d => d.subjectCode);
      expect(subjectCodes).toContain('CS301');
      expect(subjectCodes).toContain('CS302');
    });

    it('HOD of different department sees 0 disputes for their empty department', async () => {
      const res = await request(app)
        .get('/disputes/escalated')
        .set('x-role', 'HOD')
        .set('x-user-id', hodOtherUserId)
        .set('x-dept-id', deptOther.toString());

      expect(res.status).toBe(200);
      expect(res.body.data.disputes).toHaveLength(0);
    });
  });

  describe('3. POST /disputes/:id/resolve-escalation (HOD resolution and AuditLog)', () => {
    it('rejects non-HOD user from resolving dispute', async () => {
      const res = await request(app)
        .post(`/disputes/${recordA._id}/resolve-escalation`)
        .set('x-role', 'CC')
        .set('x-user-id', cc1UserId)
        .send({ resolution: 'Looks good' });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Only HOD can resolve escalated disputes');
    });

    it('rejects HOD from another department from resolving this dispute', async () => {
      const res = await request(app)
        .post(`/disputes/${recordA._id}/resolve-escalation`)
        .set('x-role', 'HOD')
        .set('x-user-id', hodOtherUserId)
        .set('x-dept-id', deptOther.toString())
        .send({ resolution: 'HOD of other dept approves' });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('belongs to a different department');
    });

    it('rejects resolution without resolution text', async () => {
      const res = await request(app)
        .post(`/disputes/${recordA._id}/resolve-escalation`)
        .set('x-role', 'HOD')
        .set('x-user-id', hodUserId)
        .set('x-dept-id', deptCS.toString())
        .send({ resolution: '' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Resolution reason/text is required');
    });

    it('HOD resolves Record A with status present and writes AuditLog', async () => {
      const res = await request(app)
        .post(`/disputes/${recordA._id}/resolve-escalation`)
        .set('x-role', 'HOD')
        .set('x-user-id', hodUserId)
        .set('x-dept-id', deptCS.toString())
        .send({
          resolution: 'Manual sign-in sheet confirms physical presence in classroom',
          newStatus: 'present'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.record.status).toBe('present');
      expect(res.body.data.record.escalation.status).toBe('resolved');
      expect(res.body.data.record.escalation.resolution).toBe(
        'Manual sign-in sheet confirms physical presence in classroom'
      );
      expect(res.body.data.record.escalation.resolvedBy.toString()).toBe(hodUserId);

      // Verify AuditLog entry was written
      expect(logAudit).toHaveBeenCalledWith(
        expect.anything(),
        'ATTENDANCE_DISPUTE_RESOLVED',
        recordA._id.toString(),
        'AttendanceRecord',
        expect.objectContaining({
          resolvedBy: hodUserId,
          resolution: 'Manual sign-in sheet confirms physical presence in classroom',
          newStatus: 'present'
        })
      );
    });

    it('rejects resolving an already resolved dispute', async () => {
      const res = await request(app)
        .post(`/disputes/${recordA._id}/resolve-escalation`)
        .set('x-role', 'HOD')
        .set('x-user-id', hodUserId)
        .set('x-dept-id', deptCS.toString())
        .send({ resolution: 'Trying to resolve again' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('no pending escalation to resolve');
    });

    it('HOD escalated disputes list reflects updated status', async () => {
      const resPending = await request(app)
        .get('/disputes/escalated?status=pending')
        .set('x-role', 'HOD')
        .set('x-user-id', hodUserId)
        .set('x-dept-id', deptCS.toString());

      expect(resPending.status).toBe(200);
      // Only Record B remains pending
      expect(resPending.body.data.disputes).toHaveLength(1);
      expect(resPending.body.data.disputes[0]._id.toString()).toBe(recordB._id.toString());

      const resResolved = await request(app)
        .get('/disputes/escalated?status=resolved')
        .set('x-role', 'HOD')
        .set('x-user-id', hodUserId)
        .set('x-dept-id', deptCS.toString());

      expect(resResolved.status).toBe(200);
      // Record A is resolved
      expect(resResolved.body.data.disputes).toHaveLength(1);
      expect(resResolved.body.data.disputes[0]._id.toString()).toBe(recordA._id.toString());
    });
  });
});
