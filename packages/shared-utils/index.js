const { requirePermission } = require('./rbac');
const { setupSecurity } = require('./security');
const { logAudit } = require('./audit');
const { authenticate } = require('./auth');

const success = (data) => ({
  success: true,
  data
});

const fail = (message, data = null) => {
  const response = {
    success: false,
    error: message
  };
  if (data) {
    response.data = data;
  }
  return response;
};

module.exports = {
  success,
  fail,
  requirePermission,
  setupSecurity,
  logAudit,
  authenticate
};
