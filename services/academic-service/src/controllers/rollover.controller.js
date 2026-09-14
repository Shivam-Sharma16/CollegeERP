const mongoose = require('mongoose');
const Semester = require('../models/Semester.model');
const Section = require('../models/Section.model');
const { success, fail, logAudit } = require('@college-erp/shared-utils');

/**
 * POST /academic/rollover
 * Admin, department + year scoped:
 * Creates next Semester, advances sections with carriesForwardFrom,
 * and updates enrolled students' active-semester reference.
 * Explicitly does NOT touch historical AttendanceRecord/MarksRecord.
 */
exports.rolloverSemester = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId || req.body.institutionId;
    const callerRoles = req.user?.roles || [];
    const isSuperAdmin = callerRoles.includes('SUPERADMIN');
    const isAdmin = callerRoles.includes('ADMIN');

    if (!isSuperAdmin && !isAdmin) {
      return res.status(403).json(fail('Access Denied: Only Admin can perform academic rollover'));
    }

    const { departmentId, yearId, currentSemesterNumber, currentSemesterId } = req.body;

    if (!departmentId || !yearId) {
      return res.status(400).json(fail('departmentId and yearId are required'));
    }

    // 1. Resolve Current Semester
    const semFilter = { yearId };
    if (tenantId && !isSuperAdmin) {
      semFilter.institutionId = tenantId;
    }

    let currentSemester = null;
    if (currentSemesterId) {
      currentSemester = await Semester.findOne({ _id: currentSemesterId, ...semFilter });
    } else if (currentSemesterNumber) {
      semFilter.semesterNumber = Number(currentSemesterNumber);
      currentSemester = await Semester.findOne(semFilter);
    } else {
      // Pick latest existing semester in this year
      currentSemester = await Semester.findOne(semFilter).sort({ semesterNumber: -1 });
    }

    if (!currentSemester) {
      return res.status(404).json(fail('Current semester not found for the given year/department'));
    }

    const nextSemesterNumber = currentSemester.semesterNumber + 1;
    if (nextSemesterNumber > 8) {
      return res.status(400).json(fail('Cannot rollover beyond semester 8'));
    }

    // 2. Create Next Semester
    let nextSemester = await Semester.findOne({
      yearId,
      semesterNumber: nextSemesterNumber,
      ...(tenantId && !isSuperAdmin ? { institutionId: tenantId } : {})
    });

    if (!nextSemester) {
      nextSemester = await Semester.create({
        departmentId: currentSemester.departmentId || departmentId,
        yearId,
        semesterNumber: nextSemesterNumber,
        ...(tenantId ? { institutionId: tenantId } : {})
      });
    }

    // 3. Duplicate Sections into next semester with carriesForwardFrom
    const currentSections = await Section.find({ semesterId: currentSemester._id });
    const sectionMap = {}; // oldSectionId -> newSectionId
    const rolledOverSections = [];

    for (const currSec of currentSections) {
      let nextSec = await Section.findOne({
        semesterId: nextSemester._id,
        name: currSec.name,
        ...(tenantId && !isSuperAdmin ? { institutionId: tenantId } : {})
      });

      if (!nextSec) {
        nextSec = await Section.create({
          semesterId: nextSemester._id,
          name: currSec.name,
          carriesForwardFrom: currSec._id,
          ...(tenantId ? { institutionId: tenantId } : {})
        });
      }

      sectionMap[currSec._id.toString()] = nextSec._id.toString();
      rolledOverSections.push({
        fromSectionId: currSec._id,
        toSectionId: nextSec._id,
        name: currSec.name
      });
    }

    // 4. Update enrolled students' active-semester and active-section reference
    let enrolledUpdatedCount = 0;

    // Strategy A: If shared database / memory server (e.g. testing or monolithic DB)
    if (mongoose.connection.db && Object.keys(sectionMap).length > 0) {
      try {
        const roleAssignmentsCol = mongoose.connection.db.collection('roleassignments');
        const usersCol = mongoose.connection.db.collection('users');

        for (const [oldSecId, newSecId] of Object.entries(sectionMap)) {
          const oldOid = new mongoose.Types.ObjectId(oldSecId);
          const newOid = new mongoose.Types.ObjectId(newSecId);
          const nextSemOid = new mongoose.Types.ObjectId(nextSemester._id);

          const result = await roleAssignmentsCol.updateMany(
            {
              sectionId: oldOid,
              role: 'STUDENT',
              $or: [{ validTo: null }, { validTo: { $gt: new Date() } }]
            },
            {
              $set: {
                sectionId: newOid,
                semesterId: nextSemOid,
                updatedAt: new Date()
              }
            }
          );
          enrolledUpdatedCount += (result.modifiedCount || 0);

          // Update activeSemesterId on users if matched
          const studentAssignments = await roleAssignmentsCol.find({ sectionId: newOid }).toArray();
          const userIds = studentAssignments.map(a => a.userId);
          if (userIds.length > 0) {
            await usersCol.updateMany(
              { _id: { $in: userIds } },
              { $set: { activeSemesterId: nextSemOid } }
            );
          }
        }
      } catch (dbErr) {
        console.warn('[Rollover] Direct DB student update note:', dbErr.message);
      }
    }

    // Strategy B: Call user-service via internal HTTP if configured
    const userServiceUrl = process.env.USER_SERVICE_URL;
    if (userServiceUrl && Object.keys(sectionMap).length > 0) {
      try {
        const internalKey = process.env.INTERNAL_SERVICE_KEY;
        await fetch(`${userServiceUrl}/users/rollover-enrolled`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(req.headers['authorization'] ? { Authorization: req.headers['authorization'] } : {}),
            ...(internalKey ? { 'x-internal-key': internalKey } : {}),
            ...(tenantId ? { 'x-tenant-id': tenantId.toString() } : {})
          },
          body: JSON.stringify({
            sectionMap,
            nextSemesterId: nextSemester._id,
            institutionId: tenantId
          })
        }).catch(() => null);
      } catch (httpErr) {
        console.warn('[Rollover] HTTP call to user-service rollover note:', httpErr.message);
      }
    }

    // Historical AttendanceRecord and MarksRecord are explicitly NOT modified.
    // They remain securely tied to the historical lecture sessions & exam types of previous semesters.

    await logAudit(req, 'SEMESTER_ROLLOVER_COMPLETED', nextSemester._id.toString(), 'Semester', {
      previousSemesterId: currentSemester._id,
      previousSemesterNumber: currentSemester.semesterNumber,
      nextSemesterId: nextSemester._id,
      nextSemesterNumber: nextSemester.semesterNumber,
      departmentId,
      yearId,
      institutionId: tenantId
    });

    res.status(200).json(success({
      previousSemester: {
        id: currentSemester._id,
        semesterNumber: currentSemester.semesterNumber
      },
      nextSemester: {
        id: nextSemester._id,
        semesterNumber: nextSemester.semesterNumber,
        departmentId: nextSemester.departmentId,
        yearId: nextSemester.yearId
      },
      sectionsRolledOver: rolledOverSections.length,
      sections: rolledOverSections,
      sectionMap,
      studentsUpdated: enrolledUpdatedCount
    }));
  } catch (err) {
    console.error('[RolloverController] Semester rollover failed:', err);
    res.status(500).json(fail('Semester rollover failed: ' + err.message));
  }
};
