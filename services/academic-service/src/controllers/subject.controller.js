const Subject = require('../models/Subject.model');
const { success, fail, logAudit } = require('@college-erp/shared-utils');
const { assertHODOwns, getHODDepartmentId } = require('../utils/assertOwnership');

const createSubject = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;

    // departmentId is always taken from the HOD's own scope — never from body
    const departmentId = getHODDepartmentId(req);
    if (!assertHODOwns(req, res, departmentId)) return;

    const { name, code, credits, type } = req.body;
    if (!name || !code || !credits) {
      return res.status(400).json(fail('name, code, and credits are required'));
    }

    const subjectType = type || 'lecture';
    if (!['lecture', 'lab'].includes(subjectType)) {
      return res.status(400).json(fail("type must be either 'lecture' or 'lab'"));
    }

    const query = { code };
    if (tenantId) query.institutionId = tenantId;

    const existing = await Subject.findOne(query);
    if (existing) return res.status(409).json(fail(`Subject with code '${code}' already exists`));

    const subject = await Subject.create({
      departmentId,
      name,
      code,
      credits,
      type: subjectType,
      ...(tenantId ? { institutionId: tenantId } : {})
    });

    await logAudit(req, 'SUBJECT_CREATED', subject._id.toString(), 'Subject', { departmentId, name, code, type: subjectType, institutionId: tenantId });
    res.status(201).json(success({ subject }));
  } catch (err) {
    console.error(err);
    res.status(500).json(fail('Internal server error'));
  }
};

const listSubjects = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const departmentId = getHODDepartmentId(req) || req.query.departmentId;
    const filter = {};
    if (departmentId) filter.departmentId = departmentId;
    if (req.query.type) {
      filter.type = req.query.type;
    }
    if (tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      filter.institutionId = tenantId;
    }

    const subjects = await Subject.find(filter).sort({ name: 1 });
    res.json(success({ subjects }));
  } catch (err) {
    res.status(500).json(fail('Internal server error'));
  }
};

const getSubjectById = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const filter = { _id: req.params.id };
    if (tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      filter.institutionId = tenantId;
    }

    const subject = await Subject.findOne(filter);
    if (!subject) return res.status(404).json(fail('Subject not found'));
    if (!assertHODOwns(req, res, subject.departmentId)) return;

    res.json(success({ subject }));
  } catch (err) {
    res.status(500).json(fail('Internal server error'));
  }
};

const updateSubject = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const filter = { _id: req.params.id };
    if (tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      filter.institutionId = tenantId;
    }

    const subject = await Subject.findOne(filter);
    if (!subject) return res.status(404).json(fail('Subject not found'));
    if (!assertHODOwns(req, res, subject.departmentId)) return;

    const { name, credits, type } = req.body;
    if (name) subject.name = name;
    if (credits) subject.credits = credits;
    if (type) {
      if (!['lecture', 'lab'].includes(type)) {
        return res.status(400).json(fail("type must be either 'lecture' or 'lab'"));
      }
      subject.type = type;
    }
    await subject.save();
    res.json(success({ subject }));
  } catch (err) {
    res.status(500).json(fail('Internal server error'));
  }
};

const deleteSubject = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const filter = { _id: req.params.id };
    if (tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      filter.institutionId = tenantId;
    }

    const subject = await Subject.findOne(filter);
    if (!subject) return res.status(404).json(fail('Subject not found'));
    if (!assertHODOwns(req, res, subject.departmentId)) return;

    await subject.deleteOne();
    await logAudit(req, 'SUBJECT_DELETED', subject._id.toString(), 'Subject', { institutionId: tenantId });
    res.json(success({ message: 'Subject deleted' }));
  } catch (err) {
    res.status(500).json(fail('Internal server error'));
  }
};

module.exports = { createSubject, listSubjects, getSubjectById, updateSubject, deleteSubject };
