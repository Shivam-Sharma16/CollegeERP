const mongoose = require('mongoose');
const CustomRole = require('../models/CustomRole.model');
const RoleAssignment = require('../models/RoleAssignment.model');
const User = require('../models/User.model');
const { PERMISSION_CATALOG } = require('@college-erp/shared-config');
const { success, fail, logAudit } = require('@college-erp/shared-utils');
const { getEffectivePermissions } = require('../services/role.service');

/**
 * GET /api/roles/permissions-catalog
 * Returns the immutable list of system permissions.
 */
const getPermissionCatalog = async (req, res) => {
  return res.json(success(PERMISSION_CATALOG));
};

/**
 * POST /api/roles/custom
 * Creates a new custom role within the caller's institution.
 */
const createCustomRole = async (req, res) => {
  try {
    const { name, description, permissions } = req.body;
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;

    if (!tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      return res.status(400).json(fail('Institution context (tenantId) is required'));
    }

    const institutionId = tenantId || req.body.institutionId;
    if (!institutionId) {
      return res.status(400).json(fail('institutionId is required'));
    }

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json(fail('Role name is required'));
    }

    if (!Array.isArray(permissions) || permissions.length === 0) {
      return res.status(400).json(fail('permissions array must be a non-empty array of valid permission keys'));
    }

    // Validate that every permission key belongs to the PERMISSION_CATALOG
    const invalidKeys = permissions.filter(p => !PERMISSION_CATALOG.includes(p));
    if (invalidKeys.length > 0) {
      return res.status(400).json(fail(`Invalid permission keys: ${invalidKeys.join(', ')}`));
    }

    // Check for duplicate name within this institution
    const existing = await CustomRole.findOne({
      institutionId: new mongoose.Types.ObjectId(institutionId),
      name: name.trim()
    });
    if (existing) {
      return res.status(409).json(fail(`A role named "${name.trim()}" already exists in this institution`));
    }

    const customRole = new CustomRole({
      institutionId: new mongoose.Types.ObjectId(institutionId),
      name: name.trim(),
      description: description ? description.trim() : '',
      permissions: Array.from(new Set(permissions)),
      createdBy: new mongoose.Types.ObjectId(req.user.userId || req.user.id),
      isActive: true
    });

    await customRole.save();

    await logAudit(req, 'CREATE_CUSTOM_ROLE', customRole._id.toString(), 'CustomRole', {
      name: customRole.name,
      permissions: customRole.permissions,
      institutionId: institutionId.toString()
    });

    return res.status(201).json(success(customRole));
  } catch (err) {
    console.error('[createCustomRole] Error:', err);
    return res.status(500).json(fail('Internal server error'));
  }
};

/**
 * GET /api/roles/custom
 * Lists all custom roles for the caller's institution.
 */
const listCustomRoles = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const filter = {};

    if (tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      filter.institutionId = new mongoose.Types.ObjectId(tenantId);
    } else if (req.query.institutionId) {
      filter.institutionId = new mongoose.Types.ObjectId(req.query.institutionId);
    }

    const roles = await CustomRole.find(filter)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    return res.json(success(roles));
  } catch (err) {
    console.error('[listCustomRoles] Error:', err);
    return res.status(500).json(fail('Internal server error'));
  }
};

/**
 * GET /api/roles/custom/:id
 * Retrieves a single custom role by ID.
 */
const getCustomRoleById = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const filter = { _id: req.params.id };

    if (tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      filter.institutionId = new mongoose.Types.ObjectId(tenantId);
    }

    const role = await CustomRole.findOne(filter).populate('createdBy', 'name email');
    if (!role) {
      return res.status(404).json(fail('Custom role not found'));
    }

    return res.json(success(role));
  } catch (err) {
    console.error('[getCustomRoleById] Error:', err);
    return res.status(500).json(fail('Internal server error'));
  }
};

/**
 * PATCH /api/roles/custom/:id
 * Updates an existing custom role.
 */
