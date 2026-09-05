const jwt = require('jsonwebtoken');
const env = require('../config/env');

/**
 * Express middleware: validates Bearer JWT and sets req.user = decoded payload.
 * Returns 401 if token is missing, malformed, or expired.
 */
const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }
    const token   = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
};

module.exports = { authenticate };
