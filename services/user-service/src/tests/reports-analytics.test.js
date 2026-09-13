const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const Department = require('../models/Department.model');
const RoleAssignment = require('../models/RoleAssignment.model');
const User = require('../models/User.model');
const reportsRoute = require('../routes/reports.route');
const externalReporting = require('../services/externalReporting.service');

const jwt = require('jsonwebtoken');
const JWT_SECRET = 'ny+cq<I;(UL.LR#vzDM2j4>*Xc8^|4l^woMWm#|.iD0';

describe('Phase 77: Institution Analytics & Reporting Backend Tests', () => {
  let mongoServer;
  let app;

  const tenantAId = new mongoose.Types.ObjectId();
  const otherTenantId = new mongoose.Types.ObjectId();

  let adminUser;
  let studentUser;
  let faculty1;
  let faculty2;
  let faculty3;

  let adminToken;
  let studentToken;

  let deptCSE;
  let deptMECH;
  let deptEmptyBiotech;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    app = express();
    app.use(express.json());

    // Middleware simulating gateway tenant header
    app.use((req, res, next) => {
      req.tenantId = tenantAId.toString();
      req.headers['x-tenant-id'] = tenantAId.toString();
      next();
    });

    app.use('/reports', reportsRoute);

    // Seed Users
    adminUser = await User.create({
      name: 'Admin User',
      email: 'admin@college.edu',
      passwordHash: 'hashed',
      roles: ['ADMIN'],
      institutionId: tenantAId
    });

    studentUser = await User.create({
      name: 'Student One',
      email: 'student1@college.edu',
      passwordHash: 'hashed',
      roles: ['STUDENT'],
      institutionId: tenantAId
    });

    adminToken = jwt.sign({
      userId: adminUser._id.toString(),
      roles: ['ADMIN'],
      institutionId: tenantAId.toString()
    }, JWT_SECRET);

    studentToken = jwt.sign({
      userId: studentUser._id.toString(),
      roles: ['STUDENT'],
      institutionId: tenantAId.toString()
    }, JWT_SECRET);

    const studentUser2 = await User.create({
      name: 'Student Two',
      email: 'student2@college.edu',
      passwordHash: 'hashed',
      roles: ['STUDENT'],
      institutionId: tenantAId
    });

    const studentUser3 = await User.create({
      name: 'Student Three',
      email: 'student3@college.edu',
      passwordHash: 'hashed',
      roles: ['STUDENT'],
      institutionId: tenantAId
    });

    faculty1 = await User.create({
      name: 'Prof. Alan Turing',
      email: 'alan@college.edu',
      passwordHash: 'hashed',
      roles: ['FACULTY'],
      institutionId: tenantAId
    });

    faculty2 = await User.create({
      name: 'Prof. Ada Lovelace',
      email: 'ada@college.edu',
      passwordHash: 'hashed',
      roles: ['FACULTY', 'CC'], // DUAL ROLE USER
      institutionId: tenantAId
    });

    faculty3 = await User.create({
      name: 'Prof. James Watt',
      email: 'watt@college.edu',
      passwordHash: 'hashed',
      roles: ['FACULTY'],
      institutionId: tenantAId
    });

    // Seed Departments
    deptCSE = await Department.create({
      name: 'Computer Science and Engineering',
      code: 'CSE',
      institutionId: tenantAId
    });

    deptMECH = await Department.create({
      name: 'Mechanical Engineering',
      code: 'MECH',
      institutionId: tenantAId
    });

    // Edge case department: 0 students, 0 faculty
    deptEmptyBiotech = await Department.create({
      name: 'Biotechnology',
      code: 'BIOTECH',
      institutionId: tenantAId
    });

    // Department in another tenant (should NOT leak)
    await Department.create({
      name: 'Other Dept',
      code: 'OTHER',
      institutionId: otherTenantId
    });

    // Seed RoleAssignments in CSE
    // Students
    await RoleAssignment.create({
      userId: studentUser._id,
      role: 'STUDENT',
      institutionId: tenantAId,
      departmentId: deptCSE._id
    });
    await RoleAssignment.create({
      userId: studentUser2._id,
      role: 'STUDENT',
      institutionId: tenantAId,
      departmentId: deptCSE._id
    });

    // Faculty in CSE: faculty1 has FACULTY, faculty2 has FACULTY + CC in the same department
    await RoleAssignment.create({
      userId: faculty1._id,
      role: 'FACULTY',
      institutionId: tenantAId,
      departmentId: deptCSE._id
    });
    await RoleAssignment.create({
      userId: faculty2._id,
      role: 'FACULTY',
      institutionId: tenantAId,
      departmentId: deptCSE._id
    });
    await RoleAssignment.create({
      userId: faculty2._id,
      role: 'CC', // Dual role: MUST NOT double-count Ada Lovelace!
      institutionId: tenantAId,
      departmentId: deptCSE._id
    });

    // Seed RoleAssignments in MECH
    // Student
    await RoleAssignment.create({
      userId: studentUser3._id,
      role: 'STUDENT',
      institutionId: tenantAId,
      departmentId: deptMECH._id
    });
    // Faculty
    await RoleAssignment.create({
      userId: faculty3._id,
      role: 'FACULTY',
      institutionId: tenantAId,
      departmentId: deptMECH._id
    });

    // Expired student assignment (must not be counted)
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 10);
    await RoleAssignment.create({
      userId: new mongoose.Types.ObjectId(),
      role: 'STUDENT',
      institutionId: tenantAId,
      departmentId: deptCSE._id,
      validTo: pastDate
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  describe('1. GET /reports/overview', () => {
    it('requires reports.view.institution permission (blocks student with 403)', async () => {
      const res = await request(app)
        .get('/reports/overview')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('FLAGSHIP TEST: overall total strictly equals the sum of all department totals', async () => {
      const res = await request(app)
        .get('/reports/overview')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const { overall, departments } = res.body.data;

      // 1. Check department array completeness
      expect(departments).toBeInstanceOf(Array);
      expect(departments.length).toBe(3); // CSE, MECH, BIOTECH (only tenantA departments)

      const cse = departments.find(d => d.code === 'CSE');
      const mech = departments.find(d => d.code === 'MECH');
      const biotech = departments.find(d => d.code === 'BIOTECH');

      expect(cse).toBeDefined();
      expect(cse.totalStudents).toBe(2);
      expect(cse.totalFaculty).toBe(2); // Ada Lovelace has FACULTY & CC, counted once!

      expect(mech).toBeDefined();
      expect(mech.totalStudents).toBe(1);
      expect(mech.totalFaculty).toBe(1);

      // Edge case: Empty department must be present with 0s
      expect(biotech).toBeDefined();
      expect(biotech.totalStudents).toBe(0);
      expect(biotech.totalFaculty).toBe(0);

      // 2. MATHEMATICAL IDENTITY: overall = sum of all departments
      const calculatedSumStudents = departments.reduce((sum, d) => sum + d.totalStudents, 0);
      const calculatedSumFaculty = departments.reduce((sum, d) => sum + d.totalFaculty, 0);

      expect(overall.totalStudents).toBe(calculatedSumStudents);
      expect(overall.totalFaculty).toBe(calculatedSumFaculty);
      expect(overall.totalDepartments).toBe(departments.length);

      expect(overall.totalStudents).toBe(3);
      expect(overall.totalFaculty).toBe(3);
      expect(overall.totalDepartments).toBe(3);
    });
  });

  describe('2. GET /reports/attendance-trend', () => {
    it('returns overall attendance trend via internal service call', async () => {
      const mockTrend = [
        { date: '2026-09-10', totalRecords: 20, presentRecords: 18, percentage: 90 },
        { date: '2026-09-11', totalRecords: 20, presentRecords: 17, percentage: 85 }
      ];
      jest.spyOn(externalReporting, 'fetchAttendanceTrend').mockResolvedValue(mockTrend);

      const res = await request(app)
        .get('/reports/attendance-trend')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.trend).toEqual(mockTrend);
      expect(externalReporting.fetchAttendanceTrend).toHaveBeenCalled();

      externalReporting.fetchAttendanceTrend.mockRestore();
    });

    it('returns department-scoped attendance trend by resolving teaching assignments first', async () => {
      const mockAssignments = [
        { _id: 'assignment-1', subjectId: 'sub-1', facultyId: faculty1._id.toString() },
        { _id: 'assignment-2', subjectId: 'sub-2', facultyId: faculty2._id.toString() }
      ];
      const mockDeptTrend = [
        { date: '2026-09-11', totalRecords: 10, presentRecords: 9, percentage: 90 }
      ];

      jest.spyOn(externalReporting, 'fetchTeachingAssignments').mockResolvedValue(mockAssignments);
      jest.spyOn(externalReporting, 'fetchAttendanceTrend').mockResolvedValue(mockDeptTrend);

      const res = await request(app)
        .get(`/reports/attendance-trend?departmentId=${deptCSE._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.trend).toEqual(mockDeptTrend);

      expect(externalReporting.fetchTeachingAssignments).toHaveBeenCalledWith(
        expect.objectContaining({ departmentId: deptCSE._id.toString() })
      );
      expect(externalReporting.fetchAttendanceTrend).toHaveBeenCalledWith(
        expect.objectContaining({ teachingAssignmentIds: ['assignment-1', 'assignment-2'] })
      );

      externalReporting.fetchTeachingAssignments.mockRestore();
      externalReporting.fetchAttendanceTrend.mockRestore();
    });
  });

  describe('3. GET /reports/academic-performance', () => {
    it('returns overall academic performance trend via internal results service call', async () => {
      const mockPerf = [
        { date: '2026-09-01', totalEvaluations: 40, avgMarks: 78.5, avgPercentage: 78.5 },
        { date: '2026-09-08', totalEvaluations: 45, avgMarks: 82.0, avgPercentage: 82.0 }
      ];
      jest.spyOn(externalReporting, 'fetchAcademicPerformance').mockResolvedValue(mockPerf);

      const res = await request(app)
        .get('/reports/academic-performance')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.trend).toEqual(mockPerf);

      externalReporting.fetchAcademicPerformance.mockRestore();
    });

    it('returns department-scoped academic performance by resolving subjects first', async () => {
      const mockSubjects = [
        { _id: 'sub-101', name: 'Data Structures' },
        { _id: 'sub-102', name: 'Algorithms' }
      ];
      const mockDeptPerf = [
        { date: '2026-09-05', totalEvaluations: 25, avgMarks: 85.0, avgPercentage: 85.0 }
      ];

      jest.spyOn(externalReporting, 'fetchSubjects').mockResolvedValue(mockSubjects);
      jest.spyOn(externalReporting, 'fetchAcademicPerformance').mockResolvedValue(mockDeptPerf);

      const res = await request(app)
        .get(`/reports/academic-performance?departmentId=${deptCSE._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.trend).toEqual(mockDeptPerf);

      expect(externalReporting.fetchSubjects).toHaveBeenCalledWith(
        expect.objectContaining({ departmentId: deptCSE._id.toString() })
      );
      expect(externalReporting.fetchAcademicPerformance).toHaveBeenCalledWith(
        expect.objectContaining({ subjectIds: ['sub-101', 'sub-102'] })
      );

      externalReporting.fetchSubjects.mockRestore();
      externalReporting.fetchAcademicPerformance.mockRestore();
    });
  });

  describe('4. GET /reports/faculty-workload', () => {
    it('aggregates subjects + sections count per faculty and detects overload', async () => {
      // Setup teaching assignments mock from academic-service
      // Alan Turing: normal load (2 subjects, 2 sections)
      // Ada Lovelace: overloaded (4 subjects, 5 sections, 6 assignments)
      const mockAssignments = [
        { facultyId: faculty1._id.toString(), subjectId: 's1', sectionId: 'sec1' },
        { facultyId: faculty1._id.toString(), subjectId: 's2', sectionId: 'sec2' },
        { facultyId: faculty2._id.toString(), subjectId: 's1', sectionId: 'sec1' },
        { facultyId: faculty2._id.toString(), subjectId: 's2', sectionId: 'sec2' },
        { facultyId: faculty2._id.toString(), subjectId: 's3', sectionId: 'sec3' },
        { facultyId: faculty2._id.toString(), subjectId: 's4', sectionId: 'sec4' },
        { facultyId: faculty2._id.toString(), subjectId: 's4', sectionId: 'sec5' },
        { facultyId: faculty2._id.toString(), subjectId: 's1', sectionId: 'sec2' }
      ];

      jest.spyOn(externalReporting, 'fetchTeachingAssignments').mockResolvedValue(mockAssignments);

      const res = await request(app)
        .get('/reports/faculty-workload')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const { facultyWorkload } = res.body.data;
      expect(facultyWorkload).toBeInstanceOf(Array);

      const alan = facultyWorkload.find(f => f.facultyId === faculty1._id.toString());
      const ada = facultyWorkload.find(f => f.facultyId === faculty2._id.toString());
      const watt = facultyWorkload.find(f => f.facultyId === faculty3._id.toString());

      expect(alan).toBeDefined();
      expect(alan.totalSubjects).toBe(2);
      expect(alan.totalSections).toBe(2);
      expect(alan.totalAssignments).toBe(2);
      expect(alan.isOverloaded).toBe(false);

      expect(ada).toBeDefined();
      expect(ada.totalSubjects).toBe(4);
      expect(ada.totalSections).toBe(5);
      expect(ada.totalAssignments).toBe(6);
      expect(ada.isOverloaded).toBe(true); // Overload detected!

      // Watt has 0 assignments seeded
      expect(watt).toBeDefined();
      expect(watt.totalSubjects).toBe(0);
      expect(watt.totalSections).toBe(0);
      expect(watt.totalAssignments).toBe(0);
      expect(watt.isOverloaded).toBe(false);

      externalReporting.fetchTeachingAssignments.mockRestore();
    });
  });
});
