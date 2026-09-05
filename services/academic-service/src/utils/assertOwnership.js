const { fail } = require('@college-erp/shared-utils');

/**
 * Asserts that the calling HOD owns the given departmentId.
 * Reads req.effectiveRoles (populated by requirePermission).
 * Throws by responding 403 and returning false if the HOD doesn't own the dept.
 * Returns true if authorized so callers can do: if (!assertHODOwns(...)) return;
 */
const assertHODOwns = (req, res, departmentId) => {
  if (!departmentId) {
    res.status(400).json(fail('departmentId is required for this operation'));
    return false;
  }

  const deptStr = departmentId.toString();

  // SUPERADMIN and ADMIN always pass — they have institution scope
  const callerRoles = req.user?.roles || [];
  if (callerRoles.includes('SUPERADMIN') || callerRoles.includes('ADMIN')) {
    return true;
  }

  // For HOD: verify their assignment covers this department
  const hodAssignment = req.effectiveRoles?.find(
    r => r.role === 'HOD' && r.departmentId === deptStr
  );

  if (!hodAssignment) {
    res.status(403).json(fail('Access Denied: resource belongs to a different department'));
    return false;
  }

  return true;
};

/**
 * Extracts the HOD's own departmentId from req.effectiveRoles.
 * Returns null if not found (caller is not HOD or has no assignment).
 */
const getHODDepartmentId = (req) => {
  // SUPERADMIN/ADMIN don't have a single scoped dept; return null and let caller handle
  const callerRoles = req.user?.roles || [];
  if (callerRoles.includes('SUPERADMIN') || callerRoles.includes('ADMIN')) {
    return req.body.departmentId || null; // Allow explicit dept for admin-level ops
  }

  const hodAssignment = req.effectiveRoles?.find(r => r.role === 'HOD');
  return hodAssignment?.departmentId || null;
};

module.exports = { assertHODOwns, getHODDepartmentId };
