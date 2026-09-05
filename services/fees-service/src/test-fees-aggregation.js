require('dotenv').config();
const mongoose = require('mongoose');
const FeeStructure = require('./models/FeeStructure.model');
const Payment = require('./models/Payment.model');

// Optional: require other models to simulate the cross-collection lookup if necessary,
// but mongoose handles lookups purely at the DB level, so we don't need the Mongoose models
// for 'roleassignments', 'sections', 'semesters', 'years' strictly for the aggregation.

const getDefaulters = async (departmentId, year) => {
  const matchObj = {};
  if (departmentId) matchObj['roleAssignment.departmentId'] = new mongoose.Types.ObjectId(departmentId);
  if (year) matchObj['yearDoc.yearNumber'] = Number(year);

  const pipeline = [
    // 1. Start from RoleAssignments (for STUDENTS)
    { $match: { role: 'STUDENT' } },
    
    // 2. Map Student to Year via Section -> Semester -> Year
    { $lookup: {
        from: 'sections',
        localField: 'sectionId',
        foreignField: '_id',
        as: 'section'
    }},
    { $unwind: '$section' },
    
    { $lookup: {
        from: 'semesters',
        localField: 'section.semesterId',
        foreignField: '_id',
        as: 'semester'
    }},
    { $unwind: '$semester' },
    
    { $lookup: {
        from: 'years',
        localField: 'semester.yearId',
        foreignField: '_id',
        as: 'yearDoc'
    }},
    { $unwind: '$yearDoc' },

    // Add filtering based on requested department and year
    { $match: {
      ...(departmentId ? { departmentId: new mongoose.Types.ObjectId(departmentId) } : {}),
      ...(year ? { 'yearDoc.yearNumber': Number(year) } : {})
    }},

    // 3. Lookup FeeStructure for this department and year
    { $lookup: {
        from: 'feestructures',
        let: { deptId: '$departmentId', yearNum: '$yearDoc.yearNumber' },
        pipeline: [
          { $match: {
              $expr: {
                $and: [
                  { $eq: ['$departmentId', '$$deptId'] },
                  { $eq: ['$year', '$$yearNum'] }
                ]
              }
          }}
        ],
        as: 'feeStructure'
    }},
    { $unwind: '$feeStructure' },
    
    // 4. Unwind installments to check their due dates
    { $unwind: { path: '$feeStructure.installments', includeArrayIndex: 'installmentIndex' } },
    
    // 5. Match only overdue installments
    { $match: { 'feeStructure.installments.dueDate': { $lt: new Date() } } },
    
    // 6. Lookup Payments for this student, fee structure, and installment
    { $lookup: {
        from: 'payments',
        let: { 
          studentId: '$userId', 
          feeStructId: '$feeStructure._id', 
          instIndex: '$installmentIndex' 
        },
        pipeline: [
          { $match: {
              $expr: {
                $and: [
                  { $eq: ['$studentId', '$$studentId'] },
                  { $eq: ['$feeStructureId', '$$feeStructId'] },
                  { $eq: ['$installmentIndex', '$$instIndex'] },
                  { $eq: ['$status', 'paid'] } // Must be paid to count
                ]
              }
          }}
        ],
        as: 'paidPayments'
    }},
    
    // 7. Defaulters are those with NO paid payment for this overdue installment
    { $match: { paidPayments: { $size: 0 } } },
    
    // 8. Group by student to return unique defaulter list
    { $group: {
        _id: '$userId',
        departmentId: { $first: '$departmentId' },
        yearNumber: { $first: '$yearDoc.yearNumber' },
        overdueInstallments: {
          $push: {
            feeStructureId: '$feeStructure._id',
            installmentIndex: '$installmentIndex',
            amount: '$feeStructure.installments.amount',
            dueDate: '$feeStructure.installments.dueDate'
          }
        }
    }}
  ];

  // We execute this on RoleAssignment but through mongoose.connection since we don't have the model here
  return await mongoose.connection.collection('roleassignments').aggregate(pipeline).toArray();
};

