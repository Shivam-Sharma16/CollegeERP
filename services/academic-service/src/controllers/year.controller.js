const Year = require('../models/Year.model');
const Semester = require('../models/Semester.model');
const { success, fail, logAudit } = require('@college-erp/shared-utils');
const { assertHODOwns, getHODDepartmentId } = require('../utils/assertOwnership');

const createYear = async (req, res) => {
  try {
    const departmentId = getHODDepartmentId(req);
    if (!assertHODOwns(req, res, departmentId)) return;

    const { yearNumber } = req.body;
    if (!yearNumber) return res.status(400).json(fail('yearNumber is required'));

    const existing = await Year.findOne({ departmentId, yearNumber });
    if (existing) return res.status(409).json(fail(`Year ${yearNumber} already exists in this department`));

    const year = await Year.create({ departmentId, yearNumber });
    await logAudit(req, 'YEAR_CREATED', year._id.toString(), 'Year', { departmentId, yearNumber });
    res.status(201).json(success({ year }));
  } catch (err) {
    console.error(err);
    res.status(500).json(fail('Internal server error'));
  }
};

const listYears = async (req, res) => {
  try {
    const departmentId = getHODDepartmentId(req);
    if (!departmentId) return res.status(400).json(fail('departmentId is required'));
    const years = await Year.find({ departmentId }).sort({ yearNumber: 1 });
    res.json(success({ years }));
  } catch (err) {
    res.status(500).json(fail('Internal server error'));
  }
};

const updateYear = async (req, res) => {
  try {
    const year = await Year.findById(req.params.id);
    if (!year) return res.status(404).json(fail('Year not found'));
    if (!assertHODOwns(req, res, year.departmentId)) return;

    const { yearNumber } = req.body;
    if (yearNumber) year.yearNumber = yearNumber;
    await year.save();
    res.json(success({ year }));
  } catch (err) {
    res.status(500).json(fail('Internal server error'));
  }
};

const deleteYear = async (req, res) => {
  try {
    const year = await Year.findById(req.params.id);
    if (!year) return res.status(404).json(fail('Year not found'));
    if (!assertHODOwns(req, res, year.departmentId)) return;

    const semCount = await Semester.countDocuments({ yearId: year._id });
    if (semCount > 0) {
      return res.status(409).json(fail(`Cannot delete: ${semCount} semester(s) still exist under this year`));
    }

    await year.deleteOne();
    await logAudit(req, 'YEAR_DELETED', year._id.toString(), 'Year', {});
    res.json(success({ message: 'Year deleted' }));
  } catch (err) {
    res.status(500).json(fail('Internal server error'));
  }
};

module.exports = { createYear, listYears, updateYear, deleteYear };
