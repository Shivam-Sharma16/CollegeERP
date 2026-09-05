const Department = require('../models/Department.model');
const { success, fail, logAudit } = require('@college-erp/shared-utils');

const createDepartment = async (req, res) => {
  try {
    const { name, code } = req.body;

    if (!name || !code) {
      return res.status(400).json(fail('Name and code are required'));
    }

    const existing = await Department.findOne({ code });
    if (existing) {
      return res.status(409).json(fail('Department with this code already exists'));
    }

    const department = await Department.create({ name, code });

    await logAudit(
      req,
      'DEPARTMENT_CREATED',
      department._id.toString(),
      'Department',
      { name, code }
    );

    res.status(201).json(success({ department }));
  } catch (err) {
    console.error(err);
    res.status(500).json(fail('Internal server error'));
  }
};

module.exports = {
  createDepartment
};
