const { cleanEnv, port, str } = require('envalid');

const env = cleanEnv(process.env, {
  PORT: port(),
  MONGO_URI: str(),
  REDIS_URL: str(),
  JWT_SECRET: str(),
  INTERNAL_SERVICE_KEY: str(),
});

module.exports = env;
