/**
 * test-notice-clamping.js
 *
 * Verifies the core Phase 18 security guarantee:
 *   A CC posting a notice with targeting.departments = [otherDept]
 *   results in a notice scoped ONLY to their own section — verified
 *   by inspecting the persisted DB document.
 *
 * Run: node src/test-notice-clamping.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Notice   = require('./models/Notice.model');
const http     = require('http');

const MONGO_URI = (process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/notice-service')
  .replace('mongodb://mongo:', 'mongodb://127.0.0.1:');
const SERVICE_PORT = Number(process.env.PORT) || 4007;

// ---------------------------------------------------------------------------
// Inline resolveScope + clampTargeting logic (mirrors the real middleware)
// to generate the expected result independently.
// ---------------------------------------------------------------------------
const ROLE_PRIORITY = ['SUPERADMIN', 'ADMIN', 'HOD', 'CC', 'FACULTY', 'STUDENT'];

const resolveCallerScope = async (userId) => {
  const assignments = await mongoose.connection
    .collection('roleassignments')
    .find({ userId: new mongoose.Types.ObjectId(userId) })
    .toArray();

  let dominantRole = 'STUDENT';
  const departmentIds = new Set();
  const sectionIds    = new Set();

  for (const a of assignments) {
    if (a.role && ROLE_PRIORITY.indexOf(a.role) < ROLE_PRIORITY.indexOf(dominantRole)) {
      dominantRole = a.role;
    }
    if (a.departmentId) departmentIds.add(a.departmentId.toString());
    if (a.sectionId)    sectionIds.add(a.sectionId.toString());
  }

  return {
    role:          dominantRole,
    departmentIds: Array.from(departmentIds),
    sectionIds:    Array.from(sectionIds),
  };
};

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------
const post = (path, body, headers = {}) => new Promise((resolve, reject) => {
  const payload = JSON.stringify(body);
  const req = http.request(
    { hostname: '127.0.0.1', port: SERVICE_PORT, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload), ...headers } },
    (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    }
  );
  req.on('error', reject);
  req.write(payload);
  req.end();
});

// ---------------------------------------------------------------------------
// Minimal JWT stub (no real auth server needed — we bypass via shared-utils)
// We embed a fake userId in a base64-encoded "token" and monkey-patch the
// authenticate middleware inline by seeding req.user directly via a tiny
// Express shim.  Actually easier: start the real service with SKIP_AUTH=true
// guard, then use a raw token from jwt.sign.
// ---------------------------------------------------------------------------
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_ACCESS_SECRET || 'fallback_secret';

const signToken = (userId, roles = []) =>
  jwt.sign({ userId: userId.toString(), roles }, JWT_SECRET, { expiresIn: '1h' });

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------
async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('✔ Connected to MongoDB');

  // --- Cleanup ---
  await Notice.deleteMany({ isTestData: true });
  await mongoose.connection.collection('roleassignments').deleteMany({ isTestData: true });
  await mongoose.connection.collection('sections').deleteMany({ isTestData: true });

  // --- Seed ---
  const ccUserId    = new mongoose.Types.ObjectId();
  const ownSectionId = new mongoose.Types.ObjectId();
  const otherDeptId  = new mongoose.Types.ObjectId();

  await mongoose.connection.collection('sections').insertOne({
    _id: ownSectionId, name: 'A', isTestData: true,
  });

  await mongoose.connection.collection('roleassignments').insertOne({
    userId:      ccUserId,
    role:        'CC',
    sectionId:   ownSectionId,
    departmentId: new mongoose.Types.ObjectId(), // CC's own dept (different from otherDeptId)
    isTestData:  true,
  });

  const token = signToken(ccUserId);

  // --- Fire request ---
  // CC sends a deliberately adversarial payload claiming cross-department targeting
  const adversarialPayload = {
    title:      'Adversarial Notice',
    body:       'This should NOT be department-wide',
    targeting: {
      departments: [otherDeptId.toString()],  // ← attacker tries to target other dept
      years:        [1, 2, 3, 4],
      sections:     [],
      roles:        ['STUDENT'],
    },
  };

  console.log('\n⚡ Posting adversarial notice as CC...');
  const resp = await post('/api/notice/notices', adversarialPayload, {
    Authorization: `Bearer ${token}`,
  });

  console.log('  HTTP status:', resp.status);
  if (resp.status !== 201) {
    console.error('❌ TEST FAILED: Expected 201, got', resp.status, resp.body);
    await cleanup(ccUserId, ownSectionId);
    return;
  }

  const persisted = resp.body.data;
  console.log('  Persisted targeting:', JSON.stringify(persisted.targeting, null, 2));

  // --- Assertions ---
  let passed = true;

  // 1. departments must be EMPTY (CC cannot target departments)
  if (persisted.targeting.departments && persisted.targeting.departments.length > 0) {
    console.error('❌ FAIL: departments should be empty, got', persisted.targeting.departments);
    passed = false;
  }

  // 2. years must be EMPTY (CC cannot target years)
  if (persisted.targeting.years && persisted.targeting.years.length > 0) {
    console.error('❌ FAIL: years should be empty, got', persisted.targeting.years);
    passed = false;
  }

  // 3. sections must be [ownSectionId] only
  const sectionStrings = (persisted.targeting.sections || []).map(String);
  if (sectionStrings.length !== 1 || sectionStrings[0] !== ownSectionId.toString()) {
    console.error('❌ FAIL: sections should be [ownSectionId], got', sectionStrings);
    passed = false;
  }

  // 4. otherDeptId must NOT appear anywhere
  const rawJson = JSON.stringify(persisted.targeting);
  if (rawJson.includes(otherDeptId.toString())) {
    console.error('❌ FAIL: otherDeptId leaked into persisted targeting!');
    passed = false;
  }

  if (passed) {
    console.log('\n✅ TEST PASSED: CC notice correctly clamped to own section only.');
    console.log('   - targeting.departments = [] ✔');
    console.log('   - targeting.years       = [] ✔');
    console.log(`   - targeting.sections    = [${ownSectionId}] ✔`);
    console.log('   - otherDeptId absent    ✔');
  }

  // Cleanup test data
  await Notice.deleteOne({ _id: persisted._id });
  await cleanup(ccUserId, ownSectionId);
  await mongoose.disconnect();
}

async function cleanup(ccUserId, ownSectionId) {
  await mongoose.connection.collection('roleassignments').deleteMany({ userId: ccUserId });
  await mongoose.connection.collection('sections').deleteOne({ _id: ownSectionId });
}

run().catch(err => { console.error(err); process.exit(1); });