const updateCustomRole = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const filter = { _id: req.params.id };

    if (tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      filter.institutionId = new mongoose.Types.ObjectId(tenantId);
    }

    const role = await CustomRole.findOne(filter);
    if (!role) {
      return res.status(404).json(fail('Custom role not found'));
    }

    const { name, description, permissions, isActive } = req.body;

    if (name !== undefined) {
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json(fail('Role name cannot be empty'));
      }
      // If name is changing, check uniqueness
      if (name.trim() !== role.name) {
        const dup = await CustomRole.findOne({
          institutionId: role.institutionId,
          name: name.trim(),
          _id: { $ne: role._id }
        });
        if (dup) {
          return res.status(409).json(fail(`A role named "${name.trim()}" already exists`));
        }
        role.name = name.trim();
      }
    }

    if (description !== undefined) {
      role.description = typeof description === 'string' ? description.trim() : '';
    }

    if (permissions !== undefined) {
      if (!Array.isArray(permissions) || permissions.length === 0) {
        return res.status(400).json(fail('permissions must be a non-empty array'));
      }
      const invalidKeys = permissions.filter(p => !PERMISSION_CATALOG.includes(p));
      if (invalidKeys.length > 0) {
        return res.status(400).json(fail(`Invalid permission keys: ${invalidKeys.join(', ')}`));
      }
      role.permissions = Array.from(new Set(permissions));
    }

    if (isActive !== undefined) {
      role.isActive = Boolean(isActive);
    }

    await role.save();

    await logAudit(req, 'UPDATE_CUSTOM_ROLE', role._id.toString(), 'CustomRole', {
      name: role.name,
      permissions: role.permissions,
      isActive: role.isActive
    });

    return res.json(success(role));
  } catch (err) {
    console.error('[updateCustomRole] Error:', err);
    return res.status(500).json(fail('Internal server error'));
  }
};

/**
 * DELETE /api/roles/custom/:id or /custom-roles/:id
 * Deletes a custom role.
 * Blocked if any users still hold active assignments (matching Phase 13 pattern).
 */
const deleteCustomRole = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const filter = { _id: req.params.id };

    if (tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      filter.institutionId = new mongoose.Types.ObjectId(tenantId);
    }

    const role = await CustomRole.findOne(filter);
    if (!role) {
      return res.status(404).json(fail('Custom role not found'));
    }

    // Explicit blocking checks — no silent cascade delete (Phase 13 pattern)
    const now = new Date();
    const assignFilter = {
      customRoleId: role._id,
      $or: [
        { validTo: null },
        { validTo: { $gt: now } }
      ]
    };
    if (tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      assignFilter.institutionId = new mongoose.Types.ObjectId(tenantId);
    }

    const activeAssignments = await RoleAssignment.find(assignFilter);
    const userIds = new Set(activeAssignments.map(a => a.userId.toString()));
    const activeUsersCount = userIds.size;

    if (activeUsersCount > 0) {
      return res.status(409).json(fail(`${activeUsersCount} users still hold this role`));
    }

    // Clean up any historical/expired assignments if any remain
    await RoleAssignment.deleteMany({ customRoleId: role._id });
    await role.deleteOne();

    await logAudit(req, 'DELETE_CUSTOM_ROLE', role._id.toString(), 'CustomRole', {
      name: role.name,
      institutionId: role.institutionId.toString()
    });

    return res.json(success({ message: `Custom role "${role.name}" deleted successfully` }));
  } catch (err) {
    console.error('[deleteCustomRole] Error:', err);
    return res.status(500).json(fail('Internal server error'));
  }
};

/**
 * POST /api/roles/assign or /users/:id/assign-custom-role
 * Assigns a custom role to a user.
 */
