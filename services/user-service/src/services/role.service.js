const RoleAssignment = require('../models/RoleAssignment.model');
const { SCOPE_LEVELS } = require('@college-erp/shared-config');

/**
 * Computes the effective roles for a user based on active assignments.
 * 
 * @param {string} userId - The user's ID
 * @returns {Promise<Array<{role: string, scopeType: string, scopeId: string|null}>>}
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
      role: assignment.role,
      scopeType,
      scopeId
    };
  });

  return effectiveRoles;
};

module.exports = {
  getEffectiveRoles
};
