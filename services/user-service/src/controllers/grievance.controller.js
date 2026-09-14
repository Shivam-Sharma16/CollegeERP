const mongoose = require('mongoose');
const Grievance = require('../models/Grievance.model');
const RoleAssignment = require('../models/RoleAssignment.model');
const { success, fail, logAudit } = require('@college-erp/shared-utils');

/**
 * POST /grievances
 * Raise a new grievance
 */
exports.createGrievance = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId || req.body.institutionId;
    const userId = req.user?.userId || req.user?.id;
    const { category, title, description, departmentId } = req.body;

    if (!category || !description) {
      return res.status(400).json(fail('Category and description are required'));
    }

    if (!tenantId) {
      return res.status(400).json(fail('Institution ID is required'));
    }

    let targetDeptId = departmentId || null;
    if (!targetDeptId) {
      // Lookup caller's active role assignment to associate department
      const assignment = await RoleAssignment.findOne({
        userId,
        departmentId: { $ne: null },
        $or: [{ validTo: null }, { validTo: { $gt: new Date() } }]
      });
      if (assignment) {
        targetDeptId = assignment.departmentId;
      }
    }

    const grievance = await Grievance.create({
      institutionId: tenantId,
      raisedBy: userId,
      departmentId: targetDeptId,
      category: category.trim().toLowerCase(),
      title: title ? title.trim() : `${category} issue`,
      description: description.trim(),
      status: 'open'
    });

    await logAudit(req, 'GRIEVANCE_RAISED', grievance._id.toString(), 'Grievance', {
      category,
      departmentId: targetDeptId,
      institutionId: tenantId
    });

    res.status(201).json(success(grievance));
  } catch (err) {
    console.error('[GrievanceController] Failed to create grievance:', err);
    res.status(500).json(fail('Failed to create grievance: ' + err.message));
  }
};

/**
 * GET /grievances
 * Scoped list:
 * - Student sees only their own
 * - HOD sees their department
 * - Admin sees institution-wide
 */
exports.listGrievances = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const userId = req.user?.userId || req.user?.id;
    const roles = req.user?.roles || [];
    const isSuperAdmin = roles.includes('SUPERADMIN');
    const isAdmin = roles.includes('ADMIN');
    const isHOD = roles.includes('HOD');

    const filter = {};
    if (tenantId && !isSuperAdmin) {
      filter.institutionId = tenantId;
    }

    if (req.query.status) {
      filter.status = req.query.status.toLowerCase();
    }
    if (req.query.category) {
      filter.category = req.query.category.toLowerCase();
    }

    // Role-based scoping
    if (isSuperAdmin || isAdmin) {
      // Institution-wide scope: no extra filter needed
    } else if (isHOD) {
      // HOD scope: limited to caller's department
      let deptId = null;
      const hodRole = req.effectiveRoles?.find(r => r.role === 'HOD');
      if (hodRole?.departmentId) {
        deptId = hodRole.departmentId;
      } else {
        const assignment = await RoleAssignment.findOne({
          userId,
          role: 'HOD',
          $or: [{ validTo: null }, { validTo: { $gt: new Date() } }]
        });
        if (assignment?.departmentId) deptId = assignment.departmentId;
      }

      if (deptId) {
        filter.departmentId = deptId;
      } else {
        filter.raisedBy = userId;
      }
    } else {
      // Default: Student, Faculty, Staff see ONLY their own grievances
      filter.raisedBy = userId;
    }

    const grievances = await Grievance.find(filter)
      .populate('raisedBy', 'name email rollNumber')
      .populate('assignedTo', 'name email')
      .populate('departmentId', 'name code')
      .sort({ createdAt: -1 });

    res.status(200).json(success(grievances));
  } catch (err) {
    console.error('[GrievanceController] Failed to list grievances:', err);
    res.status(500).json(fail('Failed to list grievances: ' + err.message));
  }
};

/**
 * GET /grievances/:id
 * Retrieve a specific grievance with scope enforcement
 */
