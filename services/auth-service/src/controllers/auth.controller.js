const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User.model');
const Institution = require('../models/Institution.model');
const RoleAssignment = require('../models/RoleAssignment.model');
const env = require('../config/env');

const { logAudit } = require('@college-erp/shared-utils');

const BCRYPT_COST = 12;

const generateTokens = (userId, institutionId = null, roles = []) => {
  const accessToken = jwt.sign(
    { userId, institutionId, roles }, 
    env.JWT_ACCESS_SECRET, 
    { expiresIn: '15m' }
  );
  
  const refreshToken = jwt.sign(
    { userId, institutionId, roles }, 
    env.JWT_REFRESH_SECRET, 
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
};

const superadminSignup = async (req, res) => {
  try {
    const { name, email, password, setupKey } = req.body;

    // 1. Verify Setup Key
    if (setupKey !== env.SUPERADMIN_SETUP_KEY) {
      return res.status(403).json({ message: 'Invalid setup key' });
    }

    // 2. Lockout Check: ensure no SUPERADMIN exists
    const existingSuperadmin = await User.findOne({ roles: 'SUPERADMIN' });
    if (existingSuperadmin) {
      return res.status(403).json({ message: 'Superadmin already exists. Setup disabled.' });
    }

    // 3. Create Superadmin (Platform owner, institutionId: null)
    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
    
    const user = await User.create({
      name,
      email,
      passwordHash,
      roles: ['SUPERADMIN'],
      institutionId: null
    });

    await logAudit(
      req, 
      'SUPERADMIN_CREATED', 
      user._id.toString(), 
      'User', 
      { email: user.email }
    );

    res.status(201).json({ message: 'Superadmin created successfully', userId: user._id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const registerStudent = async (req, res) => {
  try {
    const { name, email, password, departmentId, sectionId, institutionId } = req.body;
    const resolvedTenantId = req.tenantId || req.headers['x-tenant-id'] || institutionId || null;

    if (!departmentId || !sectionId) {
      return res.status(400).json({ message: 'departmentId and sectionId are required' });
    }

    const normalizedEmail = (email || '').toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail, institutionId: resolvedTenantId });
    if (existingUser) {
      return res.status(409).json({ message: 'Email already in use' });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
    
    // HARDCODED ROLE
    const user = await User.create({
      name,
      email: normalizedEmail,
      passwordHash,
      roles: ['STUDENT'],
      institutionId: resolvedTenantId
    });

    await RoleAssignment.create({
      userId: user._id,
      role: 'STUDENT',
      departmentId,
      sectionId,
      institutionId: resolvedTenantId,
      validFrom: new Date()
    });

    await logAudit(
      req, 
      'STUDENT_CREATED', 
      user._id.toString(), 
      'User', 
      { email: user.email, departmentId, sectionId, institutionId: resolvedTenantId }
    );

    res.status(201).json({ message: 'Student registered successfully', userId: user._id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Standard Tenant Login
 * Access: Scoped strictly to tenant subdomain (req.tenantId required)
 * Query: User.findOne({ email, institutionId: req.tenantId })
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    let tenantId = req.tenantId || req.headers['x-tenant-id'] || null;

    if (!tenantId && (req.body?.institutionSlug || req.body?.subdomain)) {
      const targetSlug = (req.body.institutionSlug || req.body.subdomain).toLowerCase().trim();
      const targetInst = await Institution.findOne({
        $or: [{ subdomain: targetSlug }, { slug: targetSlug }]
      });
      if (targetInst) {
        tenantId = targetInst._id;
      }
    }

    if (!tenantId) {
      // Check if this is a platform SuperAdmin logging in on root domain
      const normalizedEmail = (email || '').toLowerCase().trim();
      const superAdmin = await User.findOne({
        email: normalizedEmail,
        institutionId: null,
        roles: { $in: ['SUPERADMIN', 'superadmin'] },
      });

      if (superAdmin && superAdmin.isActive) {
        const isValid = await bcrypt.compare(password, superAdmin.passwordHash);
        if (isValid) {
          const { accessToken, refreshToken } = generateTokens(
            superAdmin._id.toString(),
            null,
            superAdmin.roles || ['SUPERADMIN']
          );

          res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 7 * 24 * 60 * 60 * 1000,
          });

          const userPayload = {
            id: superAdmin._id.toString(),
            name: superAdmin.name,
            email: superAdmin.email,
            roles: superAdmin.roles,
            institutionId: null,
          };

          return res.status(200).json({
            success: true,
            accessToken,
            token: accessToken,
            roles: superAdmin.roles,
            userId: superAdmin._id,
            institutionId: null,
            user: userPayload,
            data: {
              token: accessToken,
              accessToken,
              userId: superAdmin._id,
              roles: superAdmin.roles,
              institutionId: null,
              user: userPayload,
            },
          });
        }
      }

      return res.status(400).json({
        success: false,
        message:
          'Tenant context is required for login. Please access your institution portal via its subdomain.',
      });
    }

    const normalizedEmail = (email || '').toLowerCase().trim();
    
    // Phase 66 core mechanism: Scoped strictly to tenantId
    const user = await User.findOne({
      email: normalizedEmail,
      institutionId: tenantId
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const resolvedInstId = user.institutionId ? user.institutionId.toString() : tenantId.toString();
    const { accessToken, refreshToken } = generateTokens(
      user._id.toString(),
      resolvedInstId,
      user.roles || []
    );

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    const userPayload = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      roles: user.roles,
      institutionId: resolvedInstId
    };

    res.status(200).json({
      success: true,
      accessToken,
      token: accessToken,
      roles: user.roles,
      userId: user._id,
      institutionId: resolvedInstId,
      user: userPayload,
      data: {
        token: accessToken,
        accessToken,
        userId: user._id,
        roles: user.roles,
        institutionId: resolvedInstId,
        user: userPayload
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * SuperAdmin Login
 * Access: Root domain only (institutionId: null, roles: SUPERADMIN)
 * Rejects requests with tenantId attached
 */
const superadminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || null;

    if (tenantId) {
      return res.status(403).json({
        success: false,
        message: 'SuperAdmin login is only allowed on the root domain, not on tenant subdomains'
      });
    }

    const normalizedEmail = (email || '').toLowerCase().trim();

    // Query matches strictly platform SuperAdmin with institutionId: null
    const user = await User.findOne({
      email: normalizedEmail,
      institutionId: null,
      roles: { $in: ['SUPERADMIN', 'superadmin'] }
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const { accessToken, refreshToken } = generateTokens(
      user._id.toString(),
      null,
      user.roles || ['SUPERADMIN']
    );

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    const userPayload = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      roles: user.roles,
      institutionId: null
    };

    res.status(200).json({
      success: true,
      accessToken,
      token: accessToken,
      roles: user.roles,
      userId: user._id,
      institutionId: null,
      user: userPayload,
      data: {
        token: accessToken,
        accessToken,
        userId: user._id,
        roles: user.roles,
        institutionId: null,
        user: userPayload
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const refresh = async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ message: 'No refresh token provided' });
    }

    const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.userId);
    
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'User not found or inactive' });
    }

    const institutionId = user.institutionId ? user.institutionId.toString() : null;
    const tokens = generateTokens(user._id.toString(), institutionId, user.roles || []);

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    const userPayload = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      roles: user.roles,
      institutionId
    };

    res.status(200).json({
      success: true,
      accessToken: tokens.accessToken,
      token: tokens.accessToken,
      roles: user.roles,
      userId: user._id,
      institutionId,
      user: userPayload,
      data: {
        token: tokens.accessToken,
        accessToken: tokens.accessToken,
        userId: user._id,
        roles: user.roles,
        institutionId,
        user: userPayload
      }
    });
  } catch (error) {
    res.status(401).json({ message: 'Invalid refresh token' });
  }
};

const logout = (req, res) => {
  res.clearCookie('refreshToken');
  res.status(200).json({ message: 'Logged out successfully' });
};

module.exports = {
  superadminSignup,
  superadminLogin,
  registerStudent,
  login,
  refresh,
  logout
};
