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

    if (!departmentId || !sectionId) {
      return res.status(400).json({ message: 'departmentId and sectionId are required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: 'Email already in use' });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
    
    // HARDCODED ROLE
    const user = await User.create({
      name,
      email,
      passwordHash,
      roles: ['STUDENT'],
      institutionId: institutionId || null
    });

    await RoleAssignment.create({
      userId: user._id,
      role: 'STUDENT',
      departmentId,
      sectionId,
      institutionId: institutionId || null,
      validFrom: new Date()
    });

    await logAudit(
      req, 
      'STUDENT_CREATED', 
      user._id.toString(), 
      'User', 
      { email: user.email, departmentId, sectionId, institutionId }
    );

    res.status(201).json({ message: 'Student registered successfully', userId: user._id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password, institutionSlug } = req.body;
    const headerSlug = req.headers['x-institution-slug'];
    const slug = institutionSlug || headerSlug;
    
    const user = await User.findOne({ email });
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    let userInstitution = null;

    if (slug) {
      // Institution-scoped login
      userInstitution = await Institution.findOne({ slug: slug.toLowerCase() });
      if (!userInstitution) {
        return res.status(404).json({ message: 'Institution not found' });
      }
      if (userInstitution.status !== 'ACTIVE') {
        return res.status(403).json({ message: 'Institution is suspended or inactive' });
      }

      // Verify tenant isolation: user must belong to this institution
      if (!user.institutionId || user.institutionId.toString() !== userInstitution._id.toString()) {
        return res.status(403).json({ message: 'Access denied: You do not belong to this institution' });
      }
    } else {
      // Platform (SuperAdmin) login - only global superadmins with null institutionId
      if (!user.roles.includes('SUPERADMIN') || user.institutionId !== null) {
        return res.status(403).json({ message: 'Please log in through your institution portal URL' });
      }
    }

    const resolvedInstitutionId = userInstitution ? userInstitution._id.toString() : (user.institutionId ? user.institutionId.toString() : null);
    const { accessToken, refreshToken } = generateTokens(user._id.toString(), resolvedInstitutionId, user.roles || []);

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
      institutionId: resolvedInstitutionId
    };

    res.status(200).json({
      success: true,
      accessToken,
      token: accessToken,
      roles: user.roles,
      userId: user._id,
      institutionId: resolvedInstitutionId,
      user: userPayload,
      data: {
        token: accessToken,
        accessToken,
        userId: user._id,
        roles: user.roles,
        institutionId: resolvedInstitutionId,
        user: userPayload
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
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
  registerStudent,
  login,
  refresh,
  logout
};
