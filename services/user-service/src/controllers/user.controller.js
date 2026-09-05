const bcrypt = require('bcrypt');
const User = require('../models/User.model');
const RoleAssignment = require('../models/RoleAssignment.model');
const Department = require('../models/Department.model');
const { success, fail, logAudit } = require('@college-erp/shared-utils');

const BCRYPT_COST = 12;

const createUser = async (req, res, targetRole, enforceHierarchyCallback, extractScopeCallback) => {
  try {
    const { name, email, password } = req.body;

    // 1. Basic validation
    if (!name || !email || !password) {
      return res.status(400).json(fail('Name, email, and password are required'));
    }

    // 2. Enforce Hierarchy
    if (!enforceHierarchyCallback(req.user.roles)) {
      return res.status(403).json(fail(`You do not have permission to create a ${targetRole}`));
    }

    // 3. Extract Scope (departmentId) safely
    const scope = extractScopeCallback(req);
    if (scope.error) {
      return res.status(403).json(fail(scope.error));
    }

    // 4. Check for existing user
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json(fail('User with this email already exists'));
    }

    // 5. Create user
    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
    const user = await User.create({
      name,
      email,
      passwordHash,
      roles: [] // Managed purely by RoleAssignment except for SUPERADMIN
    });

    // 6. Create Role Assignment
    await RoleAssignment.create({
      userId: user._id,
      role: targetRole,
      departmentId: scope.departmentId || null,
      sectionId: null, // CC/Faculty section assignment is a later phase (Phase 13/20) when sections are created
      validFrom: new Date()
    });

    // 7. Audit log
    await logAudit(req, `${targetRole}_CREATED`, user._id.toString(), 'User', { email, departmentId: scope.departmentId });

    res.status(201).json(success({ userId: user._id, role: targetRole }));
  } catch (err) {
    console.error(`[UserController] Failed to create ${targetRole}:`, err);
    res.status(500).json(fail('Internal server error'));
  }
};

const createAdmin = (req, res) => {
  return createUser(
    req, res, 'ADMIN',
    (callerRoles) => callerRoles.includes('SUPERADMIN'),
    (req) => ({ departmentId: null }) // Admins are institution-wide
  );
};

const createHOD = async (req, res) => {
  // Validate department exists
  if (req.body.departmentId) {
    const dept = await Department.findById(req.body.departmentId).catch(() => null);
    if (!dept) {
      return res.status(404).json(fail('Department not found'));
    }
  }

  return createUser(
    req, res, 'HOD',
    (callerRoles) => callerRoles.includes('SUPERADMIN') || callerRoles.includes('ADMIN'),
    (req) => {
      if (!req.body.departmentId) return { error: 'departmentId is required for HOD' };
      return { departmentId: req.body.departmentId };
    }
  );
};

const createFaculty = (req, res) => {
  return createUser(
    req, res, 'FACULTY',
    (callerRoles) => callerRoles.includes('HOD'),
    (req) => {
      // Find the caller's HOD RoleAssignment departmentId
      const hodRole = req.effectiveRoles?.find(r => r.role === 'HOD');
      if (!hodRole || !hodRole.departmentId) {
        return { error: 'You are not assigned to a department' };
      }
      return { departmentId: hodRole.departmentId };
    }
  );
};

const createCC = (req, res) => {
  return createUser(
    req, res, 'CC',
    (callerRoles) => callerRoles.includes('HOD'),
    (req) => {
      const hodRole = req.effectiveRoles?.find(r => r.role === 'HOD');
      if (!hodRole || !hodRole.departmentId) {
        return { error: 'You are not assigned to a department' };
      }
      return { departmentId: hodRole.departmentId };
    }
  );
};

module.exports = {
  createAdmin,
  createHOD,
  createFaculty,
  createCC
};
