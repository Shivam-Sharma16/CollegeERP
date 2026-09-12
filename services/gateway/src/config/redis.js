const Redis = require('ioredis');
const env = require('./env');

let redisClient = null;

function getRedisClient() {
  if (!redisClient) {
    redisClient = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      retryStrategy(times) {
        // Retry delay with exponential backoff up to 2 seconds
        return Math.min(times * 100, 2000);
      },
      lazyConnect: true
    });

    redisClient.on('connect', () => {
      console.log('[Gateway Redis] Connected successfully');
    });

    redisClient.on('error', (err) => {
      // Log error but don't crash process
      console.warn('[Gateway Redis Error]', err.message);
    });

    // Initiate connection non-blocking
    redisClient.connect().catch((err) => {
      console.warn('[Gateway Redis Init Warning] Could not connect to Redis, will fall back to direct lookup:', err.message);
    });
  }

  return redisClient;
}

module.exports = { getRedisClient };
