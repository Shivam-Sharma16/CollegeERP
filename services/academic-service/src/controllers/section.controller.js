const Section = require('../models/Section.model');
const Semester = require('../models/Semester.model');
const { success, fail, logAudit } = require('@college-erp/shared-utils');
const { assertHODOwns } = require('../utils/assertOwnership');

const createSection = async (req, res) => {
  try {
    const { semesterId, name } = req.body;
    if (!semesterId || !name) {
      return res.status(400).json(fail('semesterId and name are required'));
    }

    // Fetch parent Semester and traverse ownership chain
    const semester = await Semester.findById(semesterId);
    if (!semester) return res.status(404).json(fail('Semester not found'));

    // CRITICAL: Reject cross-department section creation even with a valid semesterId
    if (!assertHODOwns(req, res, semester.departmentId)) return;

    const section = await Section.create({ semesterId, name });

    await logAudit(req, 'SECTION_CREATED', section._id.toString(), 'Section', {
      departmentId: semester.departmentId, semesterId, name
    });
    res.status(201).json(success({ section }));
  } catch (err) {
    console.error(err);
    res.status(500).json(fail('Internal server error'));
  }
};

const listSections = async (req, res) => {
  try {
    const { semesterId } = req.query;
    const filter = semesterId ? { semesterId } : {};
    const sections = await Section.find(filter).sort({ name: 1 });
    res.json(success({ sections }));
  } catch (err) {
    res.status(500).json(fail('Internal server error'));
  }
};

const updateSection = async (req, res) => {
  try {
    const section = await Section.findById(req.params.id).populate('semesterId');
    if (!section) return res.status(404).json(fail('Section not found'));
    if (!assertHODOwns(req, res, section.semesterId?.departmentId)) return;

    const { name } = req.body;
    if (name) section.name = name;
    await section.save();
    res.json(success({ section }));
  } catch (err) {
    res.status(500).json(fail('Internal server error'));
  }
};

const deleteSection = async (req, res) => {
  try {
    const section = await Section.findById(req.params.id);
    if (!section) return res.status(404).json(fail('Section not found'));

    // Must look up the semester to assert ownership
    const semester = await Semester.findById(section.semesterId);
    if (!semester) return res.status(404).json(fail('Parent semester not found'));
    if (!assertHODOwns(req, res, semester.departmentId)) return;

    await section.deleteOne();
    await logAudit(req, 'SECTION_DELETED', section._id.toString(), 'Section', {});
    res.json(success({ message: 'Section deleted' }));
  } catch (err) {
    res.status(500).json(fail('Internal server error'));
  }
};

module.exports = { createSection, listSections, updateSection, deleteSection };
