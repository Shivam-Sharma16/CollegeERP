const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const Institution = require('../models/Institution.model');
const { success, fail, logAudit } = require('@college-erp/shared-utils');
const { invalidateTenantCache } = require('../config/redis');

const BCRYPT_COST = 12;

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
 * Access: SUPERADMIN only
 */
const createInstitution = async (req, res) => {
  try {
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

    // Check if admin email already taken
    const existingUser = await mongoose.connection.db.collection('users').findOne({
      email: admin.email.toLowerCase().trim()
    });
    if (existingUser) {
      return res.status(409).json(fail('Admin email is already registered in the system'));
    }

    const superAdminUserId = req.user?.userId ? new mongoose.Types.ObjectId(req.user.userId) : null;

    // 1. Create Institution
    const resolvedTheme = {
      primaryColor: themeConfig?.primaryColor || branding?.primaryColor || '#4f46e5',
      secondaryColor: themeConfig?.secondaryColor || branding?.secondaryColor || '#06b6d4',
      faviconUrl: themeConfig?.faviconUrl || branding?.faviconUrl || ''
    };
    const resolvedLogo = logoUrl || branding?.logoUrl || '';
    const resolvedCustomDomain = customDomain || domain || null;

    const institution = await Institution.create({
      name: normalizedName,
      subdomain: normalizedSubdomain,
      slug: normalizedSubdomain,
      code: normalizedCode,
      customDomain: resolvedCustomDomain,
      domain: resolvedCustomDomain,
      logoUrl: resolvedLogo,
      themeConfig: resolvedTheme,
      branding: {
        ...resolvedTheme,
        logoUrl: resolvedLogo
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
 * Access: SUPERADMIN only
 */
const listInstitutions = async (req, res) => {
  try {
    const isSuperAdmin = await checkSuperAdmin(req);
    if (!isSuperAdmin) {
      return res.status(403).json(fail('Only SUPERADMIN can view all institutions'));
    }

    const institutions = await Institution.find()
      .populate('adminUserId', 'name email isActive')
      .sort({ createdAt: -1 })
      .lean();

    // Aggregate user counts per institution
    let countMap = {};
    if (mongoose.connection.db) {
      const counts = await mongoose.connection.db.collection('users').aggregate([
        { $match: { institutionId: { $ne: null } } },
        { $group: { _id: '$institutionId', count: { $sum: 1 } } }
      ]).toArray();

      counts.forEach(c => {
        countMap[c._id.toString()] = c.count;
      });
    }

    const result = institutions.map(inst => ({
      ...inst,
      userCount: countMap[inst._id.toString()] || 0
    }));

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
    }).select('name code subdomain slug domain customDomain branding themeConfig logoUrl isActive status').lean();

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

    const { name, themeConfig, branding, customDomain, domain, logoUrl, isActive, status } = req.body;
    const updateData = {};

    if (name) updateData.name = name.trim();
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

    if (themeConfig || branding) {
      const theme = themeConfig || branding;
      updateData.themeConfig = {
        primaryColor: theme.primaryColor || '#4f46e5',
        secondaryColor: theme.secondaryColor || '#06b6d4',
        faviconUrl: theme.faviconUrl || ''
      };
      updateData.branding = {
        logoUrl: updateData.logoUrl || theme.logoUrl || '',
        faviconUrl: updateData.themeConfig.faviconUrl,
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

module.exports = {
  createInstitution,
  listInstitutions,
  resolveInstitutionBySlug,
  getInstitutionById,
  updateInstitution
};
