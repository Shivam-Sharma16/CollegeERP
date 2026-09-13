const mongoose = require('mongoose');
const { PERMISSION_CATALOG, FIXED_ROLE_PERMISSIONS } = require('@college-erp/shared-config');

// Utility to create consistent fail envelope
const fail = (message) => ({
  success: false,
  error: message
});

/**
 * Resolves all effective granular permissions for a user within a tenant.
 * Unions fixed-role-implied permissions + custom role permissions from active assignments.
 */
const resolveEffectivePermissions = async (userIdStr, userRoles = [], currentTenantId = null, isSuperAdmin = false) => {
  const permissionsSet = new Set();

  // 1. SUPERADMIN has all catalog permissions globally
  if (isSuperAdmin || (Array.isArray(userRoles) && userRoles.includes('SUPERADMIN'))) {
    PERMISSION_CATALOG.forEach(p => permissionsSet.add(p));
    return Array.from(permissionsSet);
  }

  // 2. Fixed-role-implied permissions from JWT user roles
  if (Array.isArray(userRoles)) {
    userRoles.forEach(r => {
      const implied = FIXED_ROLE_PERMISSIONS[r] || [];
      implied.forEach(p => permissionsSet.add(p));
    });
  }

  // 3. Query DB for RoleAssignments and CustomRoles
  if (mongoose.connection && mongoose.connection.db) {
    try {
      const roleQuery = { userId: new mongoose.Types.ObjectId(userIdStr) };
      if (currentTenantId && mongoose.Types.ObjectId.isValid(currentTenantId)) {
        roleQuery.institutionId = new mongoose.Types.ObjectId(currentTenantId);
      }

      const assignments = await mongoose.connection.db
        .collection('roleassignments')
        .find(roleQuery)
        .toArray();

      const now = new Date();
      const customRoleIds = [];

      assignments.forEach(a => {
        // Implied permissions from standard roles in assignments
        if (a.role) {
          const implied = FIXED_ROLE_PERMISSIONS[a.role] || [];
          implied.forEach(p => permissionsSet.add(p));
        }

        // Active custom role assignments
        if (a.customRoleId) {
          if (a.validFrom && a.validFrom > now) return;
          if (a.validTo && a.validTo < now) return;
          customRoleIds.push(a.customRoleId);
        }
      });

      if (customRoleIds.length > 0) {
        const objectIds = customRoleIds
          .map(id => {
            try { return new mongoose.Types.ObjectId(id); } catch { return null; }
          })
          .filter(Boolean);

        const customRoleQuery = {
          _id: { $in: objectIds },
          isActive: true
        };
        if (currentTenantId && mongoose.Types.ObjectId.isValid(currentTenantId)) {
          customRoleQuery.institutionId = new mongoose.Types.ObjectId(currentTenantId);
        }

        const customRoles = await mongoose.connection.db
          .collection('customroles')
          .find(customRoleQuery)
          .toArray();

        customRoles.forEach(cr => {
          if (Array.isArray(cr.permissions)) {
            cr.permissions.forEach(p => permissionsSet.add(p));
          }
        });
      }
    } catch (dbErr) {
      console.error('[resolveEffectivePermissions] Error querying DB:', dbErr.message);
    }
  }

  return Array.from(permissionsSet);
};

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
    if (source.id && !source.departmentId && !source.sectionId && !source.studentId) {
      return { type: 'genericId', value: source.id.toString() };
    }
  }
  return { type: 'none', value: null };
};

/**
 * A central RBAC middleware supporting dual-mode check:
 * 1. Granular Permission Mode: requirePermission('fees.manage')
 * 2. Role & Scope Mode:        requirePermission('read', 'FeeStructure')
 */
