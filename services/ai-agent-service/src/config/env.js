const { cleanEnv, port, str } = require('envalid');

const env = cleanEnv(process.env, {
  PORT: port(),
  MONGO_URI: str(),
  JWT_SECRET: str(),
  INTERNAL_SERVICE_KEY: str(),
  GEMINI_API_KEY: str({ default: '' }),             // Optional — only needed for real LLM calls
  ATTENDANCE_SERVICE_URL: str({ default: 'http://attendance-service:4004' }),
  RESULTS_SERVICE_URL:    str({ default: 'http://results-service:4005' }),
  FEES_SERVICE_URL:       str({ default: 'http://fees-service:4006' }),
  NOTICE_SERVICE_URL:     str({ default: 'http://notice-service:4007' }),
});

module.exports = env;
