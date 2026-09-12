const crypto = require('crypto');

/**
 * Middleware to extract and verify tenant context passed from the API Gateway.
 * Validates that if x-tenant-id is present, it comes with a valid x-internal-key or cryptographic signature.
 * Prevents attackers from spoofing x-tenant-id when directly calling microservices.
 * Supports being used directly as `app.use(verifyTenantContext)` or as a factory `app.use(verifyTenantContext())`.
 */
const verifyTenantContext = (...args) => {
  const handler = (req, res, next) => {
    const tenantId = req.headers['x-tenant-id'];
    const internalKey = req.headers['x-internal-key'];
    const signature = req.headers['x-tenant-signature'];
    const expectedKey = process.env.INTERNAL_SERVICE_KEY || '/^FdEq-yhAvZ|c!g*O9dF:!on:9qZ1*1+G&*5_(v@p=';

    if (!tenantId) {
      req.tenantId = null;
      return next();
    }

    // If a tenantId is claimed, verify internal authorization
    let isVerified = false;

    if (internalKey && internalKey === expectedKey) {
      // If signature is also provided, check HMAC
      if (signature) {
        const expectedSig = crypto
          .createHmac('sha256', expectedKey)
          .update(tenantId.toString())
          .digest('hex');
        if (signature === expectedSig) {
          isVerified = true;
        } else {
          return res.status(403).json({
            success: false,
            error: 'Forbidden: Invalid tenant signature'
          });
        }
      } else {
        isVerified = true;
      }
    } else if (signature && expectedKey) {
      const expectedSig = crypto
        .createHmac('sha256', expectedKey)
        .update(tenantId.toString())
        .digest('hex');
      if (signature === expectedSig) {
        isVerified = true;
      }
    }

    if (!isVerified) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Direct access without valid gateway signature is prohibited'
      });
    }

    req.tenantId = tenantId;
    if (req.headers['x-tenant-subdomain']) {
      req.tenantSubdomain = req.headers['x-tenant-subdomain'];
    }

    next();
  };

  // If called directly as middleware: verifyTenantContext(req, res, next)
  if (args.length === 3 && typeof args[2] === 'function') {
    return handler(args[0], args[1], args[2]);
  }

  // If called as factory: app.use(verifyTenantContext())
  return handler;
};

module.exports = { verifyTenantContext };