const assignCustomRole = async (req, res) => {
  try {
    const userId = req.params.id || req.body.userId;
    const { customRoleId, departmentId, sectionId, validFrom, validTo } = req.body;
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;

    if (!userId || !customRoleId) {
      return res.status(400).json(fail('userId and customRoleId are required'));
    }

    const roleFilter = { _id: customRoleId, isActive: true };
    if (tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      roleFilter.institutionId = new mongoose.Types.ObjectId(tenantId);
    }

    const customRole = await CustomRole.findOne(roleFilter);
    if (!customRole) {
      return res.status(404).json(fail('Active custom role not found in this institution'));
    }

    // Check target user
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json(fail('Target user not found'));
    }

    // Check if duplicate active assignment already exists
    const now = new Date();
    const existingAssignment = await RoleAssignment.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      customRoleId: customRole._id,
      institutionId: customRole.institutionId,
      $or: [
        { validTo: null },
        { validTo: { $gt: now } }
      ]
    });

    if (existingAssignment) {
      return res.status(409).json(fail('User is already assigned this custom role'));
    }

    const assignment = new RoleAssignment({
      userId: targetUser._id,
      customRoleId: customRole._id,
      institutionId: customRole.institutionId,
      departmentId: departmentId ? new mongoose.Types.ObjectId(departmentId) : undefined,
      sectionId: sectionId ? new mongoose.Types.ObjectId(sectionId) : undefined,
      validFrom: validFrom ? new Date(validFrom) : new Date(),
      validTo: validTo ? new Date(validTo) : null
    });

    await assignment.save();

    await logAudit(req, 'ASSIGN_CUSTOM_ROLE', assignment._id.toString(), 'RoleAssignment', {
      userId: targetUser._id.toString(),
      customRoleId: customRole._id.toString(),
      roleName: customRole.name
    });

    return res.status(201).json(success(assignment));
  } catch (err) {
    console.error('[assignCustomRole] Error:', err);
    return res.status(500).json(fail('Internal server error'));
  }
};

/**
 * POST /api/roles/unassign
 * Unassigns a custom role from a user.
 */
const unassignCustomRole = async (req, res) => {
  try {
    const { userId, customRoleId } = req.body;
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;

    if (!userId || !customRoleId) {
      return res.status(400).json(fail('userId and customRoleId are required'));
    }

    const filter = {
      userId: new mongoose.Types.ObjectId(userId),
      customRoleId: new mongoose.Types.ObjectId(customRoleId)
    };
    if (tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      filter.institutionId = new mongoose.Types.ObjectId(tenantId);
    }

    const deleted = await RoleAssignment.deleteMany(filter);

    await logAudit(req, 'UNASSIGN_CUSTOM_ROLE', customRoleId.toString(), 'RoleAssignment', {
      userId,
      deletedCount: deleted.deletedCount
    });

    return res.json(success({ message: 'Custom role unassigned successfully', count: deleted.deletedCount }));
  } catch (err) {
    console.error('[unassignCustomRole] Error:', err);
    return res.status(500).json(fail('Internal server error'));
  }
};

/**
 * GET /api/roles/effective-permissions/:userId
 * Returns the effective permissions for any user in this institution.
 */
const getUserEffectivePermissions = async (req, res) => {
  try {
    const { userId } = req.params;
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;

    const permissions = await getEffectivePermissions(userId, tenantId);
    return res.json(success({ userId, permissions }));
  } catch (err) {
    console.error('[getUserEffectivePermissions] Error:', err);
    return res.status(500).json(fail('Internal server error'));
  }
};

/**
 * GET /api/roles/my-permissions
 * Returns the effective permissions for the authenticated caller.
 */
const getMyPermissions = async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const callerRoles = req.user?.roles || [];

    const permissions = await getEffectivePermissions(userId, tenantId, callerRoles);
    return res.json(success({ permissions }));
  } catch (err) {
    console.error('[getMyPermissions] Error:', err);
    return res.status(500).json(fail('Internal server error'));
  }
};

/**
 * POST /api/grievances/:id/resolve
 * Endpoint protected by requirePermission('grievance.resolve')
 */
const resolveGrievance = async (req, res) => {
  try {
    const { id } = req.params;
    return res.json(success({
      message: 'Grievance resolved successfully',
      grievanceId: id,
      resolvedBy: req.user.userId || req.user.id,
      resolvedAt: new Date().toISOString()
    }));
  } catch (err) {
    return res.status(500).json(fail('Internal server error'));
  }
};

module.exports = {
  getPermissionCatalog,
  createCustomRole,
  listCustomRoles,
  getCustomRoleById,
  updateCustomRole,
  deleteCustomRole,
  assignCustomRole,
  unassignCustomRole,
  getUserEffectivePermissions,
  getMyPermissions,
  resolveGrievance
};
