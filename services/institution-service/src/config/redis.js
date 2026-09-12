const Redis = require('ioredis');

let redisClient = null;

const getRedisClient = () => {
  if (redisClient) return redisClient;

  const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
  try {
    redisClient = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 200, 1000);
      }
    });

    redisClient.on('error', (err) => {
      // Suppress noisy logs if redis is offline in dev
      if (process.env.NODE_ENV !== 'production' && err.code === 'ECONNREFUSED') {
        return;
      }
      console.warn('[Redis institution-service] Cache warning:', err.message);
    });

    redisClient.connect().catch((err) => {
      // Graceful fallback if redis is down
    });
  } catch (err) {
    console.warn('[Redis institution-service] Initialization error:', err.message);
  }

  return redisClient;
};

const invalidateTenantCache = async (...subdomains) => {
  try {
    const client = getRedisClient();
    if (!client || client.status !== 'ready') return;

    const keys = subdomains
      .filter(Boolean)
      .map(s => `tenant:subdomain:${s.toString().toLowerCase().trim()}`);

    if (keys.length > 0) {
      await client.del(...keys);
      console.log(`[Cache Invalidation] Cleared keys: ${keys.join(', ')}`);
    }
  } catch (err) {
    console.warn('[Redis] Failed to invalidate tenant cache:', err.message);
  }
};

module.exports = {
  getRedisClient,
  invalidateTenantCache
};
