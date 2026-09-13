const { requirePermission, getEffectivePermissions, resolveEffectivePermissions } = require('./rbac');
const { setupSecurity } = require('./security');
const { logAudit } = require('./audit');
const { authenticate } = require('./auth');
const { verifyTenantContext } = require('./tenant');

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
  getEffectivePermissions,
  resolveEffectivePermissions,
  setupSecurity,
  logAudit,
  authenticate,
  verifyTenantContext
};
