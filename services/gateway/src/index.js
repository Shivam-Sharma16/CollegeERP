require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const env = require('./config/env');
const connectDB = require('./config/db');
const { getRedisClient } = require('./config/redis');
const { tenantResolver } = require('./middlewares/tenantResolver.middleware');
const { registerProxies } = require('./routes/proxy');

const healthRoute = require('./routes/health.route');

const app = express();

// 1. Security Headers
app.use(helmet());

// 2. CORS Allowlist (accept *.localhost in dev mode per Phase 65)
const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests (curl, mobile apps, postman)
    if (!origin) return callback(null, true);

    if (process.env.NODE_ENV !== 'production') {
      try {
        const parsed = new URL(origin);
        // Accept localhost, 127.0.0.1, or any *.localhost subdomain in development
        if (
          parsed.hostname === 'localhost' ||
          parsed.hostname === '127.0.0.1' ||
          parsed.hostname.endsWith('.localhost')
        ) {
          return callback(null, true);
        }
      } catch (e) {
        // invalid URL format falls through to rejection
      }
    }

    // Default allowed origins in production
    const allowed = [
      'https://collegeerp.com',
      'https://www.collegeerp.com'
    ];
    if (allowed.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true
};

app.use(cors(corsOptions));
app.use(morgan('dev'));
app.use(express.json());

// 3. Connect Database & Redis
connectDB();
getRedisClient();

// 4. Mount root health route (before tenant resolution)
app.use('/', healthRoute);

// 5. Core Tenant Resolution Middleware
// Runs on every incoming request before downstream routing
app.use(tenantResolver);

// 6. Tenant Debug Endpoint (Phase 65 requirement)
app.get(['/api/debug/tenant', '/debug/tenant'], (req, res) => {
  if (req.isSuperAdminRoute || !req.tenantId) {
    return res.status(200).json({
      success: true,
      data: {
        isGlobal: true,
        tenantId: null,
        message: 'Global/no-tenant request (SuperAdmin scope)'
      }
    });
  }

  return res.status(200).json({
    success: true,
    data: {
      tenantId: req.tenantId,
      subdomain: req.tenantSubdomain,
      institution: req.institution
    }
  });
});

// 7. Mount reverse proxies for microservices
registerProxies(app);

app.listen(env.PORT, () => {
  console.log(`[${env.PORT}] Gateway started with multi-tenant resolution`);
});

process.on('uncaughtException', (err) => {
  console.error('[Gateway Uncaught Exception]:', err.message, err.stack);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Gateway Unhandled Rejection]:', reason);
});

module.exports = app;
