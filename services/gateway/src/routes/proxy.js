const http = require('http');
const env = require('../config/env');

function forward(targetBaseUrl, req, res) {
  const target = new URL(targetBaseUrl);
  const targetPath = req.originalUrl;

  const headers = { ...req.headers };
  headers.host = `${target.hostname}:${target.port}`;
  headers['x-forwarded-host'] = req.headers.host;
  headers['x-forwarded-proto'] = req.protocol;
  headers['x-forwarded-for'] = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

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
  // 1. Auth Service
  app.use(['/api/auth', '/auth'], (req, res) => forward(env.AUTH_SERVICE_URL, req, res));

  // 2. User Service (Institutions, Users, Departments, Audit, Reports, Settings)
  app.use([
    '/api/institutions', '/institutions',
    '/api/users', '/users', 
    '/api/departments', '/departments',
    '/api/audit', '/audit',
    '/api/reports', '/reports',
    '/api/settings', '/settings'
  ], (req, res) => forward(env.USER_SERVICE_URL, req, res));

  // 3. Academic Service
  app.use([
    '/api/academics',
    '/api/subjects', '/subjects',
    '/api/years', '/years',
    '/api/semesters', '/semesters',
    '/api/sections', '/sections',
    '/api/teaching-assignments', '/teaching-assignments',
    '/api/section-assignments', '/section-assignments'
  ], (req, res) => forward(env.ACADEMIC_SERVICE_URL, req, res));

  // 4. Attendance Service
  app.use(['/api/attendance', '/sessions', '/records', '/summary'], (req, res) => forward(env.ATTENDANCE_SERVICE_URL, req, res));

  // 5. Results Service
  app.use(['/api/results', '/exam-types', '/marks', '/students'], (req, res) => forward(env.RESULTS_SERVICE_URL, req, res));

  // 6. Fees Service
  app.use(['/api/fees', '/fees'], (req, res) => forward(env.FEES_SERVICE_URL, req, res));

  // 7. Notice Service
  app.use(['/api/notice', '/api/notices', '/notice', '/notices'], (req, res) => forward(env.NOTICE_SERVICE_URL, req, res));

  // 8. Notification Service
  app.use(['/api/notifications', '/notifications'], (req, res) => forward(env.NOTIFICATION_SERVICE_URL, req, res));

  // 9. AI Agent Service
  app.use(['/api/agents', '/api/ai', '/agents'], (req, res) => forward(env.AI_AGENT_SERVICE_URL, req, res));
}

module.exports = { registerProxies, forward };
