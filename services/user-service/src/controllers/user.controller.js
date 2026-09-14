const mongoose = require('mongoose');
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

    // 4. Tenant institution scoping
    const institutionId = req.user?.institutionId || req.body.institutionId || null;

    // 5. Check for existing user within the same institution
    const existing = await User.findOne({ email: email.toLowerCase().trim(), institutionId });
    if (existing) {
      return res.status(409).json(fail('User with this email already exists in this institution'));
    }

    // 6. Create user
    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
      roles: [], // Managed purely by RoleAssignment except for SUPERADMIN
      institutionId
    });

    // 7. Create Role Assignment
    await RoleAssignment.create({
      userId: user._id,
      role: targetRole,
      departmentId: scope.departmentId || null,
      sectionId: null, // CC/Faculty section assignment is a later phase (Phase 13/20) when sections are created
      institutionId,
      validFrom: new Date()
    });

    // 8. Audit log
    await logAudit(req, `${targetRole}_CREATED`, user._id.toString(), 'User', { email, departmentId: scope.departmentId, institutionId });

    res.status(201).json(success({ userId: user._id, role: targetRole, institutionId }));
  } catch (err) {
    console.error(`[UserController] Failed to create ${targetRole}:`, err);
    res.status(500).json(fail('Internal server error'));
  }
};

/**
 * Account-Creation Hierarchy (Phase 12 / Phase 69 Retrofit):
 * SuperAdmin -> creates: Institution (+ first Admin, bundled in Phase 67)
 * Admin      -> creates: Department, HOD
 * HOD        -> creates: Faculty, CC
 * CC         -> creates: Student (onboarding)
 */
const createAdmin = (req, res) => {
  return createUser(
    req, res, 'ADMIN',
    (callerRoles) => callerRoles.includes('SUPERADMIN'),
    (req) => ({ departmentId: null }) // Admins are institution-wide
  );
};

const createHOD = async (req, res) => {
  // Phase 69: SuperAdmin no longer creates HODs — Admin-only
  if (req.user?.roles?.includes('SUPERADMIN') || !req.user?.roles?.includes('ADMIN')) {
    return res.status(403).json(fail('Access Denied: Only Admin can create HODs'));
  }

  const institutionId = req.user?.institutionId;
  if (!institutionId) {
    return res.status(403).json(fail('Admin must be associated with an institution'));
  }

  // Validate department exists within caller's institution
  if (req.body.departmentId) {
    const dept = await Department.findOne({ _id: req.body.departmentId, institutionId }).catch(() => null);
    if (!dept) {
      return res.status(404).json(fail('Department not found in this institution'));
    }
  }

  return createUser(
    req, res, 'HOD',
    (callerRoles) => !callerRoles.includes('SUPERADMIN') && callerRoles.includes('ADMIN'),
    (req) => {
      if (!req.body.departmentId) return { error: 'departmentId is required for HOD' };
      return { departmentId: req.body.departmentId };
    }
  );
};