exports.getGrievanceById = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const userId = (req.user?.userId || req.user?.id || '').toString();
    const roles = req.user?.roles || [];
    const isSuperAdmin = roles.includes('SUPERADMIN');
    const isAdmin = roles.includes('ADMIN');
    const isHOD = roles.includes('HOD');

    const filter = { _id: req.params.id };
    if (tenantId && !isSuperAdmin) {
      filter.institutionId = tenantId;
    }

    const grievance = await Grievance.findOne(filter)
      .populate('raisedBy', 'name email rollNumber')
      .populate('assignedTo', 'name email')
      .populate('departmentId', 'name code');

    if (!grievance) {
      return res.status(404).json(fail('Grievance not found'));
    }

    // Check scope if caller is regular student/user
    if (!isSuperAdmin && !isAdmin) {
      if (isHOD) {
        let deptId = null;
        const hodRole = req.effectiveRoles?.find(r => r.role === 'HOD');
        if (hodRole?.departmentId) {
          deptId = hodRole.departmentId.toString();
        } else {
          const assignment = await RoleAssignment.findOne({
            userId,
            role: 'HOD',
            $or: [{ validTo: null }, { validTo: { $gt: new Date() } }]
          });
          if (assignment?.departmentId) deptId = assignment.departmentId.toString();
        }
        const gDeptId = grievance.departmentId?._id?.toString() || grievance.departmentId?.toString();
        const isOwner = (grievance.raisedBy?._id || grievance.raisedBy).toString() === userId;
        if (!isOwner && (!deptId || gDeptId !== deptId)) {
          return res.status(403).json(fail('Access Denied: Grievance outside your department scope'));
        }
      } else {
        const ownerId = (grievance.raisedBy?._id || grievance.raisedBy).toString();
        if (ownerId !== userId) {
          return res.status(403).json(fail('Access Denied: You can only view your own grievances'));
        }
      }
    }

    res.status(200).json(success(grievance));
  } catch (err) {
    console.error('[GrievanceController] Failed to get grievance:', err);
    res.status(500).json(fail('Failed to get grievance: ' + err.message));
  }
};

/**
 * POST /grievances/:id/resolve (or PATCH)
 * Resolve a grievance
 */
exports.resolveGrievance = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const userId = req.user?.userId || req.user?.id;
    const { resolution, notes } = req.body;

    const filter = { _id: req.params.id };
    if (tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      filter.institutionId = tenantId;
    }

    const grievance = await Grievance.findOne(filter);
    if (!grievance) {
      return res.status(404).json(fail('Grievance not found'));
    }

    grievance.status = 'resolved';
    grievance.resolution = (resolution || notes || 'Resolved').trim();
    grievance.resolvedBy = userId;
    grievance.resolvedAt = new Date();

    await grievance.save();

    await logAudit(req, 'GRIEVANCE_RESOLVED', grievance._id.toString(), 'Grievance', {
      resolution: grievance.resolution,
      institutionId: tenantId
    });

    res.status(200).json(success(grievance));
  } catch (err) {
    console.error('[GrievanceController] Failed to resolve grievance:', err);
    res.status(500).json(fail('Failed to resolve grievance: ' + err.message));
  }
};

/**
 * PATCH /grievances/:id/assign
 * Assign grievance to user or change status
 */
exports.assignGrievance = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const { assignedTo, status } = req.body;

    const filter = { _id: req.params.id };
    if (tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      filter.institutionId = tenantId;
    }

    const grievance = await Grievance.findOne(filter);
    if (!grievance) {
      return res.status(404).json(fail('Grievance not found'));
    }

    if (assignedTo !== undefined) grievance.assignedTo = assignedTo || null;
    if (status) grievance.status = status;
    else if (!grievance.status || grievance.status === 'open') grievance.status = 'in_progress';

    await grievance.save();
    res.status(200).json(success(grievance));
  } catch (err) {
    console.error('[GrievanceController] Failed to assign grievance:', err);
    res.status(500).json(fail('Failed to assign grievance: ' + err.message));
  }
};
