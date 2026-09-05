const { requirePermission } = require('./rbac');
const { setupSecurity } = require('./security');
const { logAudit } = require('./audit');
const { authenticate } = require('./auth');

const success = (data) => ({
  success: true,
  data
});

const fail = (message) => ({
  success: false,
  error: message
});

module.exports = {
  success,
  fail,
  requirePermission,
  setupSecurity,
  logAudit,
  authenticate
};
