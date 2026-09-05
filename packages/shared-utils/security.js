const helmet = require('helmet');
const cors = require('cors');

/**
 * Applies strict, generalized security headers and CORS configurations.
 * @param {import('express').Application} app
 * @param {string[]} allowedOrigins 
 */
const setupSecurity = (app, allowedOrigins = []) => {
  // 1. Helmet for standard security headers
  app.use(helmet());

  // 2. Strict CORS
  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests) if desired,
      // but typically we want to restrict. For dev, we often allow localhost.
      if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true, // required for httpOnly refresh cookies
  }));
};

module.exports = { setupSecurity };
