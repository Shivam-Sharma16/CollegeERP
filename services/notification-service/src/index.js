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

const app = express();
const server = http.createServer(app);

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Mount health route
app.use('/', healthRoute);

// Placeholder for feature routes
// app.use('/api/notification', require('./routes/notification.route'));

// Initialize Socket.IO
initSocket(server);

connectDB();

server.listen(env.PORT, () => {
  console.log(`[${env.PORT}] notification-service started`);
});
