const http = require('http');
const crypto = require('crypto');
const env = require('../config/env');

function forward(targetBaseUrl, req, res) {
  const target = new URL(targetBaseUrl);
  const targetPath = req.originalUrl;

  const headers = { ...req.headers };

  // 1. Strip any client-supplied internal headers to prevent spoofing
  delete headers['x-tenant-id'];
  delete headers['x-tenant-subdomain'];
  delete headers['x-internal-key'];
  delete headers['x-tenant-signature'];

  // 2. Standard proxy headers
  headers.host = `${target.hostname}:${target.port}`;
  headers['x-forwarded-host'] = req.headers['x-forwarded-host'] || req.headers.host;
  headers['x-forwarded-proto'] = req.protocol;
  headers['x-forwarded-for'] = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  // 3. Attach verified tenant context
  if (req.tenantId) {
    headers['x-tenant-id'] = req.tenantId.toString();
    if (req.tenantSubdomain) {
      headers['x-tenant-subdomain'] = req.tenantSubdomain;
    }
  }

  // 4. Attach internal authentication and signature
  if (env.INTERNAL_SERVICE_KEY) {
    headers['x-internal-key'] = env.INTERNAL_SERVICE_KEY;
    if (req.tenantId) {
      const signature = crypto
        .createHmac('sha256', env.INTERNAL_SERVICE_KEY)
        .update(req.tenantId.toString())
        .digest('hex');
      headers['x-tenant-signature'] = signature;
    }
  }

  const options = {
    hostname: target.hostname,
    port: target.port,
    path: targetPath,
    method: req.method,
    headers: headers,
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error(`[Gateway Proxy Error] ${req.method} ${targetPath} -> ${targetBaseUrl}:`, err.message);
    if (!res.headersSent) {
      res.status(502).json({ success: false, error: `Service unavailable: ${err.message}` });
    }
  });

  if (req.body && Object.keys(req.body).length > 0) {
    const bodyData = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
    proxyReq.setHeader('Content-Type', req.headers['content-type'] || 'application/json');
    proxyReq.write(bodyData);
    proxyReq.end();
  } else {
    req.pipe(proxyReq);
  }
}

function registerProxies(app) {
  // 1. Auth Service (including root domain SuperAdmin login/signup)
  app.use([
    '/api/auth', '/auth',
    '/superadmin/login', '/superadmin-login', '/api/superadmin/login',
    '/superadmin/signup', '/superadmin-signup', '/api/superadmin/signup'
  ], (req, res) => forward(env.AUTH_SERVICE_URL, req, res));

  // 2. Institution Service (Institutions, Multi-tenant onboarding, Theme resolution)
  app.use(['/api/institutions', '/institutions'], (req, res) => forward(env.INSTITUTION_SERVICE_URL, req, res));

  // 3. User Service (Users, Departments, Audit, Reports, Settings)
  app.use([
    '/api/users', '/users', 
    '/api/departments', '/departments',
    '/api/audit', '/audit',
    '/api/reports', '/reports',
    '/api/settings', '/settings'
  ], (req, res) => forward(env.USER_SERVICE_URL, req, res));

  // 4. Academic Service
  app.use([
    '/api/academics',
    '/api/subjects', '/subjects',
    '/api/years', '/years',
    '/api/semesters', '/semesters',
    '/api/sections', '/sections',
    '/api/teaching-assignments', '/teaching-assignments',
    '/api/section-assignments', '/section-assignments'
  ], (req, res) => forward(env.ACADEMIC_SERVICE_URL, req, res));

  // 5. Attendance Service
  app.use(['/api/attendance', '/sessions', '/records', '/summary'], (req, res) => forward(env.ATTENDANCE_SERVICE_URL, req, res));

  // 6. Results Service
  app.use(['/api/results', '/exam-types', '/marks', '/students'], (req, res) => forward(env.RESULTS_SERVICE_URL, req, res));

  // 7. Fees Service
  app.use(['/api/fees', '/fees'], (req, res) => forward(env.FEES_SERVICE_URL, req, res));

  // 8. Notice Service
  app.use(['/api/notice', '/api/notices', '/notice', '/notices'], (req, res) => forward(env.NOTICE_SERVICE_URL, req, res));

  // 9. Notification Service
  app.use(['/api/notifications', '/notifications'], (req, res) => forward(env.NOTIFICATION_SERVICE_URL, req, res));

  // 10. AI Agent Service
  app.use(['/api/agents', '/api/ai', '/agents'], (req, res) => forward(env.AI_AGENT_SERVICE_URL, req, res));
}

module.exports = { registerProxies, forward };
