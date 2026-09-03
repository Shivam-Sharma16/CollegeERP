require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const { ROLES, SCOPE_LEVELS } = require('@college-erp/shared-config');
const User = require('./models/User.model');
const Department = require('./models/Department.model');
const RoleAssignment = require('./models/RoleAssignment.model');
const { getEffectiveRoles } = require('./services/role.service');
const env = require('./config/env');

const runTest = async () => {
  try {
    await mongoose.connect(env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Clean up
    await User.deleteMany({});
    await Department.deleteMany({});
    await RoleAssignment.deleteMany({});

    // 1. Create a User
    const user = await User.create({
      name: 'John Doe',
      email: 'john.doe@example.com',
      passwordHash: 'hashed_password',
      roles: [ROLES.HOD, ROLES.FACULTY] // Initial raw roles (optional, mostly legacy/sync)
    });
    console.log('User created:', user._id);

    // 2. Create a Department
    const csDept = await Department.create({
      name: 'Computer Science',
      code: 'CS',
      createdBy: user._id
    });

    const mathDept = await Department.create({
      name: 'Mathematics',
      code: 'MATH',
      createdBy: user._id
    });

    const now = new Date();
    const pastDate = new Date(now.getTime() - 1000000000); // Past
    const futureDate = new Date(now.getTime() + 1000000000); // Future

    // 3. Create Role Assignments
    
    // Assignment A: Active HOD in CS Department (validTo: null)
    await RoleAssignment.create({
      userId: user._id,
      role: ROLES.HOD,
      departmentId: csDept._id,
      validFrom: pastDate,
      validTo: null
    });

    // Assignment B: Active Faculty in Math Department (validTo: future)
    await RoleAssignment.create({
      userId: user._id,
      role: ROLES.FACULTY,
      departmentId: mathDept._id,
      validFrom: pastDate,
      validTo: futureDate
    });

    // Assignment C: Expired Faculty role (validTo: past)
    await RoleAssignment.create({
      userId: user._id,
      role: ROLES.FACULTY,
      departmentId: csDept._id,
      validFrom: new Date(pastDate.getTime() - 100000),
      validTo: pastDate
    });

    // Assignment D: Future Role (validFrom: future)
    await RoleAssignment.create({
      userId: user._id,
      role: ROLES.ADMIN,
      validFrom: futureDate,
      validTo: null
    });

    // 4. Test getEffectiveRoles
    const effectiveRoles = await getEffectiveRoles(user._id);
    
    console.log('\n--- EFFECTIVE ROLES ---');
    console.dir(effectiveRoles, { depth: null });
    console.log('-----------------------\n');

    // Assertions
    const isLengthCorrect = effectiveRoles.length === 2;
    const hasHod = effectiveRoles.some(r => r.role === ROLES.HOD && r.scopeId === csDept._id.toString() && r.scopeType === SCOPE_LEVELS.DEPARTMENT);
    const hasFaculty = effectiveRoles.some(r => r.role === ROLES.FACULTY && r.scopeId === mathDept._id.toString() && r.scopeType === SCOPE_LEVELS.DEPARTMENT);

    if (isLengthCorrect && hasHod && hasFaculty) {
      console.log('✅ TEST PASSED: getEffectiveRoles computed correctly.');
    } else {
      console.error('❌ TEST FAILED');
    }

  } catch (err) {
    console.error('Error in test:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

runTest();
