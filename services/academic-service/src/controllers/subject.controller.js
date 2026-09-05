const Subject = require('../models/Subject.model');
const { success, fail, logAudit } = require('@college-erp/shared-utils');
const { assertHODOwns, getHODDepartmentId } = require('../utils/assertOwnership');

const createSubject = async (req, res) => {
  try {
    // departmentId is always taken from the HOD's own scope — never from body
    const departmentId = getHODDepartmentId(req);
    if (!assertHODOwns(req, res, departmentId)) return;

    const { name, code, credits } = req.body;
    if (!name || !code || !credits) {
      return res.status(400).json(fail('name, code, and credits are required'));
    }

    const existing = await Subject.findOne({ code });
    if (existing) return res.status(409).json(fail(`Subject with code '${code}' already exists`));

    const subject = await Subject.create({ departmentId, name, code, credits });
    await logAudit(req, 'SUBJECT_CREATED', subject._id.toString(), 'Subject', { departmentId, name, code });
    res.status(201).json(success({ subject }));
  } catch (err) {
    console.error(err);
    res.status(500).json(fail('Internal server error'));
  }
};

const listSubjects = async (req, res) => {
  try {
    const departmentId = getHODDepartmentId(req) || req.query.departmentId;
    const filter = departmentId ? { departmentId } : {};
    const subjects = await Subject.find(filter).sort({ name: 1 });
    res.json(success({ subjects }));
  } catch (err) {
    res.status(500).json(fail('Internal server error'));
  }
};

const updateSubject = async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id);
    if (!subject) return res.status(404).json(fail('Subject not found'));
    if (!assertHODOwns(req, res, subject.departmentId)) return;

    const { name, credits } = req.body;
    if (name) subject.name = name;
    if (credits) subject.credits = credits;
    await subject.save();
    res.json(success({ subject }));
  } catch (err) {
    res.status(500).json(fail('Internal server error'));
  }
};

const deleteSubject = async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id);
    if (!subject) return res.status(404).json(fail('Subject not found'));
    if (!assertHODOwns(req, res, subject.departmentId)) return;

    await subject.deleteOne();
    await logAudit(req, 'SUBJECT_DELETED', subject._id.toString(), 'Subject', {});
    res.json(success({ message: 'Subject deleted' }));
  } catch (err) {
    res.status(500).json(fail('Internal server error'));
  }
};

module.exports = { createSubject, listSubjects, updateSubject, deleteSubject };
