require('dotenv').config();
const express = require('express');
const helmet  = require('helmet');
const cors    = require('cors');
const morgan  = require('morgan');
const env     = require('./config/env');
const connectDB = require('./config/db');

const healthRoute = require('./routes/health.route');
const agentRoute  = require('./routes/agent.route');

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Health check
app.use('/', healthRoute);

// Agent endpoints — JWT authenticated
app.use('/api/agents', agentRoute);

// Global error handler
app.use((err, req, res, _next) => {
  console.error('[ai-agent-service] Unhandled error:', err.message);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

connectDB();

app.listen(env.PORT, () => {
  console.log(`[${env.PORT}] ai-agent-service started`);
});
