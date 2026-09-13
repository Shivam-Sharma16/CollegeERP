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
    const { name, email, password, rollNumber } = req.body;
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
  listStudents,
  listHods,
  listAdmins,
  listFaculty,
  listCC,
  listUsers,
  updateOwnProfile,
  searchUsers,
  getUserById,
  updateUser,
  deleteUser
};
