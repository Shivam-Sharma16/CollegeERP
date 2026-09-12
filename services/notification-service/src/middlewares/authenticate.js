const jwt = require('jsonwebtoken');
const env = require('../config/env');

/**
 * Express middleware: validates Bearer JWT and attaches decoded payload to req.user.
 * Returns 401 if the token is missing, malformed, or expired.
 */
const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, env.JWT_SECRET);
    req.user = decoded;
    req.tenantId = req.headers['x-tenant-id'] || decoded.institutionId || null;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
};

module.exports = { authenticate };
