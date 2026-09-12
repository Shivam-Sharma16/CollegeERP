const Section = require('../models/Section.model');
const Semester = require('../models/Semester.model');
const { success, fail, logAudit } = require('@college-erp/shared-utils');
const { assertHODOwns } = require('../utils/assertOwnership');

const createSection = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const { semesterId, name } = req.body;
    if (!semesterId || !name) {
      return res.status(400).json(fail('semesterId and name are required'));
    }

    // Fetch parent Semester and traverse ownership chain
    const semFilter = { _id: semesterId };
    if (tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      semFilter.institutionId = tenantId;
    }
    const semester = await Semester.findOne(semFilter);
    if (!semester) return res.status(404).json(fail('Semester not found'));

    // CRITICAL: Reject cross-department section creation even with a valid semesterId
    if (!assertHODOwns(req, res, semester.departmentId)) return;

    const section = await Section.create({
      semesterId,
      name,
      ...(tenantId ? { institutionId: tenantId } : {})
    });

    await logAudit(req, 'SECTION_CREATED', section._id.toString(), 'Section', {
      departmentId: semester.departmentId, semesterId, name, institutionId: tenantId
    });
    res.status(201).json(success({ section }));
  } catch (err) {
    console.error(err);
    res.status(500).json(fail('Internal server error'));
  }
};

const listSections = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const { semesterId } = req.query;
    const filter = semesterId ? { semesterId } : {};
    if (tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      filter.institutionId = tenantId;
    }

    const sections = await Section.find(filter).sort({ name: 1 });
    res.json(success({ sections }));
  } catch (err) {
    res.status(500).json(fail('Internal server error'));
  }
};

const getSectionById = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const filter = { _id: req.params.id };
    if (tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      filter.institutionId = tenantId;
    }

    const section = await Section.findOne(filter).populate('semesterId');
    if (!section) return res.status(404).json(fail('Section not found'));
    if (!assertHODOwns(req, res, section.semesterId?.departmentId)) return;

    res.json(success({ section }));
  } catch (err) {
    res.status(500).json(fail('Internal server error'));
  }
};

const updateSection = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const filter = { _id: req.params.id };
    if (tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      filter.institutionId = tenantId;
    }

    const section = await Section.findOne(filter).populate('semesterId');
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
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const filter = { _id: req.params.id };
    if (tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      filter.institutionId = tenantId;
    }

    const section = await Section.findOne(filter);
    if (!section) return res.status(404).json(fail('Section not found'));

    // Must look up the semester to assert ownership
    const semFilter = { _id: section.semesterId };
    if (tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      semFilter.institutionId = tenantId;
    }
    const semester = await Semester.findOne(semFilter);
    if (!semester) return res.status(404).json(fail('Parent semester not found'));
    if (!assertHODOwns(req, res, semester.departmentId)) return;

    await section.deleteOne();
    await logAudit(req, 'SECTION_DELETED', section._id.toString(), 'Section', { institutionId: tenantId });
    res.json(success({ message: 'Section deleted' }));
  } catch (err) {
    res.status(500).json(fail('Internal server error'));
  }
};

module.exports = { createSection, listSections, getSectionById, updateSection, deleteSection };