const createFaculty = (req, res) => {
  if (req.user?.roles?.includes('SUPERADMIN') || !req.user?.roles?.includes('HOD')) {
    return res.status(403).json(fail('Access Denied: Only HOD can create Faculty'));
  }
  return createUser(
    req, res, 'FACULTY',
    (callerRoles) => !callerRoles.includes('SUPERADMIN') && callerRoles.includes('HOD'),
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
  if (req.user?.roles?.includes('SUPERADMIN') || !req.user?.roles?.includes('HOD')) {
    return res.status(403).json(fail('Access Denied: Only HOD can create CC'));
  }
  return createUser(
    req, res, 'CC',
    (callerRoles) => !callerRoles.includes('SUPERADMIN') && callerRoles.includes('HOD'),
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
    const { name, email, password, rollNumber, feeGroup } = req.body;
    if (!name || !email || !password || !rollNumber) {
      return res.status(400).json(fail('Name, email, roll number, and password are required'));
    }

    if (!req.user.roles.includes('CC')) {
      return res.status(403).json(fail('You do not have permission to onboard a student'));
    }

    const ccRole = req.effectiveRoles?.find(r => r.role === 'CC');
    if (!ccRole || !ccRole.sectionId || !ccRole.departmentId) {
      return res.status(403).json(fail('You are not assigned to a section'));
    }

    const institutionId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId || ccRole.institutionId || null;

    const existingEmail = await User.findOne({ email: email.toLowerCase().trim(), institutionId });
    if (existingEmail) {
      return res.status(409).json(fail('Email already exists', { field: 'email' }));
    }

    const existingRoll = await User.findOne({ rollNumber: rollNumber.trim(), institutionId });
    if (existingRoll) {
      return res.status(409).json(fail('Roll number already exists', { field: 'rollNumber' }));
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      rollNumber: rollNumber.trim(),
      passwordHash,
      feeGroup: (feeGroup || 'general').trim().toLowerCase(),
      roles: [], // Managed by RoleAssignment
      institutionId
    });

    await RoleAssignment.create({
      userId: user._id,
      role: 'STUDENT',
      departmentId: ccRole.departmentId,
      sectionId: ccRole.sectionId,
      institutionId,
      validFrom: new Date()
    });

    await logAudit(req, 'STUDENT_CREATED_BY_CC', user._id.toString(), 'User', { email, departmentId: ccRole.departmentId, sectionId: ccRole.sectionId, institutionId });

    res.status(201).json(success({ userId: user._id, role: 'STUDENT', institutionId }));
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

    const filter = {
      role: 'STUDENT',
      sectionId: ccRole.sectionId,
      $or: [{ validTo: null }, { validTo: { $gt: new Date() } }]
    };

    if (req.user?.institutionId) {
      filter.institutionId = req.user.institutionId;
    }

    const assignments = await RoleAssignment.find(filter).populate('userId', 'name email isActive');

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

const getOwnProfile = async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const user = await User.findById(userId).select('-passwordHash').lean();
    if (!user) {
      return res.status(404).json(fail('User not found'));
    }
    res.status(200).json(success(user));
  } catch (err) {
    console.error('[UserController] Failed to get own profile:', err);
    res.status(500).json(fail('Internal server error'));
  }
};

const updateOwnProfile = async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const callerRoles = req.user.roles || [];
    const isSuperAdmin = callerRoles.includes('SUPERADMIN');
    const { name, email, avatarUrl } = req.body;
    
    const currentUser = await User.findById(userId);
    if (!currentUser) {
      return res.status(404).json(fail('User not found'));
    }

    // Role-based credential validation:
    // Only SuperAdmin can modify their own institutional identity (name and email) directly.
    // Non-SuperAdmin accounts (Admin, HOD, Faculty, Student) have credentials locked to institutional records.
    if (!isSuperAdmin) {
      const isNameChanged = name !== undefined && name.trim() !== currentUser.name;
      const isEmailChanged = email !== undefined && email.trim().toLowerCase() !== currentUser.email.toLowerCase();
      if (isNameChanged || isEmailChanged) {
        return res.status(403).json(fail('Institutional credentials (name and email) cannot be changed directly. They are managed by your administrative authority or HOD.'));
      }
    }

    const updateData = {};
    if (isSuperAdmin && name) updateData.name = name.trim();
    if (isSuperAdmin && email) {
      const normalizedEmail = email.trim().toLowerCase();
      if (normalizedEmail !== currentUser.email) {
        const existing = await User.findOne({ email: normalizedEmail, _id: { $ne: userId } });
        if (existing) {
          return res.status(409).json(fail('Email already in use by another account'));
        }
        updateData.email = normalizedEmail;
      }
    }
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl; // allow updating or clearing avatar

    const updatedUser = await User.findByIdAndUpdate(userId, updateData, { new: true }).select('-passwordHash');
    
    res.status(200).json(success(updatedUser));
  } catch (err) {
    console.error('[UserController] Failed to update profile:', err);
    res.status(500).json(fail('Internal server error'));
  }
};

