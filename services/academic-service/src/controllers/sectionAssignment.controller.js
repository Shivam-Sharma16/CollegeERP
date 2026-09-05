const SectionAssignment = require('../models/SectionAssignment.model');
const Section = require('../models/Section.model');
const Semester = require('../models/Semester.model');
const { success, fail, logAudit } = require('@college-erp/shared-utils');
const { assertHODOwns } = require('../utils/assertOwnership');

/**
 * Invariant: exactly one active (validTo === null) SectionAssignment per section at any time.
 * Handover: caller must explicitly provide closeExistingId in the same request that opens the new one.
 */
const createSectionAssignment = async (req, res) => {
  try {
    const { sectionId, semesterId, ccUserId, validFrom, closeExistingId } = req.body;

    if (!sectionId || !semesterId || !ccUserId || !validFrom) {
      return res.status(400).json(fail('sectionId, semesterId, ccUserId, and validFrom are required'));
    }

    // Verify HOD owns the section's department
    const section = await Section.findById(sectionId);
    if (!section) return res.status(404).json(fail('Section not found'));

    const semester = await Semester.findById(semesterId);
    if (!semester) return res.status(404).json(fail('Semester not found'));
    if (!assertHODOwns(req, res, semester.departmentId)) return;

    const newValidFrom = new Date(validFrom);

    // Check for any currently-active assignment (validTo = null) for this section
    const activeAssignment = await SectionAssignment.findOne({ sectionId, validTo: null });

    if (activeAssignment) {
      if (!closeExistingId) {
        // Reject: force an explicit handover decision
        return res.status(409).json(fail(
          `Section already has an active CC assignment (ID: ${activeAssignment._id}, CC: ${activeAssignment.ccUserId}). ` +
          `To perform a handover, include closeExistingId: "${activeAssignment._id}" in the request.`
        ));
      }

      if (closeExistingId.toString() !== activeAssignment._id.toString()) {
        return res.status(409).json(fail(
          `closeExistingId does not match the current active assignment (${activeAssignment._id}).`
        ));
      }

      // Close the existing assignment: validTo = newValidFrom - 1ms
      const closeDate = new Date(newValidFrom.getTime() - 1);
      await SectionAssignment.findByIdAndUpdate(activeAssignment._id, { validTo: closeDate });

      await logAudit(req, 'SECTION_ASSIGNMENT_CLOSED', activeAssignment._id.toString(), 'SectionAssignment', {
        closedAt: closeDate, successorCCUserId: ccUserId
      });
    }

    // Create the new assignment
    const assignment = await SectionAssignment.create({
      sectionId,
      semesterId,
      ccUserId,
      validFrom: newValidFrom,
      validTo: null
    });

    // Sanity check: exactly one active assignment should now exist for this section
    const activeCount = await SectionAssignment.countDocuments({ sectionId, validTo: null });
    if (activeCount !== 1) {
      console.error(`[SectionAssignment] Integrity violation: ${activeCount} active assignments for section ${sectionId}`);
    }

    await logAudit(req, 'SECTION_ASSIGNMENT_CREATED', assignment._id.toString(), 'SectionAssignment', {
      sectionId, semesterId, ccUserId, validFrom
    });

    res.status(201).json(success({ assignment }));
  } catch (err) {
    console.error(err);
    res.status(500).json(fail('Internal server error'));
  }
};

/**
 * getSectionCC: returns the single currently-active CC for a section.
 * This is the Phase 3 getSectionCC function referenced in the spec.
 */
const getSectionCC = async (req, res) => {
  try {
    const { sectionId } = req.params;

    const active = await SectionAssignment.findOne({ sectionId, validTo: null });
    if (!active) {
      return res.status(404).json(fail('No active CC assignment for this section'));
    }

    res.json(success({ assignment: active }));
  } catch (err) {
    res.status(500).json(fail('Internal server error'));
  }
};

/**
 * Explicitly close a section assignment (e.g., CC leaves, no replacement yet).
 */
const closeSectionAssignment = async (req, res) => {
  try {
    const assignment = await SectionAssignment.findById(req.params.id);
    if (!assignment) return res.status(404).json(fail('Section assignment not found'));
    if (assignment.validTo !== null) {
      return res.status(400).json(fail('Assignment is already closed'));
    }

    // Verify HOD owns the section
    const semester = await Semester.findById(assignment.semesterId);
    if (!semester || !assertHODOwns(req, res, semester.departmentId)) return;

    const closedAt = req.body.validTo ? new Date(req.body.validTo) : new Date();
    assignment.validTo = closedAt;
    await assignment.save();

    await logAudit(req, 'SECTION_ASSIGNMENT_CLOSED', assignment._id.toString(), 'SectionAssignment', { closedAt });
    res.json(success({ assignment }));
  } catch (err) {
    res.status(500).json(fail('Internal server error'));
  }
};

module.exports = {
  createSectionAssignment,
  getSectionCC,
  closeSectionAssignment
};
