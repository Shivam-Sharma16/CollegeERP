const { requirePermission } = require('./rbac');

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
  requirePermission
};
