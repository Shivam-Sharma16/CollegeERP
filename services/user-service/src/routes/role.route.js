const express = require('express');
const router = express.Router();
const { authenticate, requirePermission } = require('@college-erp/shared-utils');
const roleController = require('../controllers/role.controller');

// 1. Permission Catalog (matches /permissions-catalog, /catalog, /permissions/catalog)
router.get(['/permissions-catalog', '/catalog', '/permissions/catalog'], roleController.getPermissionCatalog);

// 2. Caller's own permissions
router.get('/my-permissions', authenticate, roleController.getMyPermissions);

// 3. Custom Role CRUD (Protected by 'role.manage' permission)
router.post(['/', '/custom', '/custom-roles'], authenticate, requirePermission('role.manage'), roleController.createCustomRole);
router.get(['/', '/custom', '/custom-roles'], authenticate, requirePermission('role.manage'), roleController.listCustomRoles);
router.get(['/:id', '/custom/:id', '/custom-roles/:id'], authenticate, requirePermission('role.manage'), roleController.getCustomRoleById);
router.patch(['/:id', '/custom/:id', '/custom-roles/:id'], authenticate, requirePermission('role.manage'), roleController.updateCustomRole);
router.delete(['/:id', '/custom/:id', '/custom-roles/:id'], authenticate, requirePermission('role.manage'), roleController.deleteCustomRole);

// 4. Role Assignment & Inspection
router.post(['/assign', '/assign-custom-role'], authenticate, requirePermission('role.manage'), roleController.assignCustomRole);
router.post('/unassign', authenticate, requirePermission('role.manage'), roleController.unassignCustomRole);
router.get('/effective-permissions/:userId', authenticate, requirePermission('role.manage'), roleController.getUserEffectivePermissions);

// 5. Test/Grievance Action Route (gated by 'grievance.resolve')
router.post(['/grievances/:id/resolve', '/:id/resolve'], authenticate, requirePermission('grievance.resolve'), roleController.resolveGrievance);

module.exports = router;
