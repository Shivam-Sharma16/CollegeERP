const { cleanEnv, port, str, url } = require('envalid');

const env = cleanEnv(process.env, {
  PORT: port(),
  MONGO_URI: str(),
});

module.exports = env;
