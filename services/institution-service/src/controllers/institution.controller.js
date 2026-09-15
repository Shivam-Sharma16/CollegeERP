const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const Institution = require('../models/Institution.model');
const User = require('../models/User.model');
const { success, fail, logAudit } = require('@college-erp/shared-utils');
const { invalidateTenantCache } = require('../config/redis');

const BCRYPT_COST = 12;

const RESERVED_SUBDOMAINS = new Set([
  'admin', 'superadmin', 'api', 'app', 'portal', 'auth', 'www', 'mail', 
  'support', 'help', 'root', 'localhost', 'dashboard', 'status'
]);

const checkSuperAdmin = async (req) => {
  if (req.user?.roles && req.user.roles.includes('SUPERADMIN')) return true;
  if (mongoose.connection.db) {
    const user = await mongoose.connection.db.collection('users').findOne({
      _id: new mongoose.Types.ObjectId(req.user?.userId || req.user?.id)
    });
    if (user && user.roles && user.roles.includes('SUPERADMIN')) {
      req.user.roles = user.roles;
      return true;
    }
  }
  return false;
};

/**
 * Create a new Institution along with its designated initial Admin
 * Access: SUPERADMIN only (Root domain only)
 */
const createInstitution = async (req, res) => {
  try {
    if (req.tenantId) {
      return res.status(403).json(fail('SuperAdmin institution management is only allowed on the root domain'));
    }

    const isSuperAdmin = await checkSuperAdmin(req);
    if (!isSuperAdmin) {
      return res.status(403).json(fail('Only SUPERADMIN can create institutions'));
    }

    const {
      name,
      subdomain,
      slug,
      code,
      customDomain,
      domain,
      logoUrl,
      themeConfig,
      branding,
      admin
    } = req.body;

    const normalizedSubdomain = (subdomain || slug || '').trim().toLowerCase();
    const normalizedName = (name || '').trim();
    const normalizedCode = (code || normalizedSubdomain.toUpperCase().slice(0, 6)).trim().toUpperCase();

    if (!normalizedName || !normalizedSubdomain) {
      return res.status(400).json(fail('Institution name and subdomain are required'));
    }

    // Check subdomain pattern: lowercase alphanumeric and hyphens only
    const subdomainRegex = /^[a-z0-9-]+$/;
    if (!subdomainRegex.test(normalizedSubdomain)) {
      return res.status(400).json(fail('Subdomain must contain only lowercase letters, numbers, and hyphens'));
    }

    if (RESERVED_SUBDOMAINS.has(normalizedSubdomain)) {
      return res.status(409).json(fail('This subdomain is reserved by the platform'));
    }

    if (!admin || !admin.name || !admin.email || !admin.password) {
      return res.status(400).json(fail('Admin name, email, and password are required'));
    }

    // Check existing institution
    const existingInst = await Institution.findOne({
      $or: [
        { subdomain: normalizedSubdomain },
        { slug: normalizedSubdomain },
        { code: normalizedCode }
      ]
    });

    if (existingInst) {
      if (existingInst.subdomain === normalizedSubdomain || existingInst.slug === normalizedSubdomain) {
        return res.status(409).json(fail('An institution with this subdomain already exists'));
      }
      return res.status(409).json(fail('An institution with this code already exists'));
    }

    // Check if admin email already taken by a SUPERADMIN
    const existingSuperAdmin = await mongoose.connection.db.collection('users').findOne({
      email: admin.email.toLowerCase().trim(),
      roles: 'SUPERADMIN'
    });
    if (existingSuperAdmin) {
      return res.status(409).json(fail('Admin email cannot be a SuperAdmin email'));
    }

    const superAdminUserId = req.user?.userId ? new mongoose.Types.ObjectId(req.user.userId) : null;

    // 1. Create Institution
    const resolvedTheme = {
      primaryColor: themeConfig?.primaryColor || branding?.primaryColor || '#4f46e5',
      secondaryColor: themeConfig?.secondaryColor || branding?.secondaryColor || '#06b6d4',
      faviconUrl: themeConfig?.faviconUrl || branding?.faviconUrl || '',
      coverImageUrl: req.body.coverImageUrl || themeConfig?.coverImageUrl || branding?.coverImageUrl || ''
    };
    const resolvedLogo = logoUrl || branding?.logoUrl || '';
    const resolvedCoverImage = req.body.coverImageUrl || themeConfig?.coverImageUrl || branding?.coverImageUrl || '';
    const resolvedCustomDomain = (customDomain || domain) ? (customDomain || domain).trim().toLowerCase() : undefined;

    const institution = await Institution.create({
      name: normalizedName,
      subdomain: normalizedSubdomain,
      slug: normalizedSubdomain,
      code: normalizedCode,
      customDomain: resolvedCustomDomain,
      domain: resolvedCustomDomain,
      logoUrl: resolvedLogo,
      coverImageUrl: resolvedCoverImage,
      themeConfig: resolvedTheme,
      branding: {
        ...resolvedTheme,
        logoUrl: resolvedLogo,
        coverImageUrl: resolvedCoverImage
      },
      isActive: true,
      status: 'ACTIVE',
      createdBy: superAdminUserId
    });

    // 2. Create Initial Admin User bound to this institution
    const passwordHash = await bcrypt.hash(admin.password, BCRYPT_COST);
    const adminUser = {
      _id: new mongoose.Types.ObjectId(),
      name: admin.name.trim(),
      email: admin.email.toLowerCase().trim(),
      passwordHash,
      roles: ['ADMIN'],
      institutionId: institution._id,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    await mongoose.connection.db.collection('users').insertOne(adminUser);

    // 3. Assign ADMIN RoleAssignment
    await mongoose.connection.db.collection('roleassignments').insertOne({
      _id: new mongoose.Types.ObjectId(),
      userId: adminUser._id,
      role: 'ADMIN',
      institutionId: institution._id,
      departmentId: null,
      sectionId: null,
      validFrom: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // 4. Update Institution with adminUserId
    institution.adminUserId = adminUser._id;
    await institution.save();

    // 5. Audit Log
    await logAudit(
      req,
      'INSTITUTION_CREATED',
      institution._id.toString(),
      'Institution',
      {
        name: institution.name,
        subdomain: institution.subdomain,
        adminEmail: adminUser.email,
        institutionId: institution._id.toString()
      }
    );

    res.status(201).json(success({
      institution,
      admin: {
        _id: adminUser._id,
        name: adminUser.name,
        email: adminUser.email,
        roles: adminUser.roles,
        institutionId: adminUser.institutionId
      }
    }));
  } catch (err) {
    console.error('[InstitutionController] Failed to create institution:', err);
    res.status(500).json(fail(err.message || 'Internal server error'));
  }
};

/**
 * List all institutions
 * Access: SUPERADMIN only (Root domain only)
 */
const listInstitutions = async (req, res) => {
  try {
    if (req.tenantId) {
      return res.status(403).json(fail('SuperAdmin institution management is only allowed on the root domain'));
    }

    const isSuperAdmin = await checkSuperAdmin(req);
    if (!isSuperAdmin) {
      return res.status(403).json(fail('Only SUPERADMIN can view all institutions'));
    }

    const institutions = await Institution.find()
      .populate('adminUserId', 'name email isActive')
      .sort({ createdAt: -1 })
      .lean();

    // Aggregate user counts per institution (students, faculty, total)
    let userStatsMap = {};
    if (mongoose.connection.db) {
      const counts = await mongoose.connection.db.collection('users').aggregate([
        { $match: { institutionId: { $ne: null } } },
        {
          $group: {
            _id: '$institutionId',
            totalUsers: { $sum: 1 },
            studentCount: {
              $sum: { $cond: [{ $in: ['STUDENT', '$roles'] }, 1, 0] }
            },
            facultyCount: {
              $sum: { $cond: [{ $in: ['FACULTY', '$roles'] }, 1, 0] }
            }
          }
        }
      ]).toArray();

      counts.forEach(c => {
        userStatsMap[c._id.toString()] = {
          studentCount: c.studentCount || 0,
          facultyCount: c.facultyCount || 0,
          totalUsers: c.totalUsers || 0
        };
      });
    }

    // Aggregate department counts per institution
    let deptMap = {};
    if (mongoose.connection.db) {
      const deptCounts = await mongoose.connection.db.collection('departments').aggregate([
        { $match: { institutionId: { $ne: null } } },
        {
          $group: {
            _id: '$institutionId',
            departmentCount: { $sum: 1 }
          }
        }
      ]).toArray();

      deptCounts.forEach(d => {
        deptMap[d._id.toString()] = d.departmentCount || 0;
      });
    }

    const result = institutions.map(inst => {
      const idStr = inst._id.toString();
      const uStats = userStatsMap[idStr] || { studentCount: 0, facultyCount: 0, totalUsers: 0 };
      return {
        ...inst,
        studentCount: uStats.studentCount,
        facultyCount: uStats.facultyCount,
        departmentCount: deptMap[idStr] || 0,
        userCount: uStats.totalUsers
      };
    });

    res.status(200).json(success(result));
  } catch (err) {
    console.error('[InstitutionController] Failed to list institutions:', err);
    res.status(500).json(fail('Internal server error'));
  }
};

/**
 * Resolve institution branding & details by subdomain or slug
 * Access: Public
 */
const resolveInstitutionBySlug = async (req, res) => {
  try {
    const slugOrSubdomain = req.params.slug || req.params.subdomain;
    if (!slugOrSubdomain) {
      return res.status(400).json(fail('Subdomain is required'));
    }

    const target = slugOrSubdomain.toLowerCase().trim();
    const institution = await Institution.findOne({
      $or: [
        { subdomain: target },
        { slug: target },
        { customDomain: target },
        { domain: target }
      ]
    }).select('name code subdomain slug domain customDomain branding themeConfig logoUrl coverImageUrl isActive status').lean();

    if (!institution) {
      return res.status(404).json(fail('Institution not found'));
    }

    if (!institution.isActive && institution.status !== 'ACTIVE') {
      return res.status(403).json(fail('Institution is suspended or inactive'));
    }

    res.status(200).json(success(institution));
  } catch (err) {
    console.error('[InstitutionController] Failed to resolve institution:', err);
    res.status(500).json(fail('Internal server error'));
  }
};

/**
 * Get institution details by ID
 */
const getInstitutionById = async (req, res) => {
  try {
    const { id } = req.params;
    const isSuperAdmin = req.user?.roles?.includes('SUPERADMIN');
    const isOwnTenant = req.user?.institutionId && req.user.institutionId.toString() === id;

    if (!isSuperAdmin && !isOwnTenant) {
      return res.status(403).json(fail('Access denied'));
    }

    const institution = await Institution.findById(id)
      .populate('adminUserId', 'name email isActive')
      .lean();

    if (!institution) {
      return res.status(404).json(fail('Institution not found'));
    }

    res.status(200).json(success(institution));
  } catch (err) {
    console.error('[InstitutionController] Failed to get institution:', err);
    res.status(500).json(fail('Internal server error'));
  }
};

/**
 * Update institution details/theme
 */
const updateInstitution = async (req, res) => {
  try {
    const { id } = req.params;
    const isSuperAdmin = req.user?.roles?.includes('SUPERADMIN');
    const isTenantAdmin = req.user?.roles?.includes('ADMIN') && req.user?.institutionId && req.user.institutionId.toString() === id;

    if (!isSuperAdmin && !isTenantAdmin) {
      return res.status(403).json(fail('Access denied'));
    }

    const { name, code, subdomain, slug, themeConfig, branding, customDomain, domain, logoUrl, coverImageUrl, isActive, status } = req.body;
    const updateData = {};

    if (name) updateData.name = name.trim();
    if (code) updateData.code = code.trim().toUpperCase();
    if (subdomain || slug) {
      const targetSub = (subdomain || slug).trim().toLowerCase();
      updateData.subdomain = targetSub;
      updateData.slug = targetSub;
    }

    if (customDomain !== undefined) {
      updateData.customDomain = customDomain ? customDomain.trim().toLowerCase() : null;
      updateData.domain = updateData.customDomain;
    } else if (domain !== undefined) {
      updateData.customDomain = domain ? domain.trim().toLowerCase() : null;
      updateData.domain = updateData.customDomain;
    }

    if (logoUrl !== undefined) {
      updateData.logoUrl = logoUrl;
    }

    if (coverImageUrl !== undefined) {
      updateData.coverImageUrl = coverImageUrl;
    }

    if (themeConfig || branding) {
      const theme = themeConfig || branding;
      updateData.themeConfig = {
        primaryColor: theme.primaryColor || '#4f46e5',
        secondaryColor: theme.secondaryColor || '#06b6d4',
        faviconUrl: theme.faviconUrl || '',
        coverImageUrl: updateData.coverImageUrl !== undefined ? updateData.coverImageUrl : (theme.coverImageUrl || '')
      };
      updateData.branding = {
        logoUrl: updateData.logoUrl !== undefined ? updateData.logoUrl : (theme.logoUrl || ''),
        faviconUrl: updateData.themeConfig.faviconUrl,
        coverImageUrl: updateData.themeConfig.coverImageUrl,
        primaryColor: updateData.themeConfig.primaryColor,
        secondaryColor: updateData.themeConfig.secondaryColor
      };
    }

    if (isSuperAdmin) {
      if (isActive !== undefined) {
        updateData.isActive = isActive;
        updateData.status = isActive ? 'ACTIVE' : 'SUSPENDED';
      } else if (status !== undefined) {
        updateData.status = status;
        updateData.isActive = status === 'ACTIVE';
      }
    } else if (isActive !== undefined || status !== undefined) {
      return res.status(403).json(fail('Only SUPERADMIN can activate or deactivate institutions'));
    }

    if ((isActive !== undefined || status !== undefined) && req.tenantId) {
      return res.status(403).json(fail('SuperAdmin institution management is only allowed on the root domain'));
    }

    const updated = await Institution.findByIdAndUpdate(id, updateData, { new: true })
      .populate('adminUserId', 'name email isActive');

    if (!updated) {
      return res.status(404).json(fail('Institution not found'));
    }

    await invalidateTenantCache(updated.subdomain, updated.slug, updated.customDomain, updated.domain);

    await logAudit(
      req,
      'INSTITUTION_UPDATED',
      updated._id.toString(),
      'Institution',
      { ...updateData, institutionId: updated._id.toString() }
    );

    res.status(200).json(success(updated));
  } catch (err) {
    console.error('[InstitutionController] Failed to update institution:', err);
    res.status(500).json(fail('Internal server error'));
  }
};

/**
 * Delete an institution and clean up associated records
 * Access: SUPERADMIN only (Root domain only)
 */
const deleteInstitution = async (req, res) => {
  try {
    const isSuperAdmin = await checkSuperAdmin(req);
    if (!isSuperAdmin) {
      return res.status(403).json(fail('Only SUPERADMIN can delete institutions'));
    }

    const { id } = req.params;
    const institution = await Institution.findById(id);
    if (!institution) {
      return res.status(404).json(fail('Institution not found'));
    }

    // Invalidate Redis cache
    await invalidateTenantCache(institution.subdomain, institution.slug, institution.customDomain, institution.domain);

    // Delete the institution document
    await Institution.findByIdAndDelete(id);

    // Clean up associated resources in database
    if (mongoose.connection.db) {
      const instId = new mongoose.Types.ObjectId(id);
      await Promise.all([
        mongoose.connection.db.collection('users').deleteMany({ institutionId: instId }),
        mongoose.connection.db.collection('roleassignments').deleteMany({ institutionId: instId }),
        mongoose.connection.db.collection('departments').deleteMany({ institutionId: instId })
      ]).catch(e => console.warn('[InstitutionController] Cleanup warning:', e.message));
    }

    await logAudit(
      req,
      'INSTITUTION_DELETED',
      id,
      'Institution',
      { name: institution.name, subdomain: institution.subdomain }
    );

    res.status(200).json(success({ message: `Institution "${institution.name}" deleted successfully.` }));
  } catch (err) {
    console.error('[InstitutionController] Failed to delete institution:', err);
    res.status(500).json(fail(err.message || 'Internal server error'));
  }
};

/**
 * Live Subdomain Availability Check
 * Access: Public / SuperAdmin (Frontend live typing validation)
 * Query/Param: ?subdomain=... or /:subdomain/check-subdomain or /:id/check-subdomain
 */
const checkSubdomainAvailability = async (req, res) => {
  try {
    const rawSubdomain = req.query.subdomain || req.params.subdomain || req.params.id || '';
    const normalized = rawSubdomain.trim().toLowerCase();

    if (!normalized) {
      return res.status(400).json(fail('Subdomain is required'));
    }

    const subdomainRegex = /^[a-z0-9-]+$/;
    if (!subdomainRegex.test(normalized)) {
      return res.status(200).json(success({
        available: false,
        subdomain: normalized,
        reason: 'Subdomain must contain only lowercase letters, numbers, and hyphens'
      }));
    }

    if (RESERVED_SUBDOMAINS.has(normalized)) {
      return res.status(200).json(success({
        available: false,
        subdomain: normalized,
        reason: 'This subdomain is reserved by the platform'
      }));
    }

    const existing = await Institution.findOne({
      $or: [
        { subdomain: normalized },
        { slug: normalized }
      ]
    }).select('_id subdomain name').lean();

    if (existing) {
      return res.status(200).json(success({
        available: false,
        subdomain: normalized,
        reason: 'Subdomain is already taken'
      }));
    }

    return res.status(200).json(success({
      available: true,
      subdomain: normalized,
      message: 'Subdomain is available'
    }));
  } catch (err) {
    console.error('[InstitutionController] Subdomain check error:', err);
    return res.status(500).json(fail('Internal server error'));
  }
};

/**
 * Public branding endpoint (Tenant-resolved, unauthenticated)
 * Returns { name, logoUrl, primaryColor, secondaryColor, faviconUrl }
 */
const getInstitutionBranding = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'];
    const subdomain = req.query.subdomain || req.query.slug || req.params.subdomain || req.headers['x-tenant-subdomain'];

    let institution = null;

    if (tenantId && mongoose.Types.ObjectId.isValid(tenantId)) {
      institution = await Institution.findById(tenantId)
        .select('name logoUrl themeConfig branding isActive status')
        .lean();
    } else if (subdomain) {
      const normalized = subdomain.toLowerCase().trim();
      institution = await Institution.findOne({
        $or: [
          { subdomain: normalized },
          { slug: normalized },
          { customDomain: normalized },
          { domain: normalized }
        ]
      }).select('name logoUrl themeConfig branding isActive status').lean();
    }

    if (!institution) {
      return res.status(404).json(fail('Institution not found'));
    }

    if (institution.isActive === false || institution.status === 'SUSPENDED') {
      return res.status(403).json(fail('Institution is suspended or inactive'));
    }

    const brandingData = {
      name: institution.name,
      logoUrl: institution.logoUrl || institution.branding?.logoUrl || '',
      primaryColor: institution.themeConfig?.primaryColor || institution.branding?.primaryColor || '#4f46e5',
      secondaryColor: institution.themeConfig?.secondaryColor || institution.branding?.secondaryColor || '#06b6d4',
      faviconUrl: institution.themeConfig?.faviconUrl || institution.branding?.faviconUrl || ''
    };

    return res.status(200).json(success(brandingData));
  } catch (err) {
    console.error('[InstitutionController] Failed to get branding:', err);
    return res.status(500).json(fail('Internal server error'));
  }
};

module.exports = {
  createInstitution,
  listInstitutions,
  resolveInstitutionBySlug,
  getInstitutionById,
  updateInstitution,
  deleteInstitution,
  checkSubdomainAvailability,
  getInstitutionBranding
};

