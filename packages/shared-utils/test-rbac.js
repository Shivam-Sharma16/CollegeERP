const mongoose = require('mongoose');
const { requirePermission, fail } = require('./index');

// A simple mock for express response
const mockRes = () => {
  const res = {};
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.data = data;
    return res;
  };
  return res;
};

async function runTest() {
  const uri = 'mongodb://127.0.0.1:27017/college-erp-dev';
  await mongoose.connect(uri);
  console.log('Connected to DB for RBAC testing');

  const roleAssignmentsCol = mongoose.connection.db.collection('roleassignments');
  await roleAssignmentsCol.deleteMany({}); // Clean up just in case

  // Setup test users and data
  const hodId = new mongoose.Types.ObjectId();
  const deptA = new mongoose.Types.ObjectId();
  const deptB = new mongoose.Types.ObjectId();
  
  await roleAssignmentsCol.insertOne({
    userId: hodId,
    role: 'HOD',
    departmentId: deptA,
    validFrom: new Date()
  });

  const facultyId = new mongoose.Types.ObjectId();
  const sectionA = new mongoose.Types.ObjectId();
  
  await roleAssignmentsCol.insertOne({
    userId: facultyId,
    role: 'FACULTY',
    sectionId: sectionA,
    validFrom: new Date()
  });

  const studentId = new mongoose.Types.ObjectId();
  const studentBId = new mongoose.Types.ObjectId();
  
  await roleAssignmentsCol.insertOne({
    userId: studentId,
    role: 'STUDENT',
    sectionId: sectionA,
    departmentId: deptA,
    validFrom: new Date()
  });

  // Test 1: Faculty gets 403 on HOD-only route
  // Wait, the middleware passes if ANY role allows it. 
  // For an HOD route, the resource has a departmentId.
  // The Faculty role scope is sectionId. The extracted target Context will be departmentId.
  // The Faculty check: `targetContext.type === 'sectionId'`. It will be false. So Faculty will be rejected.
  console.log('\\n--- Test 1: Faculty accesses HOD resource ---');
  let req = {
    user: { userId: facultyId, roles: [] },
    body: { departmentId: deptA.toString() }
  };
  let res = mockRes();
  let nextCalled = false;
  
  await requirePermission('write', 'Department')(req, res, () => { nextCalled = true; });
  
  if (res.statusCode === 403 && res.data.success === false) {
    console.log('✅ TEST PASSED: Faculty correctly received 403 on department-level resource.');
  } else {
    console.error('❌ TEST FAILED: Faculty was not rejected properly.');
  }

  // Test 2: HOD from Dept A gets 403 modifying Dept B resource
  console.log('\\n--- Test 2: HOD A modifying Dept B resource ---');
  req = {
    user: { userId: hodId, roles: [] },
    body: { departmentId: deptB.toString() }
  };
  res = mockRes();
  nextCalled = false;

  await requirePermission('write', 'Subject')(req, res, () => { nextCalled = true; });

  if (res.statusCode === 403 && res.data.success === false) {
    console.log('✅ TEST PASSED: HOD A correctly received 403 on Dept B resource.');
  } else {
    console.error('❌ TEST FAILED: HOD A was not rejected properly.');
  }

  // Test 3: HOD from Dept A successfully modifying Dept A resource
  console.log('\\n--- Test 3: HOD A modifying Dept A resource ---');
  req = {
    user: { userId: hodId, roles: [] },
    body: { departmentId: deptA.toString() }
  };
  res = mockRes();
  nextCalled = false;

  await requirePermission('write', 'Department')(req, res, () => { nextCalled = true; });

  if (nextCalled) {
    console.log('✅ TEST PASSED: HOD A successfully authorized for Dept A resource.');
  } else {
    console.error('❌ TEST FAILED: HOD A was incorrectly rejected.');
  }

  // Test 4: Student gets 403 reading another student's marks
  console.log('\\n--- Test 4: Student reading another students marks ---');
  req = {
    user: { userId: studentId, roles: [] },
    params: { studentId: studentBId.toString() }
  };
  res = mockRes();
  nextCalled = false;

  await requirePermission('read', 'Marks')(req, res, () => { nextCalled = true; });

  if (res.statusCode === 403 && res.data.success === false) {
    console.log('✅ TEST PASSED: Student correctly received 403 accessing another students data.');
  } else {
    console.error('❌ TEST FAILED: Student was not rejected properly.');
  }

  // Test 5: SUPERADMIN always passes
  console.log('\\n--- Test 5: Superadmin accesses anything ---');
  req = {
    user: { userId: new mongoose.Types.ObjectId(), roles: ['SUPERADMIN'] },
    params: { studentId: studentBId.toString() }
  };
  res = mockRes();
  nextCalled = false;

  await requirePermission('read', 'Marks')(req, res, () => { nextCalled = true; });

  if (nextCalled) {
    console.log('✅ TEST PASSED: Superadmin correctly bypassed all restrictions.');
  } else {
    console.error('❌ TEST FAILED: Superadmin was incorrectly rejected.');
  }

  // Test 6: Tenant Mismatch (Phase 68 outermost check)
  console.log('\\n--- Test 6: User with Tenant A accessing Tenant B context ---');
  const tenantA = new mongoose.Types.ObjectId();
  const tenantB = new mongoose.Types.ObjectId();
  req = {
    user: { userId: hodId, roles: ['HOD'], institutionId: tenantA },
    tenantId: tenantB.toString(),
    body: { departmentId: deptA.toString() }
  };
  res = mockRes();
  nextCalled = false;

  await requirePermission('write', 'Department')(req, res, () => { nextCalled = true; });

  if (res.statusCode === 403 && res.data.error === 'Access Denied: Tenant mismatch') {
    console.log('✅ TEST PASSED: Caller rejected with 403 when user institution does not match tenant.');
  } else {
    console.error('❌ TEST FAILED: Tenant mismatch was not caught properly.', res.statusCode, res.data);
  }

  // Test 7: Preloaded resource belonging to a different tenant
  console.log('\\n--- Test 7: Preloaded resource from foreign institution ---');
  req = {
    user: { userId: hodId, roles: ['HOD'], institutionId: tenantA },
    tenantId: tenantA.toString(),
    resource: { institutionId: tenantB },
    body: { departmentId: deptA.toString() }
  };
  res = mockRes();
  nextCalled = false;

  await requirePermission('write', 'Department')(req, res, () => { nextCalled = true; });

  if (res.statusCode === 403 && res.data.error === 'Access Denied: Resource belongs to a different institution') {
    console.log('✅ TEST PASSED: Preloaded foreign resource rejected with 403.');
  } else {
    console.error('❌ TEST FAILED: Foreign resource was not rejected properly.', res.statusCode, res.data);
  }

  // Test 8: SuperAdmin bypasses tenant mismatch
  console.log('\\n--- Test 8: Superadmin ignores tenant mismatch ---');
  req = {
    user: { userId: new mongoose.Types.ObjectId(), roles: ['SUPERADMIN'], institutionId: null },
    tenantId: tenantB.toString(),
    resource: { institutionId: tenantB },
    params: { studentId: studentBId.toString() }
  };
  res = mockRes();
  nextCalled = false;

  await requirePermission('read', 'Marks')(req, res, () => { nextCalled = true; });

  if (nextCalled) {
    console.log('✅ TEST PASSED: SuperAdmin successfully bypassed tenant restrictions.');
  } else {
    console.error('❌ TEST FAILED: SuperAdmin was blocked by tenant check.', res.statusCode, res.data);
  }

  await mongoose.disconnect();
}

runTest().catch(console.error);
