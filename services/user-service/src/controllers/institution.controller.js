const bcrypt = require('bcrypt');
const Institution = require('../models/Institution.model');
const User = require('../models/User.model');
const RoleAssignment = require('../models/RoleAssignment.model');
const { success, fail, logAudit } = require('@college-erp/shared-utils');

const BCRYPT_COST = 12;

const checkSuperAdmin = async (req) => {
  if (req.user?.roles && req.user.roles.includes('SUPERADMIN')) return true;
  const user = await User.findById(req.user?.userId || req.user?.id);
  if (user && user.roles && user.roles.includes('SUPERADMIN')) {
    req.user.roles = user.roles;
    return true;
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

    const { name, code, slug, domain, branding, admin } = req.body;

    if (!name || !code || !slug) {
      return res.status(400).json(fail('Institution name, code, and slug are required'));
    }

    if (!admin || !admin.name || !admin.email || !admin.password) {
      return res.status(400).json(fail('Admin name, email, and password are required'));
    }

    const normalizedCode = code.trim().toUpperCase();
    const normalizedSlug = slug.trim().toLowerCase();

    // Check slug pattern: alphanumeric and hyphens only
    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(normalizedSlug)) {
      return res.status(400).json(fail('Slug must contain only lowercase letters, numbers, and hyphens'));
    }

    // Check existing institution
    const existingInst = await Institution.findOne({
      $or: [{ code: normalizedCode }, { slug: normalizedSlug }]
    });

    if (existingInst) {
      if (existingInst.code === normalizedCode) {
        return res.status(409).json(fail('An institution with this code already exists'));
      }
      return res.status(409).json(fail('An institution with this URL slug already exists'));
    }

    // Check if admin email already taken
    const existingUser = await User.findOne({ email: admin.email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(409).json(fail('Admin email is already registered in the system'));
    }

    // 1. Create Institution
    const institution = await Institution.create({
      name: name.trim(),
      code: normalizedCode,
      slug: normalizedSlug,
      domain: domain ? domain.trim() : null,
      branding: {
        logoUrl: branding?.logoUrl || '',
        faviconUrl: branding?.faviconUrl || '',
        primaryColor: branding?.primaryColor || '#4f46e5',
        secondaryColor: branding?.secondaryColor || '#06b6d4'
      }
    });

    // 2. Create Initial Admin User bound to this institution
    const passwordHash = await bcrypt.hash(admin.password, BCRYPT_COST);
    const adminUser = await User.create({
      name: admin.name.trim(),
      email: admin.email.toLowerCase().trim(),
      passwordHash,
      roles: ['ADMIN'],
      institutionId: institution._id,
      isActive: true
    });

    // 3. Assign ADMIN RoleAssignment
    await RoleAssignment.create({
      userId: adminUser._id,
      role: 'ADMIN',
      institutionId: institution._id,
      departmentId: null,
      sectionId: null,
      validFrom: new Date()
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
      { name: institution.name, code: institution.code, slug: institution.slug, adminEmail: adminUser.email }
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
    const counts = await User.aggregate([
      { $match: { institutionId: { $ne: null } } },
      { $group: { _id: '$institutionId', count: { $sum: 1 } } }
    ]);

    const countMap = {};
    counts.forEach(c => {
      countMap[c._id.toString()] = c.count;
    });

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
 * Resolve institution branding & details by slug
 * Access: Public (Used by frontend to style tenant portal and validate slug)
 */
const resolveInstitutionBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    if (!slug) {
      return res.status(400).json(fail('Slug is required'));
    }

    const institution = await Institution.findOne({ slug: slug.toLowerCase().trim() })
      .select('name code slug domain branding status')
      .lean();

    if (!institution) {
      return res.status(404).json(fail('Institution not found'));
    }

    if (institution.status !== 'ACTIVE') {
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
    const isSuperAdmin = req.user.roles.includes('SUPERADMIN');
    const isOwnTenant = req.user.institutionId && req.user.institutionId.toString() === id;

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
 * Update institution details/branding
 */
const updateInstitution = async (req, res) => {
  try {
    const { id } = req.params;
    const isSuperAdmin = req.user.roles.includes('SUPERADMIN');
    const isTenantAdmin = req.user.roles.includes('ADMIN') && req.user.institutionId && req.user.institutionId.toString() === id;

    if (!isSuperAdmin && !isTenantAdmin) {
      return res.status(403).json(fail('Access denied'));
    }

    const { name, branding, domain, status } = req.body;
    const updateData = {};

    if (name) updateData.name = name.trim();
    if (domain !== undefined) updateData.domain = domain ? domain.trim() : null;
    if (branding) {
      updateData.branding = {
        logoUrl: branding.logoUrl || '',
        faviconUrl: branding.faviconUrl || '',
        primaryColor: branding.primaryColor || '#4f46e5',
        secondaryColor: branding.secondaryColor || '#06b6d4'
      };
    }

    // Only SUPERADMIN can change status (e.g. SUSPENDED)
    if (isSuperAdmin && status) {
      updateData.status = status;
    }

    const updated = await Institution.findByIdAndUpdate(id, updateData, { new: true })
      .populate('adminUserId', 'name email isActive');

    if (!updated) {
      return res.status(404).json(fail('Institution not found'));
    }

    await logAudit(
      req,
      'INSTITUTION_UPDATED',
      updated._id.toString(),
      'Institution',
      updateData
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
