const mongoose = require('mongoose');
const redisModule = require('../config/redis');

const ROOT_DOMAINS = new Set([
  'collegeerp.com',
  'www.collegeerp.com',
  'localhost',
  '127.0.0.1'
]);

const CACHE_TTL_SECONDS = 300; // 5 minutes TTL

/**
 * Tenant Resolution Middleware (Gateway-level)
 * Runs before any other business logic or microservice proxies.
 */
const tenantResolver = async (req, res, next) => {
  try {
    // 1. Read Host header (support x-forwarded-host from reverse proxies/Vite)
    const rawHost = (req.headers['x-forwarded-host'] || req.headers['host'] || '').toLowerCase().trim();
    const host = rawHost.split(':')[0]; // Strip port (e.g. jecrc.localhost:5173 -> jecrc.localhost)
    const path = req.path || req.url || '';

    // Allow health checks and check-subdomain to bypass tenant resolution
    if (
      path === '/health' ||
      path === '/api/health' ||
      path === '/' ||
      path.includes('check-subdomain')
    ) {
      req.tenantId = null;
      return next();
    }

    // 2. Check if it matches root domain exactly with no subdomain
    const isRootDomain = ROOT_DOMAINS.has(host);

    if (isRootDomain) {
      // Check if client explicitly passed an x-tenant-subdomain header for testing or path-based tenant portals
      if (req.headers['x-tenant-subdomain']) {
        return resolveSubdomain(req.headers['x-tenant-subdomain'].toLowerCase().trim(), req, res, next);
      }

      // Check if client passed ?subdomain=... or ?slug=... on branding/resolve endpoints
      const isBrandingOrResolve = /^\/(?:api\/)?institutions\/(?:branding|resolve)/i.test(path);
      if (isBrandingOrResolve && req.query && (req.query.subdomain || req.query.slug)) {
        return resolveSubdomain((req.query.subdomain || req.query.slug).toLowerCase().trim(), req, res, next);
      }

      // Check if path has subdomain parameter, e.g. /institutions/branding/:subdomain or /institutions/resolve/:subdomain
      const pathParamMatch = path.match(/^\/(?:api\/)?institutions\/(?:branding|resolve)(?:\/subdomain)?\/([a-z0-9-]+)/i);
      if (pathParamMatch && pathParamMatch[1]) {
        return resolveSubdomain(pathParamMatch[1].toLowerCase().trim(), req, res, next);
      }

      // Check for JWT token in Authorization header to resolve tenant or superadmin context
      let token = null;
      if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        token = req.headers.authorization.split(' ')[1];
      }

      if (token) {
        try {
          const payloadBase64 = token.split('.')[1];
          if (payloadBase64) {
            const decoded = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf8'));
            if (decoded?.roles?.includes('SUPERADMIN') || decoded?.roles?.includes('superadmin')) {
              req.tenantId = null;
              req.isSuperAdminRoute = true;
              return next();
            }
            if (decoded?.institutionId) {
              req.tenantId = decoded.institutionId;
              return next();
            }
          }
        } catch (e) {
          // Ignore decode error and fall through
        }
      }

      // If path starts with /superadmin or is a platform API route -> proceed through to microservices
      if (
        path.startsWith('/superadmin') ||
        path.startsWith('/api/superadmin') ||
        path.includes('superadmin') ||
        path.startsWith('/api/institutions') ||
        path.startsWith('/institutions') ||
        path.startsWith('/api/auth') ||
        path.startsWith('/auth')
      ) {
        req.tenantId = null;
        req.isSuperAdminRoute = true;
        return next();
      }

      // If on root domain without subdomain and not accessing any platform service or API route:
      return res.status(404).json({
        success: false,
        error: 'Institution not found'
      });
    }

    // 3. Extract the subdomain (part before the first dot)
    // Examples:
    // "jecrc.collegeerp.com" -> "jecrc"
    // "apex-tech.localhost" -> "apex-tech"
    const dotIndex = host.indexOf('.');
    if (dotIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Institution not found'
      });
    }

    const subdomain = host.slice(0, dotIndex).trim();
    if (!subdomain) {
      return res.status(404).json({
        success: false,
        error: 'Institution not found'
      });
    }

    return resolveSubdomain(subdomain, req, res, next);
  } catch (err) {
    console.error('[TenantResolver Error]', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error during tenant resolution'
    });
  }
};

/**
 * Helper to look up institution by subdomain with Redis caching (5min TTL)
 */
async function resolveSubdomain(subdomain, req, res, next) {
  const cacheKey = `tenant:subdomain:${subdomain}`;
  const redis = redisModule.getRedisClient();

  let institution = null;

  // 4a. Check Redis cache
  if (redis && redis.status === 'ready') {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        institution = JSON.parse(cached);
      }
    } catch (redisErr) {
      console.warn('[TenantResolver Cache Warning] Redis get failed:', redisErr.message);
    }
  }

  // 4b. Cache miss: Look up Institution in MongoDB
  if (!institution) {
    if (!mongoose.connection.db) {
      console.error('[TenantResolver DB Error] Database connection not ready');
      return res.status(503).json({
        success: false,
        error: 'Tenant resolution database temporarily unavailable'
      });
    }

    const doc = await mongoose.connection.db.collection('institutions').findOne({
      $or: [
        { subdomain },
        { slug: subdomain }
      ]
    });

    if (doc) {
      institution = {
        _id: doc._id.toString(),
        name: doc.name,
        subdomain: doc.subdomain || doc.slug,
        slug: doc.slug || doc.subdomain,
        customDomain: doc.customDomain || doc.domain || null,
        logoUrl: doc.logoUrl || doc.branding?.logoUrl || '',
        themeConfig: doc.themeConfig || doc.branding || null,
        isActive: doc.isActive !== undefined ? doc.isActive : (doc.status === 'ACTIVE'),
        status: doc.status || (doc.isActive ? 'ACTIVE' : 'SUSPENDED')
      };

      // Cache in Redis for 5 minutes (300s)
      if (redis && redis.status === 'ready') {
        try {
          await redis.set(cacheKey, JSON.stringify(institution), 'EX', CACHE_TTL_SECONDS);
        } catch (cacheSetErr) {
          console.warn('[TenantResolver Cache Warning] Redis set failed:', cacheSetErr.message);
        }
      }
    }
  }

  // 5. If no active Institution matches -> respond 404 "Institution not found", do not fall through
  const isInactive = institution && (institution.isActive === false || institution.status === 'SUSPENDED');
  if (!institution || isInactive) {
    return res.status(404).json({
      success: false,
      error: 'Institution not found'
    });
  }

  // 6. Attach req.tenantId = institution._id to the request
  req.tenantId = institution._id.toString();
  req.tenantSubdomain = institution.subdomain;
  req.institution = institution;

  // 7. Perimeter Token Replay Check (Phase 66)
  // Re-validates that any JWT presented matches the resolved tenantId
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const parts = token.split('.');
      if (parts.length >= 2) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
        if (payload && payload.institutionId && payload.institutionId.toString() !== req.tenantId) {
          return res.status(401).json({
            success: false,
            error: 'Token tenant mismatch: JWT issued for a different institution cannot be used on this tenant domain'
          });
        }
      }
    } catch (e) {
      // Invalid JWT format will be handled downstream by authenticate middleware
    }
  }

  return next();
}

module.exports = {
  tenantResolver,
  resolveSubdomain,
  CACHE_TTL_SECONDS
};