const searchUsers = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(200).json(success([]));

    const queryRegex = new RegExp(q, 'i');
    const isSuperAdmin = req.user.roles.includes('SUPERADMIN') || req.user.roles.includes('ADMIN');
    
    let scopeQuery = {};
    if (!isSuperAdmin) {
      const myAssignments = await RoleAssignment.find({ userId: req.user.userId || req.user.id });
      
      const deptIds = [];
      const secIds = [];
      
      myAssignments.forEach(a => {
        if (a.departmentId) deptIds.push(a.departmentId);
        if (a.sectionId) secIds.push(a.sectionId);
      });
      
      if (secIds.length > 0 && !req.user.roles.includes('HOD')) {
        // Faculty/CC - only users in same section
        const sectionAssignments = await RoleAssignment.find({ sectionId: { $in: secIds } });
        scopeQuery._id = { $in: sectionAssignments.map(a => a.userId) };
      } else if (deptIds.length > 0) {
        // HOD - users in same department
        const deptAssignments = await RoleAssignment.find({ departmentId: { $in: deptIds } });
        scopeQuery._id = { $in: deptAssignments.map(a => a.userId) };
      } else if (req.user.roles.includes('STUDENT')) {
        // Students can't search other students globally, return empty
        return res.status(200).json(success([]));
      }
    }

    const matchQuery = {
      $and: [
        { $or: [{ name: queryRegex }, { email: queryRegex }] }
      ]
    };

    // Enforce institution scoping
    if (req.user?.institutionId) {
      matchQuery.institutionId = req.user.institutionId;
    }
    
    if (Object.keys(scopeQuery).length > 0) {
      matchQuery.$and.push(scopeQuery);
    }

    const users = await User.find(matchQuery).select('name email roles avatarUrl').limit(10);
    res.status(200).json(success(users));
  } catch (err) {
    console.error('[UserController] Failed to search users:', err);
    res.status(500).json(fail('Internal server error'));
  }
};

const listHods = async (req, res) => {
  try {
    const filter = {
      role: 'HOD',
      $or: [{ validTo: null }, { validTo: { $gt: new Date() } }]
    };

    if (req.user?.institutionId) {
      filter.institutionId = req.user.institutionId;
    } else if (req.query.institutionId) {
      filter.institutionId = req.query.institutionId;
    }

    const assignments = await RoleAssignment.find(filter)
      .populate('userId', 'name email isActive avatarUrl')
      .populate('departmentId', 'name code');

    const hods = assignments
      .filter(a => a.userId && a.userId.isActive)
      .map(a => ({
        _id: a.userId._id,
        name: a.userId.name,
        email: a.userId.email,
        departmentId: a.departmentId ? {
          _id: a.departmentId._id,
          name: a.departmentId.name,
          code: a.departmentId.code
        } : null,
        role: 'HOD'
      }));

    res.status(200).json(success(hods));
  } catch (err) {
    console.error('[UserController] Failed to list HODs:', err);
    res.status(500).json(fail('Internal server error'));
  }
};

