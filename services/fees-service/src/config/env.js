const { cleanEnv, port, str, url } = require('envalid');

const env = cleanEnv(process.env, {
  PORT: port({ default: 4006 }),
  MONGO_URI: str({ default: 'mongodb://localhost:27017/fees-service' }),
});

module.exports = env;
