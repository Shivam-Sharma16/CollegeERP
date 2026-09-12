const { cleanEnv, port, str, url } = require('envalid');

const env = cleanEnv(process.env, {
  PORT: port({ default: 4001 }),
  MONGO_URI: str({ default: 'mongodb://127.0.0.1:27017/test' }),
  JWT_ACCESS_SECRET: str({ default: 'ny+cq<I;(UL.LR#vzDM2j4>*Xc8^|4l^woMWm#|.iD0' }),
  JWT_REFRESH_SECRET: str({ default: 'test_refresh_secret_key' }),
  SUPERADMIN_SETUP_KEY: str({ default: 'test_secret_key' }),
});

module.exports = env;
