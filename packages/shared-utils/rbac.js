const mongoose = require('mongoose');

// Utility to create consistent fail envelope
const fail = (message) => ({
  success: false,
  error: message
});

/**
 * Parses the request to find the scoping identifiers.
 * Prioritizes req.resource (if loaded by a previous middleware),
 * then req.body, req.query, req.params.
 */
const extractContextIds = (req) => {
  const sources = [req.resource || {}, req.body || {}, req.query || {}, req.params || {}];
  
  for (const source of sources) {
    if (source.departmentId) return { type: 'departmentId', value: source.departmentId.toString() };
    if (source.sectionId) return { type: 'sectionId', value: source.sectionId.toString() };
    if (source.studentId) return { type: 'studentId', value: source.studentId.toString() };
    if (source.userId) return { type: 'studentId', value: source.userId.toString() };
    // Generic id fallback (could be a studentId or sectionId, risky to assume, but used in some APIs)
    if (source.id && !source.departmentId && !source.sectionId && !source.studentId) {
      return { type: 'genericId', value: source.id.toString() };
    }
  }
  return { type: 'none', value: null };
};

/**
 * A central RBAC middleware.
 * @param {string} action - e.g. 'read', 'write' (currently unused structurally, but semantically useful for future expansion)
 * @param {string} resourceType - e.g. 'AttendanceRecord', 'Payment'
 */
const requirePermission = (action, resourceType) => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.userId) {
        return res.status(401).json(fail('Unauthorized'));
      }

      const userIdStr = req.user.userId.toString();

      // 1. Resolve Effective Roles (Cached per request)
      if (!req.effectiveRoles) {
        if (!mongoose.connection.db) {
          throw new Error('Database connection not established');
        }

        const roleAssignments = await mongoose.connection.db
          .collection('roleassignments')
          .find({ userId: new mongoose.Types.ObjectId(userIdStr) })
          .toArray();

        req.effectiveRoles = roleAssignments.map(ra => ({
          role: ra.role,
          departmentId: ra.departmentId?.toString(),
          sectionId: ra.sectionId?.toString()
        }));

        // Include JWT token roles (like SUPERADMIN) which might not have scoped RoleAssignments
        if (req.user.roles && Array.isArray(req.user.roles)) {
          req.user.roles.forEach(r => {
            if (!req.effectiveRoles.find(er => er.role === r)) {
              req.effectiveRoles.push({ role: r });
            }
          });
        }
      }

      // 2. Extract Context (Target resource's scoping IDs)
      const targetContext = extractContextIds(req);

      // 3. Validation Logic
      let isAuthorized = false;

      for (const scope of req.effectiveRoles) {
        // SUPERADMIN / ADMIN: Institution scope -> always pass
        if (scope.role === 'SUPERADMIN' || scope.role === 'ADMIN') {
          isAuthorized = true;
          break;
        }

        // HOD: pass only if target's departmentId === HOD's assignment scopeId
        if (scope.role === 'HOD') {
          if (targetContext.type === 'departmentId' && targetContext.value === scope.departmentId) {
            isAuthorized = true;
            break;
          }
        }

        // CC / FACULTY: pass only if target's sectionId === their assignment scopeId
        if (scope.role === 'CC' || scope.role === 'FACULTY') {
          if (targetContext.type === 'sectionId' && targetContext.value === scope.sectionId) {
            isAuthorized = true;
            break;
          }
        }

        // STUDENT: pass only if resource belongs directly to the user
        if (scope.role === 'STUDENT') {
          if (
            (targetContext.type === 'studentId' && targetContext.value === userIdStr) ||
            (targetContext.type === 'genericId' && targetContext.value === userIdStr)
          ) {
            isAuthorized = true;
            break;
          }
        }
      }

      // 4. On Fail: respond 403 (No partial data leakage)
      if (!isAuthorized) {
        return res.status(403).json(fail('Access Denied'));
      }

      next();
    } catch (err) {
      console.error('[RBAC Middleware] Error:', err);
      res.status(500).json(fail('Internal Server Error'));
    }
  };
};

module.exports = {
  requirePermission
};
