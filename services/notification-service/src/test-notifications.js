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

async function runTest() {
  const uri = (process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/college-erp-dev').replace('mongodb://mongo:', 'mongodb://127.0.0.1:');
  await mongoose.connect(uri);
  console.log('Connected to DB');

  await Notification.deleteMany({});

  // Setup express & socket.io server for test
  const app = express();
  const server = http.createServer(app);
  initSocket(server);

  await new Promise((resolve) => {
    server.listen(0, () => resolve());
  });

  const assignedPort = server.address().port;
  console.log(`Test server running on port ${assignedPort}`);

  const connectedUserId = new mongoose.Types.ObjectId();
  const disconnectedUserId = new mongoose.Types.ObjectId();
  const jwtSecret = process.env.JWT_SECRET || 'fallback_secret';

  // Generate tokens
  const connectedUserToken = jwt.sign({ userId: connectedUserId.toString() }, jwtSecret);
  const disconnectedUserToken = jwt.sign({ userId: disconnectedUserId.toString() }, jwtSecret);

  // Connect client
  const clientSocket = Client(`http://localhost:${assignedPort}`, {
    auth: { token: connectedUserToken }
  });

  await new Promise((resolve) => {
    clientSocket.on('connect', () => {
      console.log('Test Client connected!');
      resolve();
    });
  });

  let receivedNotification = null;

  clientSocket.on('notification', (data) => {
    console.log('Client received notification via socket!');
    receivedNotification = data;
  });

  // Small delay to ensure server processed the `socket.join(userId)`
  await new Promise(r => setTimeout(r, 100));

  console.log('\\n--- Creating Notification for Connected User ---');
  await createNotification(connectedUserId, 'TEST_EVENT', { msg: 'Hello connected user!' });

  // Wait for up to 1 second for socket emit
  let waitCount = 0;
  while (!receivedNotification && waitCount < 10) {
    await new Promise(r => setTimeout(r, 100));
    waitCount++;
  }

  if (receivedNotification && receivedNotification.payload.msg === 'Hello connected user!') {
    console.log('✅ TEST PASSED: Connected user received the notification within 1s.');
  } else {
    console.error('❌ TEST FAILED: Connected user did not receive the notification.');
  }

  console.log('\\n--- Creating Notification for Disconnected User ---');
  await createNotification(disconnectedUserId, 'TEST_EVENT_OFFLINE', { msg: 'Hello offline user!' });

  // Wait a tiny bit for DB save
  await new Promise(r => setTimeout(r, 100));

  const offlineRecord = await Notification.findOne({ userId: disconnectedUserId });
  if (offlineRecord && offlineRecord.read === false && offlineRecord.payload.msg === 'Hello offline user!') {
    console.log('✅ TEST PASSED: Disconnected user notification was persisted as unread.');
  } else {
    console.error('❌ TEST FAILED: Disconnected user notification missing or incorrect.');
  }

  // Cleanup
  clientSocket.disconnect();
  server.close();
  await mongoose.disconnect();
}

runTest().catch(console.error);
