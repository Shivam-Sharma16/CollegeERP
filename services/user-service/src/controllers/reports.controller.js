const mongoose = require('mongoose');
const Department = require('../models/Department.model');
const RoleAssignment = require('../models/RoleAssignment.model');
const { success, fail } = require('@college-erp/shared-utils');

const getDashboardStats = async (req, res) => {
  try {
    const totalDepartments = await Department.countDocuments();
    const totalStudents = await RoleAssignment.countDocuments({
      role: 'STUDENT',
      $or: [{ validTo: null }, { validTo: { $gt: new Date() } }]
    });
    const totalFaculty = await RoleAssignment.countDocuments({
      role: 'FACULTY',
      $or: [{ validTo: null }, { validTo: { $gt: new Date() } }]
    });

    let activeSessions = 0;
    if (mongoose.connection.db) {
      activeSessions = await mongoose.connection.db
        .collection('lecturesessions')
        .countDocuments({ status: 'active' });
    }

    res.status(200).json(success({
      totalDepartments,
      totalStudents,
      totalFaculty,
      activeSessions
    }));
  } catch (err) {
    console.error('[ReportsController] Failed to fetch dashboard stats:', err);
    res.status(500).json(fail('Internal server error'));
  }
};

const getHodDashboardStats = async (req, res) => {
  try {
    let departmentId = null;
    const hodRole = req.effectiveRoles?.find(r => r.role === 'HOD');
    if (hodRole && hodRole.departmentId) {
      departmentId = hodRole.departmentId;
    }

    const filter = departmentId ? { departmentId } : {};

    const totalStudents = await RoleAssignment.countDocuments({
      role: 'STUDENT',
      ...filter,
      $or: [{ validTo: null }, { validTo: { $gt: new Date() } }]
    });

    const totalFaculty = await RoleAssignment.countDocuments({
      role: 'FACULTY',
      ...filter,
      $or: [{ validTo: null }, { validTo: { $gt: new Date() } }]
    });

    res.status(200).json(success({
      totalStudents,
      totalFaculty
    }));
  } catch (err) {
    console.error('[ReportsController] Failed to fetch HOD stats:', err);
    res.status(500).json(fail('Internal server error'));
  }
};

module.exports = {
  getDashboardStats,
  getHodDashboardStats
};
