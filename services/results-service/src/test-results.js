require('dotenv').config();
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

const examTypeRoute   = require('./routes/examType.route');
const marksRoute      = require('./routes/marks.route');
const transcriptRoute = require('./routes/transcript.route');

const ExamType    = require('./models/ExamType.model');
const MarksRecord = require('./models/MarksRecord.model');

const JWT_SECRET = 'test_results_secret_p16';
process.env.JWT_ACCESS_SECRET = JWT_SECRET;

const makeToken = (userId, roles) =>
  jwt.sign({ userId: userId.toString(), roles }, JWT_SECRET, { expiresIn: '1h' });

const httpReq = (app, method, url, token, body) =>
  new Promise((resolve) => {
    const server = app.listen(0, async () => {
      const port = server.address().port;
      const res = await fetch(`http://localhost:${port}${url}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: body ? JSON.stringify(body) : undefined
      });
      const status = res.status;
      const data = await res.json().catch(() => ({}));
      server.close(() => resolve({ status, data }));
    });
  });

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/exam-types', examTypeRoute);
  app.use('/marks',      marksRoute);
  app.use('/students',   transcriptRoute);
  return app;
};

async function run() {
  const uri = (process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/college-erp-dev')
    .replace('mongodb://mongo:', 'mongodb://127.0.0.1:');
  await mongoose.connect(uri);
  console.log('✔ Connected to MongoDB\n');

  await ExamType.deleteMany({});
  await MarksRecord.deleteMany({});
  await mongoose.connection.db.collection('teachingassignments').deleteMany({});
  await mongoose.connection.db.collection('subjects').deleteMany({});

  // Seed subjects (3 subjects, 4+3+2 credits)
  const subjectIds = [
    new mongoose.Types.ObjectId(),
    new mongoose.Types.ObjectId(),
    new mongoose.Types.ObjectId()
  ];
  await mongoose.connection.db.collection('subjects').insertMany([
    { _id: subjectIds[0], name: 'Data Structures', code: 'CS301', credits: 4, departmentId: new mongoose.Types.ObjectId() },
    { _id: subjectIds[1], name: 'Algorithms',      code: 'CS302', credits: 3, departmentId: new mongoose.Types.ObjectId() },
    { _id: subjectIds[2], name: 'OS',               code: 'CS303', credits: 2, departmentId: new mongoose.Types.ObjectId() }
  ]);

  const faculty1Id = new mongoose.Types.ObjectId();
  const faculty2Id = new mongoose.Types.ObjectId();
  const studentId  = new mongoose.Types.ObjectId();

  // Faculty 1 teaches sub[0] and sub[1]; Faculty 2 teaches sub[2]
  await mongoose.connection.db.collection('teachingassignments').insertMany([
    { facultyId: faculty1Id, subjectId: subjectIds[0], sectionId: new mongoose.Types.ObjectId(), academicYearLabel: '2024-25' },
    { facultyId: faculty1Id, subjectId: subjectIds[1], sectionId: new mongoose.Types.ObjectId(), academicYearLabel: '2024-25' },
    { facultyId: faculty2Id, subjectId: subjectIds[2], sectionId: new mongoose.Types.ObjectId(), academicYearLabel: '2024-25' }
  ]);

  const f1Token = makeToken(faculty1Id, ['FACULTY']);
  const f2Token = makeToken(faculty2Id, ['FACULTY']);
  // HOD token for exam type creation — needs HOD role with departmentId in roleassignments
  const hodId = new mongoose.Types.ObjectId();
  const deptId = new mongoose.Types.ObjectId();
  await mongoose.connection.db.collection('roleassignments').deleteMany({ role: 'HOD' });
  await mongoose.connection.db.collection('roleassignments').insertOne(
    { userId: hodId, role: 'HOD', departmentId: deptId, validFrom: new Date() }
  );
  const hodToken = makeToken(hodId, ['HOD']);

  const app = buildApp();
  let passed = 0, failed = 0;

  const assert = (label, condition) => {
    if (condition) { console.log(`  ✅ ${label}`); passed++; }
    else           { console.error(`  ❌ ${label}`); failed++; }
  };

  // ─── Block 1: ExamType creation with weightage validation ─────────────────
  console.log('--- Block 1: ExamType Creation & Weightage Validation ---');

  // CS301: quiz 0.3 + midterm 0.3 + endterm 0.4 = 1.0 exactly
  const et1 = await httpReq(app, 'POST', '/exam-types', hodToken, { subjectId: subjectIds[0].toString(), type: 'quiz',    maxMarks: 20, weightage: 0.3 });
  assert('CS301 quiz ExamType created (201)', et1.status === 201);
  const et1Id = et1.data?.data?.examType?._id;

  const et2 = await httpReq(app, 'POST', '/exam-types', hodToken, { subjectId: subjectIds[0].toString(), type: 'midterm', maxMarks: 50, weightage: 0.3 });
  assert('CS301 midterm ExamType created (201)', et2.status === 201);
  const et2Id = et2.data?.data?.examType?._id;

  const et3 = await httpReq(app, 'POST', '/exam-types', hodToken, { subjectId: subjectIds[0].toString(), type: 'endterm', maxMarks: 100, weightage: 0.4 });
  assert('CS301 endterm ExamType created (201)', et3.status === 201);
  const et3Id = et3.data?.data?.examType?._id;

  // Attempt to add another would exceed 1.0
  const etOver = await httpReq(app, 'POST', '/exam-types', hodToken, { subjectId: subjectIds[0].toString(), type: 'assignment', maxMarks: 10, weightage: 0.1 });
  assert('Weightage exceeding 1.0 rejected (422)', etOver.status === 422);
  assert('422 error is descriptive (mentions sum)', etOver.data?.error?.includes('exceed'));

  // CS302: midterm 0.4 + endterm 0.6 = 1.0
  const et4 = await httpReq(app, 'POST', '/exam-types', hodToken, { subjectId: subjectIds[1].toString(), type: 'midterm', maxMarks: 50, weightage: 0.4 });
  const et4Id = et4.data?.data?.examType?._id;
  const et5 = await httpReq(app, 'POST', '/exam-types', hodToken, { subjectId: subjectIds[1].toString(), type: 'endterm', maxMarks: 100, weightage: 0.6 });
  const et5Id = et5.data?.data?.examType?._id;

  // CS303: endterm 1.0
  const et6 = await httpReq(app, 'POST', '/exam-types', hodToken, { subjectId: subjectIds[2].toString(), type: 'endterm', maxMarks: 100, weightage: 1.0 });
  const et6Id = et6.data?.data?.examType?._id;
  assert('All ExamTypes created', !!(et1Id && et2Id && et3Id && et4Id && et5Id && et6Id));

  // ─── Block 2: Faculty ownership gate ──────────────────────────────────────
  console.log('\n--- Block 2: Faculty Ownership Gate ---');
  // Faculty 2 tries to enter marks for CS301 (Faculty 1's subject)
  const r2 = await httpReq(app, 'POST', '/marks', f2Token, {
    examTypeId: et1Id, studentId: studentId.toString(), marksObtained: 15
  });
  assert('Faculty 2 rejected for Faculty 1\'s subject (403)', r2.status === 403);

  // ─── Block 3: Valid marks entry (Faculty 1, CS301) ─────────────────────────
  console.log('\n--- Block 3: Valid Marks Entry ---');
  // CS301: quiz 15/20, mid 40/50, end 78/100
  // Grade = (15/20)*0.3 + (40/50)*0.3 + (78/100)*0.4
  //       = 0.225 + 0.24 + 0.312 = 0.777 → 77.7%
  const m1 = await httpReq(app, 'POST', '/marks', f1Token, { examTypeId: et1Id, studentId: studentId.toString(), marksObtained: 15 });
  const m2 = await httpReq(app, 'POST', '/marks', f1Token, { examTypeId: et2Id, studentId: studentId.toString(), marksObtained: 40 });
  const m3 = await httpReq(app, 'POST', '/marks', f1Token, { examTypeId: et3Id, studentId: studentId.toString(), marksObtained: 78 });
  assert('CS301 marks entered (3 records)', m1.status === 201 && m2.status === 201 && m3.status === 201);

  // CS302: mid 35/50, end 62/100 (Faculty 1)
  // Grade = (35/50)*0.4 + (62/100)*0.6 = 0.28 + 0.372 = 0.652 → 65.2%
  await httpReq(app, 'POST', '/marks', f1Token, { examTypeId: et4Id, studentId: studentId.toString(), marksObtained: 35 });
  await httpReq(app, 'POST', '/marks', f1Token, { examTypeId: et5Id, studentId: studentId.toString(), marksObtained: 62 });

  // CS303: end 88/100 (Faculty 2)
  // Grade = (88/100)*1.0 = 0.88 → 88.0%
  await httpReq(app, 'POST', '/marks', f2Token, { examTypeId: et6Id, studentId: studentId.toString(), marksObtained: 88 });

  // ─── Block 4: Bulk marks entry ─────────────────────────────────────────────
  console.log('\n--- Block 4: Bulk Marks Entry ---');
  const student2Id = new mongoose.Types.ObjectId();
  const rb = await httpReq(app, 'POST', '/marks/bulk', f1Token, {
    examTypeId: et1Id,
    entries: [
      { studentId: student2Id.toString(), marksObtained: 18 },
      { studentId: new mongoose.Types.ObjectId().toString(), marksObtained: 999 } // Should fail validation
    ]
  });
  assert('Bulk entry: 1 inserted, 1 error', rb.data?.data?.results?.inserted === 1 && rb.data?.data?.results?.errors?.length === 1);

  // ─── Block 5: Transcript with hand-computed fixture ───────────────────────
  console.log('\n--- Block 5: Transcript Verification ---');
  const stdToken = makeToken(studentId, ['STUDENT']);
  const r5 = await httpReq(app, 'GET', `/students/${studentId}/transcript`, stdToken);
  assert('Transcript returns 200', r5.status === 200);

  const transcript = r5.data?.data;
  assert('Transcript has 3 subjects', transcript?.subjects?.length === 3);

  // Find each subject and verify grade
  const cs301 = transcript.subjects.find(s => s.subjectCode === 'CS301');
  const cs302 = transcript.subjects.find(s => s.subjectCode === 'CS302');
  const cs303 = transcript.subjects.find(s => s.subjectCode === 'CS303');

  const expected301 = 77.70; // (15/20)*0.3 + (40/50)*0.3 + (78/100)*0.4 = 77.7
  const expected302 = 65.20; // (35/50)*0.4 + (62/100)*0.6 = 65.2
  const expected303 = 88.00; // (88/100)*1.0 = 88.0

  assert(`CS301 grade = ${expected301}%`, Math.abs((cs301?.gradePercent || 0) - expected301) < 0.01);
  assert(`CS302 grade = ${expected302}%`, Math.abs((cs302?.gradePercent || 0) - expected302) < 0.01);
  assert(`CS303 grade = ${expected303}%`, Math.abs((cs303?.gradePercent || 0) - expected303) < 0.01);

  // Credit-weighted GPA: (77.7*4 + 65.2*3 + 88.0*2) / (4+3+2)
  // = (310.8 + 195.6 + 176.0) / 9 = 682.4 / 9 = 75.82
  const expectedGPA = parseFloat(((expected301 * 4 + expected302 * 3 + expected303 * 2) / 9).toFixed(2));
  assert(`Credit-weighted GPA = ${expectedGPA}`, Math.abs((transcript?.gpa || 0) - expectedGPA) < 0.1);
  assert('CS301 letter grade = A (70-79)', cs301?.letterGrade === 'A');
  assert('CS303 letter grade = A+ (80-89)', cs303?.letterGrade === 'A+');

  // ─── Summary ─────────────────────────────────────────────────────────────────
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
