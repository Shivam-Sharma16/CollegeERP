const jwt = require('jsonwebtoken');

const authenticate = (req, res, next) => {
  try {
    let token = null;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken; // If stored in cookie
    }

    if (!token) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }

    const secret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || 'ny+cq<I;(UL.LR#vzDM2j4>*Xc8^|4l^woMWm#|.iD0';
    const decoded = jwt.verify(token, secret);
    
    req.user = {
      ...decoded,
      roles: decoded.roles || []
    };
    req.institutionId = decoded.institutionId ? decoded.institutionId.toString() : null;

    // Tenant Replay Protection (Phase 66)
    // Every subsequent authenticated request re-validates req.user.institutionId === req.tenantId
    const currentTenantId = req.tenantId || req.headers['x-tenant-id'] || null;
    const tokenTenantId = req.user.institutionId ? req.user.institutionId.toString() : null;

    req.tenantId = currentTenantId || tokenTenantId || null;

    if (currentTenantId) {
      // Current request is scoped to a specific institution/tenant subdomain
      if (!req.user.roles?.includes('SUPERADMIN') && (!tokenTenantId || tokenTenantId !== currentTenantId.toString())) {
        return res.status(401).json({
          success: false,
          error: 'Token tenant mismatch: JWT issued for a different institution cannot be used on this tenant domain'
        });
      }
    } else {
      // Root domain / global scope (no req.tenantId)
      // Tenant-scoped JWT cannot access root platform endpoints
      if (tokenTenantId !== null && !req.user.roles?.includes('SUPERADMIN')) {
        return res.status(401).json({
          success: false,
          error: 'Token tenant mismatch: Tenant-scoped JWT cannot be used on root platform domain'
        });
      }
    }

    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
};

module.exports = { authenticate };