const listAdmins = async (req, res) => {
  try {
    const roleFilter = {
      role: 'ADMIN',
      $or: [{ validTo: null }, { validTo: { $gt: new Date() } }]
    };
    const userFilter = {
      roles: { $in: ['ADMIN'] },
      isActive: true
    };

    if (req.user?.institutionId) {
      roleFilter.institutionId = req.user.institutionId;
      userFilter.institutionId = req.user.institutionId;
    } else if (req.query.institutionId) {
      roleFilter.institutionId = req.query.institutionId;
      userFilter.institutionId = req.query.institutionId;
    } else if (req.user?.roles.includes('SUPERADMIN')) {
      // Platform superadmin sees SUPERADMIN and all Admins
      userFilter.roles = { $in: ['ADMIN', 'SUPERADMIN'] };
    }

    const [adminAssignments, directAdmins] = await Promise.all([
      RoleAssignment.find(roleFilter).populate('userId', 'name email isActive avatarUrl'),
      User.find(userFilter).select('name email isActive avatarUrl roles institutionId')
    ]);

    const adminMap = new Map();

    directAdmins.forEach(u => {
      adminMap.set(u._id.toString(), {
        _id: u._id,
        name: u.name,
        email: u.email,
        roles: u.roles,
        institutionId: u.institutionId
      });
    });

    adminAssignments.forEach(a => {
      if (a.userId && a.userId.isActive) {
        const idStr = a.userId._id.toString();
        if (!adminMap.has(idStr)) {
          adminMap.set(idStr, {
            _id: a.userId._id,
            name: a.userId.name,
            email: a.userId.email,
            roles: ['ADMIN'],
            institutionId: a.institutionId
          });
        }
      }
    });

    res.status(200).json(success(Array.from(adminMap.values())));
  } catch (err) {
    console.error('[UserController] Failed to list Admins:', err);
    res.status(500).json(fail('Internal server error'));
  }
};

const listFaculty = async (req, res) => {
  try {
    const filter = {
      role: 'FACULTY',
      $or: [{ validTo: null }, { validTo: { $gt: new Date() } }]
    };

    if (req.user?.institutionId) {
      filter.institutionId = req.user.institutionId;
    } else if (req.query.institutionId) {
      filter.institutionId = req.query.institutionId;
    }

    if (req.user.roles?.includes('HOD') && !req.user.roles?.includes('SUPERADMIN') && !req.user.roles?.includes('ADMIN')) {
      const hodRole = req.effectiveRoles?.find(r => r.role === 'HOD');
      if (hodRole && hodRole.departmentId) {
        filter.departmentId = hodRole.departmentId;
      }
    } else if (req.query.departmentId) {
      filter.departmentId = req.query.departmentId;
    }

    const assignments = await RoleAssignment.find(filter)
      .populate('userId', 'name email isActive avatarUrl')
      .populate('departmentId', 'name code');

    const faculty = assignments
      .filter(a => a.userId && a.userId.isActive)
      .map(a => ({
        _id: a.userId._id,
        name: a.userId.name,
        email: a.userId.email,
        departmentId: a.departmentId,
        role: 'FACULTY'
      }));

    res.status(200).json(success(faculty));
  } catch (err) {
    console.error('[UserController] Failed to list Faculty:', err);
    res.status(500).json(fail('Internal server error'));
  }
};

const listCC = async (req, res) => {
  try {
    const filter = {
      role: 'CC',
      $or: [{ validTo: null }, { validTo: { $gt: new Date() } }]
    };

    if (req.user?.institutionId) {
      filter.institutionId = req.user.institutionId;
    } else if (req.query.institutionId) {
      filter.institutionId = req.query.institutionId;
    }

    if (req.user.roles?.includes('HOD') && !req.user.roles?.includes('SUPERADMIN') && !req.user.roles?.includes('ADMIN')) {
      const hodRole = req.effectiveRoles?.find(r => r.role === 'HOD');
      if (hodRole && hodRole.departmentId) {
        filter.departmentId = hodRole.departmentId;
      }
    } else if (req.query.departmentId) {
      filter.departmentId = req.query.departmentId;
    }

    const assignments = await RoleAssignment.find(filter)
      .populate('userId', 'name email isActive avatarUrl')
      .populate('departmentId', 'name code');

    const ccs = assignments
      .filter(a => a.userId && a.userId.isActive)
      .map(a => ({
        _id: a.userId._id,
        name: a.userId.name,
        email: a.userId.email,
        departmentId: a.departmentId,
        sectionId: a.sectionId,
        role: 'CC'
      }));

    res.status(200).json(success(ccs));
  } catch (err) {
    console.error('[UserController] Failed to list CCs:', err);
    res.status(500).json(fail('Internal server error'));
  }
};

