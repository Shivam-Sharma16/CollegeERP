const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User.model');
const RoleAssignment = require('../models/RoleAssignment.model');
const env = require('../config/env');

const { logAudit } = require('@college-erp/shared-utils');

const BCRYPT_COST = 12;

const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId }, 
    env.JWT_ACCESS_SECRET, 
    { expiresIn: '15m' }
  );
  
  const refreshToken = jwt.sign(
    { userId }, 
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

    // 3. Create Superadmin
    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
    
    const user = await User.create({
      name,
      email,
      passwordHash,
      roles: ['SUPERADMIN']
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
    const { name, email, password, departmentId, sectionId } = req.body;

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
      roles: ['STUDENT'] // Never trusts request body for roles
    });

    await RoleAssignment.create({
      userId: user._id,
      role: 'STUDENT',
      departmentId,
      sectionId,
      validFrom: new Date()
    });

    await logAudit(
      req, 
      'STUDENT_CREATED', 
      user._id.toString(), 
      'User', 
      { email: user.email, departmentId, sectionId }
    );

    res.status(201).json({ message: 'Student registered successfully', userId: user._id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email });
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const { accessToken, refreshToken } = generateTokens(user._id.toString());

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.status(200).json({ accessToken, roles: user.roles, userId: user._id });
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

    const tokens = generateTokens(user._id.toString());

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.status(200).json({ accessToken: tokens.accessToken });
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
