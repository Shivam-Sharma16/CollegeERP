const env = require('../config/env');

/**
 * Express middleware: protects internal-only routes with a shared service key.
 * Callers must send the header:  x-internal-key: <INTERNAL_SERVICE_KEY>
 *
 * This is intentionally NOT a JWT check — it's a symmetric secret shared only
 * between backend services, never exposed to public clients.
 */
const internalAuth = (req, res, next) => {
  const providedKey = req.headers['x-internal-key'];

  if (!providedKey || providedKey !== env.INTERNAL_SERVICE_KEY) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  next();
};

module.exports = { internalAuth };
