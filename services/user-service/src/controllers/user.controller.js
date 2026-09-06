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

const onboardStudent = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json(fail('Name, email, and password are required'));
    }

    if (!req.user.roles.includes('CC')) {
      return res.status(403).json(fail('You do not have permission to onboard a student'));
    }

    const ccRole = req.effectiveRoles?.find(r => r.role === 'CC');
    if (!ccRole || !ccRole.sectionId || !ccRole.departmentId) {
      return res.status(403).json(fail('You are not assigned to a section'));
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json(fail('User with this email already exists'));
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
    const user = await User.create({
      name,
      email,
      passwordHash,
      roles: [] // Managed by RoleAssignment
    });

    await RoleAssignment.create({
      userId: user._id,
      role: 'STUDENT',
      departmentId: ccRole.departmentId,
      sectionId: ccRole.sectionId,
      validFrom: new Date()
    });

    await logAudit(req, 'STUDENT_CREATED_BY_CC', user._id.toString(), 'User', { email, departmentId: ccRole.departmentId, sectionId: ccRole.sectionId });

    res.status(201).json(success({ userId: user._id, role: 'STUDENT' }));
  } catch (err) {
    console.error('[UserController] Failed to onboard student:', err);
    res.status(500).json(fail('Internal server error'));
  }
};

const listStudents = async (req, res) => {
  try {
    const ccRole = req.effectiveRoles?.find(r => r.role === 'CC');
    if (!ccRole || !ccRole.sectionId) {
      return res.status(403).json(fail('You are not assigned to a section'));
    }

    // Find all users who have an active STUDENT role for this section
    const assignments = await RoleAssignment.find({
      role: 'STUDENT',
      sectionId: ccRole.sectionId,
      $or: [{ validTo: null }, { validTo: { $gt: new Date() } }]
    }).populate('userId', 'name email isActive');

    const students = assignments
      .filter(a => a.userId && a.userId.isActive)
      .map(a => ({
        _id: a.userId._id,
        name: a.userId.name,
        email: a.userId.email,
        departmentId: a.departmentId,
        sectionId: a.sectionId
      }));

    res.status(200).json(success(students));
  } catch (err) {
    console.error('[UserController] Failed to list students:', err);
    res.status(500).json(fail('Internal server error'));
  }
};

module.exports = {
  createAdmin,
  createHOD,
  createFaculty,
  createCC,
  onboardStudent,
  listStudents
};
