require('dotenv').config();
const mongoose = require('mongoose');
const Notice = require('./models/Notice.model');

// Mock function to represent the cross-service data fetching or a unified DB pipeline
const getNoticesForUser = async (userId) => {
  // Step 1: Resolve User Context from RoleAssignments
  const rolesPipeline = [
    { $match: { userId: new mongoose.Types.ObjectId(userId) } },
    { $lookup: {
        from: 'sections',
        localField: 'sectionId',
        foreignField: '_id',
        as: 'section'
    }},
    { $unwind: { path: '$section', preserveNullAndEmptyArrays: true } },
    { $lookup: {
        from: 'semesters',
        localField: 'section.semesterId',
        foreignField: '_id',
        as: 'semester'
    }},
    { $unwind: { path: '$semester', preserveNullAndEmptyArrays: true } },
    { $lookup: {
        from: 'years',
        localField: 'semester.yearId',
        foreignField: '_id',
        as: 'yearDoc'
    }},
    { $unwind: { path: '$yearDoc', preserveNullAndEmptyArrays: true } },
    { $project: {
        role: 1,
        departmentId: 1,
        sectionId: 1,
        yearNumber: '$yearDoc.yearNumber'
    }}
  ];

  const assignments = await mongoose.connection.collection('roleassignments').aggregate(rolesPipeline).toArray();

  const userRoles = new Set();
  const userDepartments = new Set();
  const userSections = new Set();
  const userYears = new Set();

  for (const a of assignments) {
    if (a.role) userRoles.add(a.role);
    if (a.departmentId) userDepartments.add(a.departmentId.toString());
    if (a.sectionId) userSections.add(a.sectionId.toString());
    if (a.yearNumber) userYears.add(a.yearNumber);
  }

  // Step 2: Build the MongoDB Query
  // For each dimension, the field must either be empty/missing OR match the user's context.
  const query = {
    $and: [
      { $or: [ 
        { 'targeting.departments': { $size: 0 } }, 
        { 'targeting.departments': { $exists: false } },
        { 'targeting.departments': { $in: Array.from(userDepartments).map(id => new mongoose.Types.ObjectId(id)) } } 
      ]},
      { $or: [ 
        { 'targeting.years': { $size: 0 } }, 
        { 'targeting.years': { $exists: false } },
        { 'targeting.years': { $in: Array.from(userYears) } } 
      ]},
      { $or: [ 
        { 'targeting.sections': { $size: 0 } }, 
        { 'targeting.sections': { $exists: false } },
        { 'targeting.sections': { $in: Array.from(userSections).map(id => new mongoose.Types.ObjectId(id)) } } 
      ]},
      { $or: [ 
        { 'targeting.roles': { $size: 0 } }, 
        { 'targeting.roles': { $exists: false } },
        { 'targeting.roles': { $in: Array.from(userRoles) } } 
      ]}
    ]
  };

  return await Notice.find(query).sort({ publishedAt: -1 }).lean();
};

async function runTest() {
  const uri = (process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/college-erp-dev').replace('mongodb://mongo:', 'mongodb://127.0.0.1:');
  await mongoose.connect(uri);
  console.log('Connected to DB');

  // Clean up
  await Notice.deleteMany({});
  await mongoose.connection.collection('roleassignments').deleteMany({ isTestData: true });
  await mongoose.connection.collection('sections').deleteMany({ isTestData: true });
  await mongoose.connection.collection('semesters').deleteMany({ isTestData: true });
  await mongoose.connection.collection('years').deleteMany({ isTestData: true });

  const csDeptId = new mongoose.Types.ObjectId();
  const itDeptId = new mongoose.Types.ObjectId();

  // Setup CS / Sem3 (Year 2) / Section B
  const yearDoc = await mongoose.connection.collection('years').insertOne({
    departmentId: csDeptId,
    yearNumber: 2, // Sem 3 implies 2nd Year
    isTestData: true
  });
  
  const semDoc = await mongoose.connection.collection('semesters').insertOne({
    departmentId: csDeptId,
    yearId: yearDoc.insertedId,
    semesterNumber: 3,
    isTestData: true
  });

  const secADoc = await mongoose.connection.collection('sections').insertOne({
    semesterId: semDoc.insertedId,
    name: 'A',
    isTestData: true
  });

  const secBDoc = await mongoose.connection.collection('sections').insertOne({
    semesterId: semDoc.insertedId,
    name: 'B',
    isTestData: true
  });

  const studentId = new mongoose.Types.ObjectId();

  // Assign Student to CS, Section B
  await mongoose.connection.collection('roleassignments').insertOne({
    userId: studentId,
    role: 'STUDENT',
    departmentId: csDeptId,
    sectionId: secBDoc.insertedId,
    validFrom: new Date('2025-01-01'),
    isTestData: true
  });

  const adminId = new mongoose.Types.ObjectId();

  // Seed Notices
  // 1. Institution-wide (all empty)
  await Notice.create({
    title: 'Institution-wide Holiday',
    body: 'College closed on Friday.',
    createdBy: adminId,
    targeting: { departments: [], years: [], sections: [], roles: [] }
  });

  // 2. CS-department only
  await Notice.create({
    title: 'CS Dept Event',
    body: 'Tech symposium for CS.',
    createdBy: adminId,
    targeting: { departments: [csDeptId] } // others empty/missing
  });

  // 3. Sem 3 (Year 2) targeted
  await Notice.create({
    title: 'Second Year Orientation',
    body: 'Welcome back 2nd years.',
    createdBy: adminId,
    targeting: { years: [2] }
  });

  // 4. Section B only
  await Notice.create({
    title: 'Section B Timetable Update',
    body: 'New schedule.',
    createdBy: adminId,
    targeting: { sections: [secBDoc.insertedId] }
  });

  // 5. IT-department (Should NOT be seen)
  await Notice.create({
    title: 'IT Dept Meeting',
    body: 'Only for IT.',
    createdBy: adminId,
    targeting: { departments: [itDeptId] }
  });

  // 6. Section A only (Should NOT be seen)
  await Notice.create({
    title: 'Section A Project Deadline',
    body: 'Submit today.',
    createdBy: adminId,
    targeting: { sections: [secADoc.insertedId] }
  });

  console.log('\\nFetching notices for student...');
  const start = Date.now();
  const notices = await getNoticesForUser(studentId.toString());
  const duration = Date.now() - start;

  console.log(`Query completed in ${duration}ms`);
  
  const noticeTitles = notices.map(n => n.title);
  console.log('Notices found:');
  noticeTitles.forEach(t => console.log(`- ${t}`));

  const expectedTitles = [
    'Institution-wide Holiday',
    'CS Dept Event',
    'Second Year Orientation',
    'Section B Timetable Update'
  ];

  const unexpectedTitles = [
    'IT Dept Meeting',
    'Section A Project Deadline'
  ];

  let passed = true;
  for (const expected of expectedTitles) {
    if (!noticeTitles.includes(expected)) {
      console.error(`❌ TEST FAILED: Missing expected notice '${expected}'`);
      passed = false;
    }
  }

  for (const unexpected of unexpectedTitles) {
    if (noticeTitles.includes(unexpected)) {
      console.error(`❌ TEST FAILED: Included unexpected notice '${unexpected}'`);
      passed = false;
    }
  }

  if (passed && noticeTitles.length === expectedTitles.length) {
    console.log('\\n✅ TEST PASSED: Exactly the correct notices were returned.');
  } else {
    console.log('\\n❌ TEST FAILED: Notice count mismatch or validation failed.');
  }

  await mongoose.disconnect();
}

runTest().catch(console.error);
