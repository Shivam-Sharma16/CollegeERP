/**
 * Multi-Tenant Local Development Seed Script
 * Phase 73 — Infrastructure
 * 
 * Provisions 2 distinct test institutions with full role hierarchies
 * and overlapping-looking data (identical department names & subject codes)
 * to make cross-tenant isolation and tenant-boundary bugs immediately visible.
 * 
 * Usage:
 *   node infra/scripts/seed-multi-tenant.js
 *   or
 *   npm run seed:multi-tenant
 */

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const path = require('path');
const dotenv = require('dotenv');

// Load environment from user-service or gateway if present
dotenv.config({ path: path.join(__dirname, '../../services/user-service/.env') });
dotenv.config({ path: path.join(__dirname, '../../services/gateway/.env') });
dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGO_URI =
  process.env.MONGO_URI ||
  'mongodb+srv://shivamsharmait27_db_user:v98lK1beZGiJQ0jf@collegeerp.p6ixsac.mongodb.net/user-service';

const BCRYPT_ROUNDS = 10;
const TEST_PASSWORD = 'Password123!';

// Colors for terminal formatting
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
  white: '\x1b[37m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
};

async function seed() {
  console.log('\n' + c.cyan + '==================================================================' + c.reset);
  console.log(c.bold + c.cyan + '       COLLEGE ERP — MULTI-TENANT LOCAL DEVELOPMENT SEED          ' + c.reset);
  console.log(c.cyan + '==================================================================' + c.reset);

  console.log(`\nConnecting to MongoDB Cluster...`);
  await mongoose.connect(MONGO_URI);
  console.log(c.green + '✔ Connected to MongoDB successfully.' + c.reset);

  const client = mongoose.connection.client;

  // Databases across services
  const userDb = client.db('user-service');
  const authDb = client.db('auth-service');
  const academicDb = client.db('academic-service');
  const noticeDb = client.db('notice-service');
  const feesDb = client.db('fees-service');

  const passwordHash = await bcrypt.hash(TEST_PASSWORD, BCRYPT_ROUNDS);

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. ROOT SUPERADMIN (institutionId: null)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n' + c.bold + '[1/5] Ensuring Root Platform SuperAdmin...' + c.reset);

  const superAdminEmail = 'superadmin@collegeerp.com';
  let superAdminUser = await userDb.collection('users').findOne({ email: superAdminEmail, institutionId: null });

  if (!superAdminUser) {
    const newId = new mongoose.Types.ObjectId();
    const doc = {
      _id: newId,
      name: 'Platform SuperAdmin',
      email: superAdminEmail,
      passwordHash,
      roles: ['SUPERADMIN'],
      institutionId: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await userDb.collection('users').insertOne(doc);
    await authDb.collection('users').updateOne(
      { email: superAdminEmail, institutionId: null },
      { $set: doc },
      { upsert: true }
    );
    superAdminUser = doc;
    console.log(c.green + `  ✔ Created SuperAdmin: ${superAdminEmail}` + c.reset);
  } else {
    await userDb.collection('users').updateOne(
      { _id: superAdminUser._id },
      { $set: { passwordHash, isActive: true, roles: ['SUPERADMIN'], institutionId: null } }
    );
    await authDb.collection('users').updateOne(
      { email: superAdminEmail, institutionId: null },
      { $set: { passwordHash, isActive: true, roles: ['SUPERADMIN'], institutionId: null } },
      { upsert: true }
    );
    console.log(c.green + `  ✔ Verified SuperAdmin: ${superAdminEmail}` + c.reset);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. SEED INSTITUTIONS (Apex & Beacon)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n' + c.bold + '[2/5] Seeding 2 Multi-Tenant Institutions...' + c.reset);

  const institutionsDef = [
    {
      subdomain: 'apex-tech',
      slug: 'apex-tech',
      name: 'Apex Institute of Technology',
      code: 'AIT',
      customDomain: 'apex.localhost',
      domain: 'apex.localhost',
      themeConfig: {
        primaryColor: '#4f46e5',
        secondaryColor: '#06b6d4',
        faviconUrl: '',
      },
      branding: {
        primaryColor: '#4f46e5',
        secondaryColor: '#06b6d4',
        logoUrl: '',
        faviconUrl: '',
      },
      isActive: true,
      status: 'ACTIVE',
      createdBy: superAdminUser._id,
      studentCount: 1420,
      facultyCount: 85,
      departmentCount: 2,
    },
    {
      subdomain: 'beacon-eng',
      slug: 'beacon-eng',
      name: 'Beacon College of Engineering',
      code: 'BCE',
      customDomain: 'beacon.localhost',
      domain: 'beacon.localhost',
      themeConfig: {
        primaryColor: '#0284c7',
        secondaryColor: '#10b981',
        faviconUrl: '',
      },
      branding: {
        primaryColor: '#0284c7',
        secondaryColor: '#10b981',
        logoUrl: '',
        faviconUrl: '',
      },
      isActive: true,
      status: 'ACTIVE',
      createdBy: superAdminUser._id,
      studentCount: 980,
      facultyCount: 62,
      departmentCount: 2,
    },
  ];

  const seededInstitutions = {};

  for (const instData of institutionsDef) {
    let existing = await userDb.collection('institutions').findOne({
      $or: [{ subdomain: instData.subdomain }, { slug: instData.subdomain }],
    });

    if (!existing) {
      const newId = new mongoose.Types.ObjectId();
      const doc = { _id: newId, ...instData, createdAt: new Date(), updatedAt: new Date() };
      await userDb.collection('institutions').insertOne(doc);
      existing = doc;
      console.log(c.green + `  ✔ Created Institution: "${instData.name}" (${instData.subdomain}.localhost)` + c.reset);
    } else {
      await userDb.collection('institutions').updateOne(
        { _id: existing._id },
        { $set: { ...instData, updatedAt: new Date() } }
      );
      console.log(c.green + `  ✔ Updated Institution: "${instData.name}" (${instData.subdomain}.localhost)` + c.reset);
    }

    seededInstitutions[instData.subdomain] = existing;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. SEED ACCOUNTS PER TENANT (Admin, HOD, Faculty, Student)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n' + c.bold + '[3/5] Seeding Role Accounts for Each Tenant...' + c.reset);

  const tenantUsersDef = {
    'apex-tech': {
      inst: seededInstitutions['apex-tech'],
      admin: { name: 'Dr. Jane Smith', email: 'admin@apex.edu', roles: ['ADMIN'] },
      hod: { name: 'Dr. Ada Lovelace', email: 'hod.cs@apex.edu', roles: ['HOD'] },
      faculty: { name: 'Prof. Claude Shannon', email: 'faculty.cs@apex.edu', roles: ['FACULTY'] },
      student: {
        name: 'Alice Student',
        email: 'student.cs@apex.edu',
        rollNumber: 'AIT-CS-2025-001',
        roles: ['STUDENT'],
      },
    },
    'beacon-eng': {
      inst: seededInstitutions['beacon-eng'],
      admin: { name: 'Prof. Alan Turing', email: 'admin@beacon.edu', roles: ['ADMIN'] },
      hod: { name: 'Dr. Grace Hopper', email: 'hod.cs@beacon.edu', roles: ['HOD'] },
      faculty: { name: 'Prof. John von Neumann', email: 'faculty.cs@beacon.edu', roles: ['FACULTY'] },
      student: {
        name: 'Bob Student',
        email: 'student.cs@beacon.edu',
        rollNumber: 'BCE-CS-2025-001',
        roles: ['STUDENT'],
      },
    },
  };

  const seededUsers = {};

  for (const [subdomain, group] of Object.entries(tenantUsersDef)) {
    const instId = group.inst._id;
    seededUsers[subdomain] = {};

    console.log(c.cyan + `\n  --- Tenant: ${group.inst.name} (${subdomain}) ---` + c.reset);

    for (const [roleKey, userData] of Object.entries(group)) {
      if (roleKey === 'inst') continue;

      let user = await userDb.collection('users').findOne({
        email: userData.email,
        institutionId: instId,
      });

      if (!user) {
        const newId = new mongoose.Types.ObjectId();
        const doc = {
          _id: newId,
          name: userData.name,
          email: userData.email,
          rollNumber: userData.rollNumber || null,
          passwordHash,
          roles: userData.roles,
          institutionId: instId,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await userDb.collection('users').insertOne(doc);
        await authDb.collection('users').updateOne(
          { email: userData.email, institutionId: instId },
          { $set: doc },
          { upsert: true }
        );
        user = doc;
        console.log(`    ✔ Created ${userData.roles[0]}: ${userData.name} <${userData.email}>`);
      } else {
        const updatePayload = {
          name: userData.name,
          rollNumber: userData.rollNumber || user.rollNumber || null,
          passwordHash,
          roles: userData.roles,
          institutionId: instId,
          isActive: true,
          updatedAt: new Date(),
        };
        await userDb.collection('users').updateOne({ _id: user._id }, { $set: updatePayload });
        await authDb.collection('users').updateOne(
          { email: userData.email, institutionId: instId },
          { $set: updatePayload },
          { upsert: true }
        );
        console.log(`    ✔ Synced ${userData.roles[0]}: ${userData.name} <${userData.email}>`);
      }

      seededUsers[subdomain][roleKey] = user;

      // Link Admin user to Institution record
      if (roleKey === 'admin') {
        await userDb.collection('institutions').updateOne(
          { _id: instId },
          { $set: { adminUserId: user._id } }
        );
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. SEED OVERLAPPING DATA (Identical Department Codes & Subject Codes)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n' + c.bold + '[4/5] Seeding Overlapping Academic & Financial Data (Tenant-Isolation Test)...' + c.reset);

  for (const subdomain of ['apex-tech', 'beacon-eng']) {
    const inst = seededInstitutions[subdomain];
    const instId = inst._id;
    const users = seededUsers[subdomain];

    // 4a. Departments: Both institutions have Department CSE and ME
    const depts = [
      { name: 'Computer Science & Engineering', code: 'CSE' },
      { name: 'Mechanical Engineering', code: 'ME' },
    ];

    const seededDepts = {};
    for (const d of depts) {
      let dept = await userDb.collection('departments').findOne({
        institutionId: instId,
        code: d.code,
      });

      if (!dept) {
        const newId = new mongoose.Types.ObjectId();
        const doc = {
          _id: newId,
          institutionId: instId,
          name: d.name,
          code: d.code,
          createdBy: users.admin._id,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await userDb.collection('departments').insertOne(doc);
        dept = doc;
      } else {
        await userDb.collection('departments').updateOne(
          { _id: dept._id },
          { $set: { name: d.name, institutionId: instId } }
        );
      }
      seededDepts[d.code] = dept;
    }
    console.log(`  ✔ [${subdomain}] Seeded Departments: CSE and ME`);

    // 4b. Academic Hierarchy: Year 2 -> Semester 4 -> Section A
    const cseDeptId = seededDepts['CSE']._id;

    let year2 = await academicDb.collection('years').findOne({
      institutionId: instId,
      departmentId: cseDeptId,
      yearNumber: 2,
    });
    if (!year2) {
      const doc = {
        _id: new mongoose.Types.ObjectId(),
        institutionId: instId,
        departmentId: cseDeptId,
        yearNumber: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await academicDb.collection('years').insertOne(doc);
      year2 = doc;
    }

    let sem4 = await academicDb.collection('semesters').findOne({
      institutionId: instId,
      departmentId: cseDeptId,
      yearId: year2._id,
      semesterNumber: 4,
    });
    if (!sem4) {
      const doc = {
        _id: new mongoose.Types.ObjectId(),
        institutionId: instId,
        departmentId: cseDeptId,
        yearId: year2._id,
        semesterNumber: 4,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await academicDb.collection('semesters').insertOne(doc);
      sem4 = doc;
    }

    let sectionA = await academicDb.collection('sections').findOne({
      institutionId: instId,
      semesterId: sem4._id,
      name: 'Section A',
    });
    if (!sectionA) {
      const doc = {
        _id: new mongoose.Types.ObjectId(),
        institutionId: instId,
        semesterId: sem4._id,
        name: 'Section A',
        carriesForwardFrom: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await academicDb.collection('sections').insertOne(doc);
      sectionA = doc;
    }
    console.log(`  ✔ [${subdomain}] Academic Tree: Year 2 -> Semester 4 -> Section A`);

    // 4c. Overlapping Subjects: Both institutions have CS101 and CS102
    const subjectsDef = [
      { name: 'Data Structures & Algorithms', code: 'CS101', credits: 4 },
      { name: 'Database Management Systems', code: 'CS102', credits: 4 },
    ];

    const seededSubjects = {};
    for (const s of subjectsDef) {
      let subj = await academicDb.collection('subjects').findOne({
        institutionId: instId,
        code: s.code,
      });

      if (!subj) {
        const doc = {
          _id: new mongoose.Types.ObjectId(),
          institutionId: instId,
          departmentId: cseDeptId,
          name: s.name,
          code: s.code,
          credits: s.credits,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await academicDb.collection('subjects').insertOne(doc);
        subj = doc;
      } else {
        await academicDb.collection('subjects').updateOne(
          { _id: subj._id },
          { $set: { name: s.name, credits: s.credits, institutionId: instId } }
        );
      }
      seededSubjects[s.code] = subj;
    }
    console.log(`  ✔ [${subdomain}] Seeded Overlapping Subjects: CS101 & CS102`);

    // 4d. Teaching Assignment: CS101 -> Faculty
    await academicDb.collection('teachingassignments').updateOne(
      {
        institutionId: instId,
        subjectId: seededSubjects['CS101']._id,
        sectionId: sectionA._id,
      },
      {
        $set: {
          institutionId: instId,
          departmentId: cseDeptId,
          subjectId: seededSubjects['CS101']._id,
          facultyId: users.faculty._id,
          sectionId: sectionA._id,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    // 4e. RoleAssignments for HOD, Faculty, Student in user-service
    await userDb.collection('roleassignments').updateOne(
      { userId: users.hod._id, role: 'HOD', institutionId: instId },
      {
        $set: {
          userId: users.hod._id,
          role: 'HOD',
          institutionId: instId,
          departmentId: cseDeptId,
          validFrom: new Date(),
          validTo: null,
        },
      },
      { upsert: true }
    );

    await userDb.collection('roleassignments').updateOne(
      { userId: users.faculty._id, role: 'FACULTY', institutionId: instId },
      {
        $set: {
          userId: users.faculty._id,
          role: 'FACULTY',
          institutionId: instId,
          departmentId: cseDeptId,
          validFrom: new Date(),
          validTo: null,
        },
      },
      { upsert: true }
    );

    await userDb.collection('roleassignments').updateOne(
      { userId: users.student._id, role: 'STUDENT', institutionId: instId },
      {
        $set: {
          userId: users.student._id,
          role: 'STUDENT',
          institutionId: instId,
          departmentId: cseDeptId,
          sectionId: sectionA._id,
          validFrom: new Date(),
          validTo: null,
        },
      },
      { upsert: true }
    );

    // 4f. Distinct Campus Notice (with overlapping role & department targeting)
    const noticeTitle =
      subdomain === 'apex-tech'
        ? 'Mid-Term Examination Schedule - Apex Campus'
        : 'Mid-Term Examination Schedule - Beacon Campus';
    const noticeBody =
      subdomain === 'apex-tech'
        ? 'The mid-term exams for Apex Institute of Technology CSE will commence on October 15, 2026. Hall tickets are available on the portal.'
        : 'The mid-term exams for Beacon College of Engineering CSE will commence on October 20, 2026. Lab submissions must be completed prior.';

    await noticeDb.collection('notices').updateOne(
      { institutionId: instId, title: noticeTitle },
      {
        $set: {
          institutionId: instId,
          title: noticeTitle,
          body: noticeBody,
          attachments: [],
          targeting: {
            departments: [cseDeptId],
            years: [2],
            sections: [sectionA._id],
            roles: ['STUDENT', 'FACULTY'],
          },
          createdBy: users.admin._id,
          publishedAt: new Date(),
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );
    console.log(`  ✔ [${subdomain}] Seeded Notice: "${noticeTitle}"`);

    // 4g. Distinct Tuition Fees for the Exact Same Year 2 CSE Program
    // Apex: $55,000 vs Beacon: $48,000 (makes isolation bugs immediately visible!)
    const totalTuition = subdomain === 'apex-tech' ? 55000 : 48000;
    await feesDb.collection('feestructures').updateOne(
      { institutionId: instId, departmentId: cseDeptId, year: 2 },
      {
        $set: {
          institutionId: instId,
          departmentId: cseDeptId,
          year: 2,
          totalAmount: totalTuition,
          installments: [
            {
              label: 'Semester 4 Tuition',
              amount: totalTuition,
              dueDate: new Date('2026-11-01T00:00:00.000Z'),
            },
          ],
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );
    console.log(`  ✔ [${subdomain}] Seeded Fee Structure: Year 2 CSE = $${totalTuition.toLocaleString()}`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. CACHE INVALDATION (Flush Redis if reachable)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n' + c.bold + '[5/5] Flushing Gateway Redis Subdomain Cache...' + c.reset);
  try {
    const Redis = require(path.join(__dirname, '../../services/gateway/node_modules/ioredis'));
    const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 1000,
    });
    await redis.connect();
    await redis.del('tenant:subdomain:apex-tech');
    await redis.del('tenant:subdomain:beacon-eng');
    console.log(c.green + '  ✔ Invalided Redis tenant keys: "tenant:subdomain:apex-tech" & "beacon-eng"' + c.reset);
    await redis.quit();
  } catch (redisErr) {
    console.log(c.dim + '  ℹ Redis not active locally; skipped cache flush (clean direct DB lookup will be used).' + c.reset);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PRINT SUMMARY CREDENTIALS MATRIX
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n' + c.green + '==================================================================' + c.reset);
  console.log(c.bold + c.green + '          MULTI-TENANT SEEDING COMPLETED SUCCESSFULLY!             ' + c.reset);
  console.log(c.green + '==================================================================' + c.reset);

  console.log('\n' + c.bold + c.white + '🌐 ROOT DOMAIN (Platform Management)' + c.reset);
  console.log('   URL:         ' + c.cyan + 'http://localhost:5173/superadmin' + c.reset);
  console.log('   Email:       ' + c.yellow + 'superadmin@collegeerp.com' + c.reset);
  console.log('   Password:    ' + c.yellow + TEST_PASSWORD + c.reset);
  console.log('   Scope:       Global (institutionId: null) — manages all colleges');

  console.log('\n' + c.bold + c.magenta + '🏛️  TENANT 1: Apex Institute of Technology (apex-tech)' + c.reset);
  console.log('   Portal URL:  ' + c.cyan + 'http://apex-tech.localhost:5173/login' + c.reset);
  console.log('   Theme:       Primary ' + c.blue + '#4f46e5' + c.reset + ' | Secondary ' + c.cyan + '#06b6d4' + c.reset);
  console.log('   Users (Password: ' + c.yellow + TEST_PASSWORD + c.reset + '):');
  console.log('     • Admin:   ' + c.white + 'admin@apex.edu' + c.reset + ' (Dr. Jane Smith)');
  console.log('     • HOD:     ' + c.white + 'hod.cs@apex.edu' + c.reset + ' (Dr. Ada Lovelace — CSE)');
  console.log('     • Faculty: ' + c.white + 'faculty.cs@apex.edu' + c.reset + ' (Prof. Claude Shannon — CS101)');
  console.log('     • Student: ' + c.white + 'student.cs@apex.edu' + c.reset + ' (Alice Student — Roll: AIT-CS-2025-001)');
  console.log('   Data Check:  CSE Dept | CS101 | Notice: "...Apex Campus" | Fees: $55,000');

  console.log('\n' + c.bold + c.blue + '🏛️  TENANT 2: Beacon College of Engineering (beacon-eng)' + c.reset);
  console.log('   Portal URL:  ' + c.cyan + 'http://beacon-eng.localhost:5173/login' + c.reset);
  console.log('   Theme:       Primary ' + c.blue + '#0284c7' + c.reset + ' | Secondary ' + c.green + '#10b981' + c.reset);
  console.log('   Users (Password: ' + c.yellow + TEST_PASSWORD + c.reset + '):');
  console.log('     • Admin:   ' + c.white + 'admin@beacon.edu' + c.reset + ' (Prof. Alan Turing)');
  console.log('     • HOD:     ' + c.white + 'hod.cs@beacon.edu' + c.reset + ' (Dr. Grace Hopper — CSE)');
  console.log('     • Faculty: ' + c.white + 'faculty.cs@beacon.edu' + c.reset + ' (Prof. John von Neumann — CS101)');
  console.log('     • Student: ' + c.white + 'student.cs@beacon.edu' + c.reset + ' (Bob Student — Roll: BCE-CS-2025-001)');
  console.log('   Data Check:  CSE Dept | CS101 | Notice: "...Beacon Campus" | Fees: $48,000');

  console.log('\n' + c.bold + c.white + '🧪 CROSS-TENANT ISOLATION MANUAL TEST PROCEDURE:' + c.reset);
  console.log('   1. Open ' + c.cyan + 'http://apex-tech.localhost:5173/login' + c.reset + ' in Browser Tab A.');
  console.log('   2. Open ' + c.cyan + 'http://beacon-eng.localhost:5173/login' + c.reset + ' in Browser Tab B.');
  console.log('   3. Attempt to log in with ' + c.yellow + 'admin@beacon.edu' + c.reset + ' on Tab A -> Should be REJECTED (401).');
  console.log('   4. Log in with ' + c.yellow + 'student.cs@apex.edu' + c.reset + ' on Tab A and ' + c.yellow + 'student.cs@beacon.edu' + c.reset + ' on Tab B.');
  console.log('   5. Verify that Tab A displays Apex Notice & $55,000 fee, while Tab B displays Beacon Notice & $48,000 fee.');
  console.log('   6. Open ' + c.cyan + 'http://localhost:5173/superadmin' + c.reset + ' to manage both institutions platform-wide.\n');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('\n' + c.bold + '\x1b[31mSeed error:\x1b[0m', err);
  process.exit(1);
});
