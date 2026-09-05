/**
 * Comprehensive integration test for the notification-service.
 *
 * Run from the service root:
 *   node src/test-notifications.js
 *
 * Environment: reads from .env (dotenv) or environment variables.
 * Requires a live MongoDB instance.
 */
require('dotenv').config();
const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { io: Client } = require('socket.io-client');

const { initSocket } = require('./socket');
const { createNotification } = require('./services/notification.service');
const Notification = require('./models/Notification.model');
const env = require('./config/env');

// ─── Helpers ──────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}`);
    failed++;
  }
}

async function httpRequest(method, port, path, { body, headers } = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data ? Buffer.byteLength(data) : 0,
          ...headers,
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(raw) });
          } catch {
            resolve({ status: res.statusCode, body: raw });
          }
        });
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function runTest() {
  // Connect to local MongoDB (swap docker hostname for 127.0.0.1)
  const uri = (process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/notification-service-test')
    .replace('mongodb://mongo:', 'mongodb://127.0.0.1:');

  await mongoose.connect(uri);
  console.log('✔ Connected to MongoDB\n');

  await Notification.deleteMany({});

  // Spin up the full app on a random port
  const app = express();
  app.use(express.json());

  const server = http.createServer(app);
  initSocket(server);

  // Mount routes the same way index.js does
  app.use('/', require('./routes/health.route'));
  app.use('/api/notifications', require('./routes/notification.route'));
  app.use('/internal', require('./routes/internal.route'));

  await new Promise((resolve) => server.listen(0, resolve));
  const PORT = server.address().port;
  console.log(`✔ Test server listening on port ${PORT}\n`);

  // Users
  const connectedUserId = new mongoose.Types.ObjectId();
  const disconnectedUserId = new mongoose.Types.ObjectId();
  const jwtSecret = env.JWT_SECRET;
  const internalKey = env.INTERNAL_SERVICE_KEY;

  const connectedUserToken = jwt.sign({ userId: connectedUserId.toString() }, jwtSecret);
  const disconnectedUserToken = jwt.sign({ userId: disconnectedUserId.toString() }, jwtSecret);

  // ── Connect a socket client ──────────────────────────────────────────────
  const clientSocket = Client(`http://127.0.0.1:${PORT}`, {
    auth: { token: connectedUserToken },
  });

  await new Promise((resolve, reject) => {
    clientSocket.on('connect', resolve);
    clientSocket.on('connect_error', reject);
  });
  console.log(`✔ Socket client connected (userId=${connectedUserId})\n`);

  let receivedViaSocket = null;
  clientSocket.on('notification', (data) => {
    receivedViaSocket = data;
  });

  // small delay so socket.join(userId) is processed
  await new Promise((r) => setTimeout(r, 100));

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 1: Socket.IO auth rejects bad / missing tokens
  // ══════════════════════════════════════════════════════════════════════════
  console.log('── Section 1: Socket.IO authentication ──────────────────────────');

  await new Promise((resolve) => {
    const badSocket = Client(`http://127.0.0.1:${PORT}`, { auth: { token: 'bad.token.here' } });
    badSocket.on('connect_error', (err) => {
      assert(/invalid token/i.test(err.message), 'Bad JWT → socket connect_error');
      badSocket.disconnect();
      resolve();
    });
    badSocket.on('connect', () => {
      assert(false, 'Bad JWT → should NOT connect');
      badSocket.disconnect();
      resolve();
    });
    setTimeout(resolve, 2000); // safety timeout
  });

  await new Promise((resolve) => {
    const noAuthSocket = Client(`http://127.0.0.1:${PORT}`, { auth: {} });
    noAuthSocket.on('connect_error', (err) => {
      assert(/token missing/i.test(err.message), 'Missing JWT → socket connect_error');
      noAuthSocket.disconnect();
      resolve();
    });
    noAuthSocket.on('connect', () => {
      assert(false, 'Missing JWT → should NOT connect');
      noAuthSocket.disconnect();
      resolve();
    });
    setTimeout(resolve, 2000);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 2: POST /internal/events — key validation
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n── Section 2: /internal/events — key guard ──────────────────────');

  const noKeyRes = await httpRequest('POST', PORT, '/internal/events', {
    body: { userId: connectedUserId, type: 'TEST', payload: {} },
    // deliberately no x-internal-key header
  });
  assert(noKeyRes.status === 401, 'No key → 401');
  assert(noKeyRes.body.success === false, 'No key → body.success false');

  const wrongKeyRes = await httpRequest('POST', PORT, '/internal/events', {
    body: { userId: connectedUserId, type: 'TEST', payload: {} },
    headers: { 'x-internal-key': 'wrong-key' },
  });
  assert(wrongKeyRes.status === 401, 'Wrong key → 401');

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 3: POST /internal/events — valid call triggers socket push
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n── Section 3: /internal/events — valid call ─────────────────────');

  const validEventRes = await httpRequest('POST', PORT, '/internal/events', {
    body: { userId: connectedUserId, type: 'SESSION_CLOSED', payload: { msg: 'Class ended' } },
    headers: { 'x-internal-key': internalKey },
  });
  assert(validEventRes.status === 201, 'Valid key → 201');
  assert(validEventRes.body.success === true, 'Valid key → body.success true');
  assert(validEventRes.body.data.type === 'SESSION_CLOSED', 'Response has correct type');

  // Wait up to 1 s for the socket push
  let waited = 0;
  while (!receivedViaSocket && waited < 10) {
    await new Promise((r) => setTimeout(r, 100));
    waited++;
  }
  assert(
    receivedViaSocket && receivedViaSocket.payload.msg === 'Class ended',
    'Connected user received notification via socket within 1 s'
  );

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 4: Offline user — notification persisted but not pushed
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n── Section 4: Offline user — DB persistence ─────────────────────');

  await httpRequest('POST', PORT, '/internal/events', {
    body: { userId: disconnectedUserId, type: 'FEE_OVERDUE', payload: { amount: 5000 } },
    headers: { 'x-internal-key': internalKey },
  });

  await new Promise((r) => setTimeout(r, 100));
  const offlineRecord = await Notification.findOne({ userId: disconnectedUserId });
  assert(offlineRecord !== null, 'Offline user notification persisted in DB');
  assert(offlineRecord.read === false, 'Persisted notification starts as unread');
  assert(offlineRecord.payload.amount === 5000, 'Payload preserved correctly');

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 5: GET /api/notifications
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n── Section 5: GET /api/notifications ───────────────────────────');

  const noAuthGet = await httpRequest('GET', PORT, '/api/notifications');
  assert(noAuthGet.status === 401, 'GET without JWT → 401');

  const getRes = await httpRequest('GET', PORT, '/api/notifications', {
    headers: { Authorization: `Bearer ${connectedUserToken}` },
  });
  assert(getRes.status === 200, 'GET with JWT → 200');
  assert(Array.isArray(getRes.body.data), 'Response data is array');
  assert(getRes.body.data.length === 1, 'Connected user sees 1 notification');
  assert(getRes.body.meta.total === 1, 'Meta total = 1');

  // unreadOnly filter
  const unreadRes = await httpRequest('GET', PORT, '/api/notifications?unreadOnly=true', {
    headers: { Authorization: `Bearer ${connectedUserToken}` },
  });
  assert(unreadRes.body.data.length === 1, 'unreadOnly=true returns the unread notification');

  const notificationId = getRes.body.data[0]._id;

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 6: PATCH /api/notifications/:id/read
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n── Section 6: PATCH /:id/read ───────────────────────────────────');

  const markRes = await httpRequest('PATCH', PORT, `/api/notifications/${notificationId}/read`, {
    headers: { Authorization: `Bearer ${connectedUserToken}` },
  });
  assert(markRes.status === 200, 'PATCH /:id/read → 200');
  assert(markRes.body.data.read === true, 'Notification marked as read');

  // Verify via GET that unreadOnly now returns empty
  const postMarkUnread = await httpRequest('GET', PORT, '/api/notifications?unreadOnly=true', {
    headers: { Authorization: `Bearer ${connectedUserToken}` },
  });
  assert(postMarkUnread.body.data.length === 0, 'unreadOnly=true returns 0 after mark-read');

  // Ownership guard — disconnected user can't mark connected user's notification
  const wrongOwnerRes = await httpRequest(
    'PATCH',
    PORT,
    `/api/notifications/${notificationId}/read`,
    { headers: { Authorization: `Bearer ${disconnectedUserToken}` } }
  );
  assert(wrongOwnerRes.status === 404, 'Wrong owner → 404 (not 200)');

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 7: PATCH /api/notifications/read-all
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n── Section 7: PATCH /read-all ───────────────────────────────────');

  // Create another unread notification for connectedUser
  await createNotification(connectedUserId, 'EXTRA', { x: 1 });
  await createNotification(connectedUserId, 'EXTRA', { x: 2 });

  const readAllRes = await httpRequest('PATCH', PORT, '/api/notifications/read-all', {
    headers: { Authorization: `Bearer ${connectedUserToken}` },
  });
  assert(readAllRes.status === 200, 'PATCH /read-all → 200');
  assert(readAllRes.body.data.modifiedCount === 2, 'read-all modified exactly 2 unread docs');

  // Confirm nothing unread remains
  const zeroUnread = await httpRequest('GET', PORT, '/api/notifications?unreadOnly=true', {
    headers: { Authorization: `Bearer ${connectedUserToken}` },
  });
  assert(zeroUnread.body.data.length === 0, 'No unread notifications remain after read-all');

  // ══════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ══════════════════════════════════════════════════════════════════════════
  console.log(`\n${'═'.repeat(55)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed === 0) {
    console.log('🎉 All tests passed!');
  } else {
    console.error('💥 Some tests failed — see above.');
    process.exitCode = 1;
  }

  // Cleanup
  clientSocket.disconnect();
  server.close();
  await mongoose.disconnect();
}

runTest().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
