require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const http = require('http');
const env = require('./config/env');
const connectDB = require('./config/db');
const { initSocket } = require('./socket');

const healthRoute = require('./routes/health.route');
const notificationRoute = require('./routes/notification.route');
const internalRoute = require('./routes/internal.route');

const app = express();
const server = http.createServer(app);

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Health
app.use('/', healthRoute);

// Public REST routes — require user JWT
app.use('/notifications', notificationRoute);
app.use('/api/notifications', notificationRoute);

// Internal routes — require x-internal-key header (service-to-service only)
app.use('/internal', internalRoute);

// Initialize Socket.IO (JWT-authenticated handshake, room-per-user)
initSocket(server);

connectDB();

server.listen(env.PORT, () => {
  console.log(`[${env.PORT}] notification-service started`);
});