const getUserById = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const filter = { _id: req.params.id };
    if (tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      filter.institutionId = tenantId;
    }
    const user = await User.findOne(filter).select('-passwordHash').lean();
    if (!user) {
      return res.status(404).json(fail('User not found'));
    }
    res.status(200).json(success(user));
  } catch (err) {
    console.error('[UserController] Failed to get user:', err);
    res.status(500).json(fail('Internal server error'));
  }
};

const updateUser = async (req, res) => {
  try {
    const callerId = req.user?.userId || req.user?.id;
    const callerRoles = req.user?.roles || [];
    const callerTenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const isSuperAdmin = callerRoles.includes('SUPERADMIN');
    const isAdmin = callerRoles.includes('ADMIN');
    const isHod = callerRoles.includes('HOD');

    if (!isSuperAdmin && !isAdmin && !isHod) {
      return res.status(403).json(fail('Access Denied: You do not have permission to modify user credentials'));
    }

    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).json(fail('User not found'));
    }

    // Determine target user's role assignments
    const targetAssignments = await RoleAssignment.find({
      userId: targetUser._id,
      $or: [{ validTo: null }, { validTo: { $gt: new Date() } }]
    });
    const targetRoles = targetAssignments.map(a => a.role);

    // Enforce downward hierarchy:
    // 1. SuperAdmin: can edit anyone (SuperAdmin, Admin, HOD, etc.)
    // 2. Admin: can edit HOD, Faculty, CC, Student within own institution (cannot edit SuperAdmin or Admin)
    // 3. HOD: can edit Faculty, CC, Student within own department (cannot edit SuperAdmin, Admin, HOD)
    if (isSuperAdmin) {
      // SuperAdmin is at top of hierarchy
    } else if (isAdmin) {
      const targetInstId = targetUser.institutionId?.toString() || targetAssignments[0]?.institutionId?.toString();
      if (!targetInstId || targetInstId !== callerTenantId?.toString()) {
        return res.status(403).json(fail('Access Denied: User belongs to a different institution'));
      }
      if (targetRoles.includes('SUPERADMIN') || targetRoles.includes('ADMIN')) {
        return res.status(403).json(fail('Access Denied: Admin cannot modify credentials of SuperAdmin or other Admins'));
      }
    } else if (isHod) {
      const targetInstId = targetUser.institutionId?.toString() || targetAssignments[0]?.institutionId?.toString();
      if (!targetInstId || targetInstId !== callerTenantId?.toString()) {
        return res.status(403).json(fail('Access Denied: User belongs to a different institution'));
      }
      if (targetRoles.includes('SUPERADMIN') || targetRoles.includes('ADMIN') || targetRoles.includes('HOD')) {
        return res.status(403).json(fail('Access Denied: HOD can only modify credentials of staff/students in their department'));
      }

      // Check caller's active HOD department
      const callerHod = await RoleAssignment.findOne({
        userId: callerId,
        role: 'HOD',
        $or: [{ validTo: null }, { validTo: { $gt: new Date() } }]
      });
      const callerDeptId = callerHod?.departmentId?.toString();
      if (!callerDeptId) {
        return res.status(403).json(fail('Access Denied: HOD has no active department assignment'));
      }

      const isSameDept = targetAssignments.some(a => a.departmentId?.toString() === callerDeptId);
      if (!isSameDept) {
        return res.status(403).json(fail('Access Denied: User does not belong to your department'));
      }
    }

    const updateData = {};
    if (req.body.name) updateData.name = req.body.name.trim();
    if (req.body.email) {
      const newEmail = req.body.email.trim().toLowerCase();
      if (newEmail !== targetUser.email) {
        const existing = await User.findOne({ email: newEmail, _id: { $ne: targetUser._id } });
        if (existing) {
          return res.status(409).json(fail('Email already in use by another user'));
        }
        updateData.email = newEmail;
      }
    }
    if (req.body.avatarUrl !== undefined) updateData.avatarUrl = req.body.avatarUrl;
    if (req.body.isActive !== undefined) updateData.isActive = req.body.isActive;

    const updatedUser = await User.findByIdAndUpdate(targetUser._id, updateData, { new: true })
      .select('-passwordHash')
      .lean();

    res.status(200).json(success(updatedUser));
  } catch (err) {
    console.error('[UserController] Failed to update user:', err);
    res.status(500).json(fail('Internal server error'));
  }
};

