const { cleanEnv, port, str, url } = require('envalid');

const env = cleanEnv(process.env, {
  PORT: port({ default: 4002 }),
  MONGO_URI: str({ default: 'mongodb://localhost:27017/user-service' }),
  JWT_ACCESS_SECRET: str({ default: 'ny+cq<I;(UL.LR#vzDM2j4>*Xc8^|4l^woMWm#|.iD0' }),
  INTERNAL_SERVICE_KEY: str({ default: '/^FdEq-yhAvZ|c!g*O9dF:!on:9qZ1*1+G&*5_(v@p=' }),
  ACADEMIC_SERVICE_URL: url({ default: 'http://localhost:4003' }),
  ATTENDANCE_SERVICE_URL: url({ default: 'http://localhost:4004' }),
  RESULTS_SERVICE_URL: url({ default: 'http://localhost:4005' }),
});

module.exports = env;
