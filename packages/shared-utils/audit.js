const mongoose = require('mongoose');

/**
 * Logs an audit event to the generic `auditlogs` collection.
 * Bypass specific schemas to allow reuse across microservices without syncing models.
 * 
 * @param {Object} req - The Express request object, must contain req.user if authenticated
 * @param {string} action - e.g. 'SUPERADMIN_CREATED', 'STUDENT_REGISTERED'
 * @param {string} targetId - The ObjectId string of the resource affected
 * @param {string} targetType - e.g. 'User', 'RoleAssignment'
 * @param {Object} details - Additional metadata to log
 */
const logAudit = async (req, action, targetId, targetType, details = {}) => {
  try {
    if (!mongoose.connection.db) {
      console.warn('[Audit] Database connection not established. Skipping audit log.');
      return;
    }

    const auditLog = {
      action,
      actorId: req?.user?.userId ? new mongoose.Types.ObjectId(req.user.userId) : null,
      actorRole: req?.user?.roles || [],
      targetId: targetId ? new mongoose.Types.ObjectId(targetId) : null,
      targetType,
      details,
      timestamp: new Date(),
      ipAddress: req?.ip || null
    };

    await mongoose.connection.db.collection('auditlogs').insertOne(auditLog);
  } catch (error) {
    // We log the error but we do not crash the main execution flow if an audit fails
    console.error('[Audit] Failed to write audit log:', error.message);
  }
};

module.exports = { logAudit };