const deleteUser = async (req, res) => {
  try {
    const isSuperAdmin = req.user?.roles?.includes('SUPERADMIN');
    const isAdmin = req.user?.roles?.includes('ADMIN');

    if (!isSuperAdmin && !isAdmin) {
      return res.status(403).json(fail('Access Denied: Only SuperAdmin or Admin can delete user accounts'));
    }

    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const filter = { _id: req.params.id };
    if (tenantId && !isSuperAdmin) {
      filter.institutionId = tenantId;
    }

    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).json(fail('User not found'));
    }

    // Admins cannot delete SuperAdmins or other Admins
    if (isAdmin && !isSuperAdmin) {
      const targetAssignments = await RoleAssignment.find({ userId: targetUser._id });
      const targetRoles = targetAssignments.map(a => a.role);
      if (targetRoles.includes('SUPERADMIN') || targetRoles.includes('ADMIN')) {
        return res.status(403).json(fail('Access Denied: Admins cannot delete SuperAdmins or other Admins'));
      }
    }

    const user = await User.findOneAndDelete(filter).lean();
    if (!user) {
      return res.status(404).json(fail('User not found'));
    }
    await RoleAssignment.deleteMany({ userId: user._id });

    // Clear admin reference in institutions if this user was designated admin
    if (mongoose.connection.db) {
      await mongoose.connection.db.collection('institutions').updateMany(
        { adminUserId: user._id },
        { $set: { adminUserId: null } }
      ).catch(() => null);
    }

    res.status(200).json(success({ message: `User "${user.name}" deleted successfully` }));
  } catch (err) {
    console.error('[UserController] Failed to delete user:', err);
    res.status(500).json(fail('Internal server error'));
  }
};

