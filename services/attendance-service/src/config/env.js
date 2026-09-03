const { cleanEnv, port, str, url } = require('envalid');

const env = cleanEnv(process.env, {
  PORT: port(),
  MONGO_URI: str(),
  REDIS_URL: str(),
});

module.exports = env;