async function runTest() {
  const uri = (process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/college-erp-dev').replace('mongodb://mongo:', 'mongodb://127.0.0.1:');
  await mongoose.connect(uri);
  console.log('Connected to DB');
  
  // Clean up previous test data
  await FeeStructure.deleteMany({});
  await Payment.deleteMany({});
  await mongoose.connection.collection('roleassignments').deleteMany({ isTestData: true });
  await mongoose.connection.collection('sections').deleteMany({ isTestData: true });
  await mongoose.connection.collection('semesters').deleteMany({ isTestData: true });
  await mongoose.connection.collection('years').deleteMany({ isTestData: true });
  
  const deptId = new mongoose.Types.ObjectId();
  const yearNumber = 2; // 2nd year
  
  // Setup Academic Tree
  const yearObj = await mongoose.connection.collection('years').insertOne({
    departmentId: deptId,
    yearNumber: yearNumber,
    isTestData: true
  });
  
  const semObj = await mongoose.connection.collection('semesters').insertOne({
    departmentId: deptId,
    yearId: yearObj.insertedId,
    semesterNumber: 3,
    isTestData: true
  });
  
  const secObj = await mongoose.connection.collection('sections').insertOne({
    semesterId: semObj.insertedId,
    name: 'A',
    isTestData: true
  });
  
  // Setup 3 Students
  const studentIds = [
    new mongoose.Types.ObjectId(), // Paid on time
    new mongoose.Types.ObjectId(), // Paid late but before now
    new mongoose.Types.ObjectId()  // Overdue (did not pay)
  ];
  
  for (const sId of studentIds) {
    await mongoose.connection.collection('roleassignments').insertOne({
      userId: sId,
      role: 'STUDENT',
      departmentId: deptId,
      sectionId: secObj.insertedId,
      validFrom: new Date('2025-01-01'),
      isTestData: true
    });
  }
  
  // Create FeeStructure
  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - 10); // 10 days ago
  
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 10); // 10 days from now
  
  const feeStructure = await FeeStructure.create({
    departmentId: deptId,
    year: yearNumber,
    totalAmount: 2000,
    installments: [
      { label: 'Term 1', amount: 1000, dueDate: pastDate },   // Overdue
      { label: 'Term 2', amount: 1000, dueDate: futureDate }  // Not overdue
    ]
  });
  
  // Setup Payments
  // Student 0: Paid on time (Term 1)
  await Payment.create({
    studentId: studentIds[0],
    feeStructureId: feeStructure._id,
    installmentIndex: 0,
    amount: 1000,
    status: 'paid',
    paidAt: new Date(pastDate.getTime() - 86400000) // 1 day before due date
  });
  
  // Student 1: Paid late but before now (Term 1)
  await Payment.create({
    studentId: studentIds[1],
    feeStructureId: feeStructure._id,
    installmentIndex: 0,
    amount: 1000,
    status: 'paid',
    paidAt: new Date(pastDate.getTime() + 86400000) // 1 day after due date, but in the past
  });
  
  // Student 2: Failed payment attempt (Term 1) - Should be defaulter
  await Payment.create({
    studentId: studentIds[2],
    feeStructureId: feeStructure._id,
    installmentIndex: 0,
    amount: 1000,
    status: 'failed', // not paid
    paidAt: null
  });
  
  // Run aggregation
  console.log('\\nRunning getDefaulters...');
  const start = Date.now();
  const defaulters = await getDefaulters(deptId, yearNumber);
  const duration = Date.now() - start;
  
  console.log(`Query completed in ${duration}ms`);
  console.log(`Found ${defaulters.length} defaulter(s).`);
  
  // Verify results
  const defaulterIds = defaulters.map(d => d._id.toString());
  console.log('Defaulter IDs:', defaulterIds);
  
  const expectedId = studentIds[2].toString();
  if (defaulters.length === 1 && defaulterIds.includes(expectedId)) {
    console.log('✅ TEST PASSED: Only the genuinely overdue student was included.');
  } else {
    console.error('❌ TEST FAILED: Incorrect defaulters returned.');
    console.error('Expected:', [expectedId]);
  }

  await mongoose.disconnect();
}

runTest().catch(console.error);