const bulkImportUsers = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId || req.body.institutionId;
    const callerRoles = req.user?.roles || [];
    const isAdmin = callerRoles.includes('ADMIN') || callerRoles.includes('SUPERADMIN');

    if (!isAdmin) {
      return res.status(403).json(fail('Access Denied: Only Admin can perform bulk import'));
    }

    if (!tenantId && !callerRoles.includes('SUPERADMIN')) {
      return res.status(400).json(fail('Institution context is required for bulk import'));
    }

    let rawData = req.body.csv || req.body;
    let parsedRows = [];

    if (Array.isArray(req.body.rows)) {
      parsedRows = req.body.rows.map((r, idx) => ({ rowIndex: idx + 2, data: r }));
    } else if (typeof rawData === 'string') {
      // CSV string parser
      const lines = rawData.split(/\r\n|\n/).filter(line => line.trim().length > 0);
      if (lines.length <= 1) {
        return res.status(400).json(fail('CSV is empty or missing data rows'));
      }

      const parseLine = (line) => {
        const values = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
              current += '"';
              i++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        values.push(current.trim());
        return values;
      };

      const headers = parseLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
      for (let i = 1; i < lines.length; i++) {
        const rawValues = parseLine(lines[i]);
        const rowObj = {};
        headers.forEach((h, idx) => {
          rowObj[h] = rawValues[idx] !== undefined ? rawValues[idx] : '';
        });
        parsedRows.push({ rowIndex: i + 1, data: rowObj });
      }
    } else {
      return res.status(400).json(fail('No CSV data or rows provided'));
    }

    const successful = [];
    const failed = [];
    const seenEmails = new Set();
    const seenRollNumbers = new Set();

    for (const item of parsedRows) {
      const { rowIndex, data } = item;
      const name = (data.name || data.fullname || data.studentname || '').trim();
      const email = (data.email || data.emailaddress || '').toLowerCase().trim();
      const rawRole = (data.role || 'STUDENT').toUpperCase().trim();
      const rollNumber = (data.rollnumber || data.rollno || data.roll || '').trim();
      const rawDept = (data.departmentid || data.department || data.deptid || data.dept || '').trim();
      const feeGroup = (data.feegroup || data.studentgroup || 'general').toLowerCase().trim();
      const password = (data.password || 'Welcome@123').trim();

      // Rule 1: Validate Name
      if (!name) {
        failed.push({ row: rowIndex, email: email || null, error: 'Name is required' });
        continue;
      }

      // Rule 2: Validate Email
      if (!email) {
        failed.push({ row: rowIndex, email: null, error: 'Email is required' });
        continue;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        failed.push({ row: rowIndex, email, error: 'Invalid email format' });
        continue;
      }

      // Check email uniqueness within batch
      if (seenEmails.has(email)) {
        failed.push({ row: rowIndex, email, error: `Duplicate email "${email}" in bulk batch` });
        continue;
      }

      // Check email uniqueness in DB
      const existingUser = await User.findOne({ email, institutionId: tenantId });
      if (existingUser) {
        failed.push({ row: rowIndex, email, error: `User with email "${email}" already exists in this institution` });
        continue;
      }

      // Rule 3: Validate Role & Hierarchy
      const validRoles = ['STUDENT', 'FACULTY', 'HOD', 'CC', 'STAFF', 'ADMIN'];
      if (!validRoles.includes(rawRole)) {
        failed.push({ row: rowIndex, email, error: `Invalid role "${rawRole}". Allowed roles: ${validRoles.join(', ')}` });
        continue;
      }
      if (rawRole === 'SUPERADMIN') {
        failed.push({ row: rowIndex, email, error: 'Cannot create SUPERADMIN via bulk import' });
        continue;
      }

      // Department resolution if provided or required
      let resolvedDeptId = null;
      if (rawDept) {
        let deptDoc = null;
        if (mongoose.Types.ObjectId.isValid(rawDept)) {
          deptDoc = await Department.findOne({ _id: rawDept, institutionId: tenantId });
        }
        if (!deptDoc) {
          deptDoc = await Department.findOne({
            institutionId: tenantId,
            $or: [
              { code: rawDept.toUpperCase() },
              { name: new RegExp('^' + rawDept + '$', 'i') }
            ]
          });
        }
        if (!deptDoc) {
          failed.push({ row: rowIndex, email, error: `Department "${rawDept}" not found in this institution` });
          continue;
        }
        resolvedDeptId = deptDoc._id;
      }

      // Rule 4: HOD Hierarchy check (HOD must have department, and department must not have active HOD)
      if (rawRole === 'HOD') {
        if (!resolvedDeptId) {
          failed.push({ row: rowIndex, email, error: 'HOD requires a valid departmentId or department code' });
          continue;
        }
        const existingHod = await RoleAssignment.findOne({
          departmentId: resolvedDeptId,
          role: 'HOD',
          $or: [{ validTo: null }, { validTo: { $gt: new Date() } }]
        });
        if (existingHod) {
          failed.push({ row: rowIndex, email, error: `Department already has an active HOD` });
          continue;
        }
      }

      // Rule 5: Student Roll Number check
      if (rawRole === 'STUDENT') {
        if (!rollNumber) {
          failed.push({ row: rowIndex, email, error: 'rollNumber is required for students' });
          continue;
        }
        if (seenRollNumbers.has(rollNumber)) {
          failed.push({ row: rowIndex, email, error: `Duplicate rollNumber "${rollNumber}" in bulk batch` });
          continue;
        }
        const existingRoll = await User.findOne({ rollNumber, institutionId: tenantId });
        if (existingRoll) {
          failed.push({ row: rowIndex, email, error: `rollNumber "${rollNumber}" already exists in this institution` });
          continue;
        }
      }

      // All validations passed for this row -> create user and role assignment
      try {
        const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
        const newUser = await User.create({
          name,
          email,
          rollNumber: rollNumber || undefined,
          passwordHash,
          feeGroup,
          roles: [],
          institutionId: tenantId
        });

        await RoleAssignment.create({
          userId: newUser._id,
          role: rawRole,
          departmentId: resolvedDeptId,
          sectionId: null,
          institutionId: tenantId,
          validFrom: new Date()
        });

        seenEmails.add(email);
        if (rollNumber) seenRollNumbers.add(rollNumber);

        successful.push({
          row: rowIndex,
          userId: newUser._id,
          email: newUser.email,
          name: newUser.name,
          role: rawRole
        });
      } catch (insertErr) {
        failed.push({ row: rowIndex, email, error: insertErr.message });
      }
    }

    await logAudit(req, 'USERS_BULK_IMPORTED', tenantId?.toString() || 'INSTITUTION', 'User', {
      totalRows: parsedRows.length,
      importedCount: successful.length,
      failedCount: failed.length
    });

    res.status(200).json(success({
      totalRows: parsedRows.length,
      importedCount: successful.length,
      failedCount: failed.length,
      successful,
      failed
    }));
  } catch (err) {
    console.error('[UserController] Bulk import failed:', err);
    res.status(500).json(fail('Bulk import failed: ' + err.message));
  }
};

