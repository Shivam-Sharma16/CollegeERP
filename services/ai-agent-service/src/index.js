require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const env = require('./config/env');
const connectDB = require('./config/db');

const healthRoute = require('./routes/health.route');

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Mount health route
app.use('/', healthRoute);

// Placeholder for feature routes
// app.use('/api/ai-agent', require('./routes/ai-agent.route'));

connectDB();

app.listen(env.PORT, () => {
  console.log(`[${env.PORT}] ${'ai-agent-service'} started`);
});
