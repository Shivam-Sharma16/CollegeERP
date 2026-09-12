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

    // Allow health checks to bypass tenant resolution
    if (path === '/health' || path === '/api/health' || path === '/') {
      req.tenantId = null;
      return next();
    }

    // 2. Check if it matches root domain exactly with no subdomain
    const isRootDomain = ROOT_DOMAINS.has(host);

    if (isRootDomain) {
      // If path starts with /superadmin or /api/superadmin -> proceed as global/no-tenant request
      if (path.startsWith('/superadmin') || path.startsWith('/api/superadmin')) {
        req.tenantId = null;
        req.isSuperAdminRoute = true;
        return next();
      }

      // Check if developer explicitly passed an x-tenant-subdomain header for testing on root domain
      if (req.headers['x-tenant-subdomain']) {
        return resolveSubdomain(req.headers['x-tenant-subdomain'].toLowerCase().trim(), req, res, next);
      }

      // If on root domain without subdomain and not accessing /superadmin, no tenant can be inferred
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

  return next();
}

module.exports = {
  tenantResolver,
  resolveSubdomain,
  CACHE_TTL_SECONDS
};