const requirePermission = (actionOrPermission, resourceType) => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.userId) {
        return res.status(401).json(fail('Unauthorized'));
      }

      const userIdStr = req.user.userId.toString();
      const currentTenantId = req.tenantId || (req.headers && req.headers['x-tenant-id']) || (req.user.institutionId ? req.user.institutionId.toString() : null);
      if (currentTenantId) {
        req.tenantId = currentTenantId;
      }

      // Outermost check: Institution Match (Phase 68)
      const isSuperAdmin = req.user.roles && req.user.roles.includes('SUPERADMIN');
      const isAdmin = req.user.roles && req.user.roles.includes('ADMIN');

      if (currentTenantId && !isSuperAdmin) {
        const userTenantId = req.user.institutionId ? req.user.institutionId.toString() : null;
        if (!userTenantId || userTenantId !== currentTenantId.toString()) {
          return res.status(403).json(fail('Access Denied: Tenant mismatch'));
        }

        if (req.resource && req.resource.institutionId) {
          if (req.resource.institutionId.toString() !== currentTenantId.toString()) {
            return res.status(403).json(fail('Access Denied: Resource belongs to a different institution'));
          }
        }
      }

      // ── MODE 1: Granular Permission Check ────────────────────────────────────
      // Single string provided (e.g. requirePermission('fees.manage'), requirePermission('notice.create.department'))
      if (resourceType === undefined) {
        const requiredPermissionKey = actionOrPermission;

        if (!req.effectivePermissions) {
          req.effectivePermissions = await resolveEffectivePermissions(
            userIdStr,
            req.user.roles,
            currentTenantId,
            isSuperAdmin
          );
        }

        // SUPERADMIN has all permissions globally
        // ADMIN has all permissions within their own institution
        if (isSuperAdmin || isAdmin || req.effectivePermissions.includes(requiredPermissionKey)) {
          return next();
        }

        return res.status(403).json(fail(`Access Denied: Missing required permission: ${requiredPermissionKey}`));
      }

      // ── MODE 2: Role & Scope Check (Legacy Phase 10 / 68) ────────────────────
      const action = actionOrPermission;

      // 1. Resolve Effective Roles (Cached per request, strictly scoped by current tenant)
      if (!req.effectiveRoles) {
        if (!mongoose.connection.db) {
          throw new Error('Database connection not established');
        }

        const roleQuery = { userId: new mongoose.Types.ObjectId(userIdStr) };
        if (currentTenantId && !isSuperAdmin && mongoose.Types.ObjectId.isValid(currentTenantId)) {
          roleQuery.institutionId = new mongoose.Types.ObjectId(currentTenantId);
        }

        const roleAssignments = await mongoose.connection.db
          .collection('roleassignments')
          .find(roleQuery)
          .toArray();

        req.effectiveRoles = roleAssignments.map(ra => ({
          role: ra.role,
          customRoleId: ra.customRoleId?.toString(),
          departmentId: ra.departmentId?.toString(),
          sectionId: ra.sectionId?.toString(),
          institutionId: ra.institutionId?.toString()
        }));

        if (req.user.roles && Array.isArray(req.user.roles)) {
          req.user.roles.forEach(r => {
            if (!req.effectiveRoles.find(er => er.role === r)) {
              req.effectiveRoles.push({ role: r });
            }
          });
        }
      }

      // Also resolve effectivePermissions for custom role additive access
      if (!req.effectivePermissions) {
        req.effectivePermissions = await resolveEffectivePermissions(
          userIdStr,
          req.user.roles,
          currentTenantId,
          isSuperAdmin
        );
      }

      // Custom permission mapping shortcut for Mode 2:
      // If user has fees.manage / fees.view_reports, they can read/write FeeStructure
      if (resourceType === 'FeeStructure') {
        if (req.effectivePermissions.includes('fees.manage')) {
          return next();
        }
        if (action === 'read' && req.effectivePermissions.includes('fees.view_reports')) {
          return next();
        }
      }

      // 2. Extract Context (Target resource's scoping IDs)
      const targetContext = extractContextIds(req);

      // 3. Validation Logic
      let isAuthorized = false;

      for (const scope of req.effectiveRoles) {
        if (scope.role === 'SUPERADMIN' || scope.role === 'ADMIN') {
          isAuthorized = true;
          break;
        }

        if (scope.role === 'HOD') {
          if (targetContext.type === 'departmentId' && targetContext.value === scope.departmentId) {
            isAuthorized = true;
            break;
          }
          if (resourceType === 'Department' && scope.departmentId) {
            isAuthorized = true;
            break;
          }
        }

        if (scope.role === 'CC' || scope.role === 'FACULTY') {
          if (targetContext.type === 'sectionId' && targetContext.value === scope.sectionId) {
            isAuthorized = true;
            break;
          }
        }

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
  requirePermission,
  getEffectivePermissions: resolveEffectivePermissions,
  resolveEffectivePermissions
};
