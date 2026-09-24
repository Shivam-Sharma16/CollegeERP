const { cleanEnv, port, str } = require('envalid');

const env = cleanEnv(process.env, {
  PORT: port({ default: 4000 }),
  AUTH_SERVICE_URL: str({ default: 'http://auth-service:4001' }),
  USER_SERVICE_URL: str({ default: 'http://user-service:4002' }),
  ACADEMIC_SERVICE_URL: str({ default: 'http://academic-service:4003' }),
  ATTENDANCE_SERVICE_URL: str({ default: 'http://attendance-service:4004' }),
  RESULTS_SERVICE_URL: str({ default: 'http://results-service:4005' }),
  FEES_SERVICE_URL: str({ default: 'http://fees-service:4006' }),
  NOTICE_SERVICE_URL: str({ default: 'http://notice-service:4007' }),
  NOTIFICATION_SERVICE_URL: str({ default: 'http://notification-service:4008' }),
  AI_AGENT_SERVICE_URL: str({ default: 'http://ai-agent-service:4009' }),
  INSTITUTION_SERVICE_URL: str({ default: 'http://institution-service:4010' }),
  REDIS_URL: str({ default: 'redis://127.0.0.1:6379' }),
  INTERNAL_SERVICE_KEY: str({ default: '/^FdEq-yhAvZ|c!g*O9dF:!on:9qZ1*1+G&*5_(v@p=' }),
  MONGO_URI: str({ default: 'mongodb://127.0.0.1:27017/user-service' }),
});

module.exports = env;
