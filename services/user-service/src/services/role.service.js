const RoleAssignment = require('../models/RoleAssignment.model');
const CustomRole = require('../models/CustomRole.model');
const User = require('../models/User.model');
const { SCOPE_LEVELS, PERMISSION_CATALOG, FIXED_ROLE_PERMISSIONS } = require('@college-erp/shared-config');

/**
 * Computes the effective roles for a user based on active assignments.
 * 
 * @param {string} userId - The user's ID
 * @returns {Promise<Array<{role: string, scopeType: string, scopeId: string|null, customRoleId?: string}>>}
 */
const getEffectiveRoles = async (userId) => {
  const now = new Date();

  // Find all assignments for this user
  const assignments = await RoleAssignment.find({ userId });

  // Filter out expired or future assignments
  const activeAssignments = assignments.filter(assignment => {
    if (assignment.validFrom > now) return false;
    if (assignment.validTo && assignment.validTo < now) return false;
    return true;
  });

  // Map to effective role shape
  const effectiveRoles = activeAssignments.map(assignment => {
    let scopeType = SCOPE_LEVELS.GLOBAL;
    let scopeId = null;

    if (assignment.sectionId) {
      scopeType = SCOPE_LEVELS.SECTION;
      scopeId = assignment.sectionId.toString();
    } else if (assignment.departmentId) {
      scopeType = SCOPE_LEVELS.DEPARTMENT;
      scopeId = assignment.departmentId.toString();
    }

    return {
      role: assignment.role || 'CUSTOM',
      customRoleId: assignment.customRoleId ? assignment.customRoleId.toString() : undefined,
      scopeType,
      scopeId
    };
  });

  return effectiveRoles;
};

/**
 * Computes the effective granular permissions for a user within an institution.
 * 
 * Logic:
 * 1. Start with whatever fixed-role-implied permissions the user's roles[] grant
 *    (SUPERADMIN/ADMIN get full catalog; HOD gets dept powers, etc.).
 * 2. For each active RoleAssignment with customRoleId, union in that CustomRole's
 *    permissions array.
 * 3. Return the deduplicated union array.
 * 
 * @param {string} userId - The user's ID
 * @param {string|null} tenantId - The current institution ID
 * @returns {Promise<string[]>} Deduplicated array of permission keys
 */
const getEffectivePermissions = async (userId, tenantId = null, fallbackRoles = []) => {
  const permissionsSet = new Set();
  const now = new Date();

  // If fallbackRoles already has SUPERADMIN or ADMIN
  if (Array.isArray(fallbackRoles)) {
    if (fallbackRoles.includes('SUPERADMIN') || fallbackRoles.includes('ADMIN')) {
      return [...PERMISSION_CATALOG];
    }
    fallbackRoles.forEach(r => {
      const implied = FIXED_ROLE_PERMISSIONS[r] || [];
      implied.forEach(p => permissionsSet.add(p));
    });
  }

  // 1. Check user document fixed roles (e.g. root SUPERADMIN)
  try {
    const user = await User.findById(userId);
    if (user?.roles && Array.isArray(user.roles)) {
      if (user.roles.includes('SUPERADMIN') || user.roles.includes('ADMIN')) {
        return [...PERMISSION_CATALOG];
      }
      user.roles.forEach(r => {
        const implied = FIXED_ROLE_PERMISSIONS[r] || [];
        implied.forEach(p => permissionsSet.add(p));
      });
    }
  } catch (err) {
    // If User collection cannot be queried, proceed to assignments
  }

  // 2. Query RoleAssignments for this user
  const assignmentQuery = { userId };
  if (tenantId) {
    assignmentQuery.institutionId = tenantId;
  }

  const assignments = await RoleAssignment.find(assignmentQuery);

  const activeAssignments = assignments.filter(a => {
    if (a.validFrom && a.validFrom > now) return false;
    if (a.validTo && a.validTo < now) return false;
    return true;
  });

  const customRoleIds = [];

  for (const a of activeAssignments) {
    // Standard role implied permissions
    if (a.role) {
      if (a.role === 'ADMIN' || a.role === 'SUPERADMIN') {
        PERMISSION_CATALOG.forEach(p => permissionsSet.add(p));
      } else {
        const implied = FIXED_ROLE_PERMISSIONS[a.role] || [];
        implied.forEach(p => permissionsSet.add(p));
      }
    }

    if (a.customRoleId) {
      customRoleIds.push(a.customRoleId);
    }
  }

  // 3. Union CustomRole permissions
  if (customRoleIds.length > 0) {
    const customRoleQuery = {
      _id: { $in: customRoleIds },
      isActive: true
    };
    if (tenantId) {
      customRoleQuery.institutionId = tenantId;
    }

    const customRoles = await CustomRole.find(customRoleQuery);
    for (const cr of customRoles) {
      if (Array.isArray(cr.permissions)) {
        cr.permissions.forEach(p => permissionsSet.add(p));
      }
    }
  }

  return Array.from(permissionsSet);
};

module.exports = {
  getEffectiveRoles,
  getEffectivePermissions
};
