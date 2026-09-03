const { cleanEnv, port, str, url } = require('envalid');

const env = cleanEnv(process.env, {
  PORT: port(),
  MONGO_URI: str(),
  ANTHROPIC_API_KEY: str(),
});

module.exports = env;