/**
 * Internal / Admin: Advance students' section/semester references on rollover
 * POST /users/rollover-enrolled
 */
const rolloverEnrolledStudents = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId || req.body.institutionId;
    const { sectionMap, nextSemesterId } = req.body;

    if (!sectionMap || typeof sectionMap !== 'object') {
      return res.status(400).json(fail('sectionMap is required'));
    }

    const oldSectionIds = Object.keys(sectionMap);
    if (oldSectionIds.length === 0) {
      return res.status(200).json(success({ updatedCount: 0 }));
    }

    let updatedCount = 0;
    for (const oldSecId of oldSectionIds) {
      const newSecId = sectionMap[oldSecId];
      if (!newSecId) continue;

      // Find active student role assignments in old section
      const activeAssignments = await RoleAssignment.find({
        sectionId: oldSecId,
        role: 'STUDENT',
        $or: [{ validTo: null }, { validTo: { $gt: new Date() } }]
      });

      for (const assignment of activeAssignments) {
        assignment.validTo = new Date();
        await assignment.save();

        await RoleAssignment.create({
          userId: assignment.userId,
          role: 'STUDENT',
          departmentId: assignment.departmentId,
          sectionId: newSecId,
          semesterId: nextSemesterId || null,
          institutionId: assignment.institutionId || tenantId,
          validFrom: new Date()
        });

        if (nextSemesterId) {
          await User.findByIdAndUpdate(assignment.userId, { activeSemesterId: nextSemesterId });
        }

        updatedCount++;
      }
    }

    res.status(200).json(success({ updatedCount }));
  } catch (err) {
    console.error('[UserController] Failed to rollover enrolled students:', err);
    res.status(500).json(fail('Failed to rollover enrolled students: ' + err.message));
  }
};

const listUsers = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const query = {};
    if (tenantId) query.institutionId = tenantId;
    const users = await User.find(query).select('-passwordHash').lean();
    res.status(200).json(success(users));
  } catch (err) {
    console.error('[UserController] Failed to list users:', err);
    res.status(500).json(fail('Internal server error'));
  }
};

module.exports = {
  createAdmin,
  createHOD,
  createFaculty,
  createCC,
  onboardStudent,
  bulkImportUsers,
  rolloverEnrolledStudents,
  listStudents,
  listHods,
  listAdmins,
  listFaculty,
  listCC,
  listUsers,
  getOwnProfile,
  updateOwnProfile,
  searchUsers,
  getUserById,
  updateUser,
  deleteUser
};

