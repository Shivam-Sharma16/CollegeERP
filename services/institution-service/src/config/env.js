const { cleanEnv, port, str } = require('envalid');

const env = cleanEnv(process.env, {
  PORT: port({ default: 4010 }),
  MONGO_URI: str(),
  JWT_ACCESS_SECRET: str({ default: 'ny+cq<I;(UL.LR#vzDM2j4>*Xc8^|4l^woMWm#|.iD0' }),
});

module.exports = env;
