const { cleanEnv, port, str } = require('envalid');

const env = cleanEnv(process.env, {
  PORT: port(),
  MONGO_URI: str(),
  REDIS_URL: str(),
  INTERNAL_SERVICE_KEY: str({ default: '' }),
  NOTIFICATION_SERVICE_URL: str({ default: 'http://notification-service:4008' }),
});

module.exports = env;
