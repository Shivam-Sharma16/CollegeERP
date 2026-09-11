const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const ExamType = require('../models/ExamType.model');
const MarksRecord = require('../models/MarksRecord.model');
const { createExamType, computeFinalGrade } = require('./results.service');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await ExamType.deleteMany({});
  await MarksRecord.deleteMany({});
});

describe('Results Pipeline', () => {
  const subjectId = new mongoose.Types.ObjectId();
  const studentId = new mongoose.Types.ObjectId();
  const facultyId = new mongoose.Types.ObjectId();

  it('1. Computes correct weighted percentage for quiz(10%)+midterm(30%)+endterm(60%)', async () => {
    // Create Exam Types
    const quiz = await createExamType({
      subjectId,
      type: 'quiz',
      maxMarks: 20,
      weightage: 0.10
    });

    const midterm = await createExamType({
      subjectId,
      type: 'midterm',
      maxMarks: 50,
      weightage: 0.30
    });

    const endterm = await createExamType({
      subjectId,
      type: 'endterm',
      maxMarks: 100,
      weightage: 0.60
    });

    // Enter marks
    // Quiz: 15/20 => 75% => 0.75 * 0.10 = 0.075
    // Midterm: 40/50 => 80% => 0.80 * 0.30 = 0.24
    // Endterm: 90/100 => 90% => 0.90 * 0.60 = 0.54
    // Total Grade: 0.075 + 0.24 + 0.54 = 0.855 => 85.5%

    await MarksRecord.create([
      { examTypeId: quiz._id, studentId, marksObtained: 15, enteredBy: facultyId },
      { examTypeId: midterm._id, studentId, marksObtained: 40, enteredBy: facultyId },
      { examTypeId: endterm._id, studentId, marksObtained: 90, enteredBy: facultyId }
    ]);

    const grade = await computeFinalGrade(studentId, subjectId);
    
    // Check against expected percentage 85.5
    expect(grade.finalGrade).toBeCloseTo(85.5, 2);
  });

  it('2. Rejects creating an ExamType that pushes the sum over 1.0', async () => {
    // Fill up 0.9 weightage
    await createExamType({
      subjectId,
      type: 'midterm',
      maxMarks: 50,
      weightage: 0.90
    });

    // Try to add another 0.2
    await expect(createExamType({
      subjectId,
      type: 'quiz',
      maxMarks: 20,
      weightage: 0.20
    })).rejects.toThrow(/Cannot add weightage of 0.2. Current sum is 0.90, which would exceed 1.0/);

    // Verify it was rejected before insert
    const count = await ExamType.countDocuments({ subjectId });
    expect(count).toBe(1);
  });
});
