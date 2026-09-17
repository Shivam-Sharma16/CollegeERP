const mongoose = require('mongoose');
const AttendanceRecord = require('../models/AttendanceRecord.model');
const LectureSession = require('../models/LectureSession.model');
const { success, fail, logAudit } = require('@college-erp/shared-utils');

const VALID_STATUSES = ['present', 'absent', 'flagged'];

/**
 * Helper to resolve HOD department ID from effectiveRoles, req.user, or roleassignments.
 */
const getHODDeptId = async (req, tenantId = null) => {
  const hodRole = req.effectiveRoles?.find(r => r.role === 'HOD');
  if (hodRole && hodRole.departmentId) {
    return hodRole.departmentId.toString();
  }

  if (req.user?.departmentId) {
    return req.user.departmentId.toString();
  }

  if (mongoose.connection && mongoose.connection.db && req.user?.userId) {
    const raQuery = {
      userId: new mongoose.Types.ObjectId(req.user.userId),
      role: 'HOD',
      $or: [{ validTo: null }, { validTo: { $gt: new Date() } }]
    };
    if (tenantId && mongoose.Types.ObjectId.isValid(tenantId)) {
      raQuery.institutionId = new mongoose.Types.ObjectId(tenantId);
    }
    const assignment = await mongoose.connection.db.collection('roleassignments').findOne(raQuery);
    if (assignment && assignment.departmentId) {
      return assignment.departmentId.toString();
    }
  }

  return null;
};

/**
 * GET /disputes/escalated
 * HOD-only route returning every escalated dispute across all sections in the HOD's department.
 */
const listEscalatedDisputes = async (req, res) => {
  try {
    const callerRoles = req.user?.roles || [];
    const isSuperAdmin = callerRoles.includes('SUPERADMIN');
    const isAdmin = callerRoles.includes('ADMIN');
    const isHOD = callerRoles.includes('HOD') || req.effectiveRoles?.some(r => r.role === 'HOD');

    if (!isSuperAdmin && !isAdmin && !isHOD) {
      return res.status(403).json(fail('Access Denied: Only HOD can view escalated disputes'));
    }

    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    let deptId = null;

    if (isSuperAdmin || isAdmin) {
      deptId = req.query.departmentId || null;
    } else {
      deptId = await getHODDeptId(req, tenantId);
      if (!deptId) {
        return res.status(403).json(fail('You are not assigned to a department as HOD'));
      }
    }

    let sessionIds = [];
    let sectionMap = new Map();
    let subjectMap = new Map();
    let assignmentMap = new Map();

    if (deptId && mongoose.Types.ObjectId.isValid(deptId)) {
      const deptOid = new mongoose.Types.ObjectId(deptId);

      // 1. Semesters in this department
      const semQuery = { departmentId: deptOid };
      if (tenantId && !isSuperAdmin && mongoose.Types.ObjectId.isValid(tenantId)) {
        semQuery.institutionId = new mongoose.Types.ObjectId(tenantId);
      }
      const semesters = await mongoose.connection.db.collection('semesters').find(semQuery).toArray();
      const semesterIds = semesters.map(s => s._id);

      // 2. Sections in those semesters
      const secQuery = { semesterId: { $in: semesterIds } };
      if (tenantId && !isSuperAdmin && mongoose.Types.ObjectId.isValid(tenantId)) {
        secQuery.institutionId = new mongoose.Types.ObjectId(tenantId);
      }
      const sections = await mongoose.connection.db.collection('sections').find(secQuery).toArray();
      const sectionIds = sections.map(s => s._id);
      sections.forEach(s => sectionMap.set(s._id.toString(), s.name));

      // 3. Subjects in this department
      const subQuery = { departmentId: deptOid };
      if (tenantId && !isSuperAdmin && mongoose.Types.ObjectId.isValid(tenantId)) {
        subQuery.institutionId = new mongoose.Types.ObjectId(tenantId);
      }
      const subjects = await mongoose.connection.db.collection('subjects').find(subQuery).toArray();
      const subjectIds = subjects.map(s => s._id);
      subjects.forEach(s => subjectMap.set(s._id.toString(), s));

      // 4. Teaching assignments for these sections or subjects
      const taQuery = {
        $or: [
          { sectionId: { $in: sectionIds } },
          { subjectId: { $in: subjectIds } }
        ]
      };
      if (tenantId && !isSuperAdmin && mongoose.Types.ObjectId.isValid(tenantId)) {
        taQuery.institutionId = new mongoose.Types.ObjectId(tenantId);
      }
      const assignments = await mongoose.connection.db.collection('teachingassignments').find(taQuery).toArray();
      const assignmentIds = assignments.map(a => a._id);
      assignments.forEach(a => assignmentMap.set(a._id.toString(), a));

      // 5. Lecture sessions referencing these teaching assignments
      const sessQuery = { teachingAssignmentId: { $in: assignmentIds } };
      if (tenantId && !isSuperAdmin && mongoose.Types.ObjectId.isValid(tenantId)) {
        sessQuery.institutionId = new mongoose.Types.ObjectId(tenantId);
      }
      const sessions = await LectureSession.find(sessQuery);
      sessionIds = sessions.map(s => s._id);
    } else if (isSuperAdmin || isAdmin) {
      // If superadmin without deptId, search across all sessions for tenant
      const sessQuery = {};
      if (tenantId && !isSuperAdmin && mongoose.Types.ObjectId.isValid(tenantId)) {
        sessQuery.institutionId = new mongoose.Types.ObjectId(tenantId);
      }
      const sessions = await LectureSession.find(sessQuery);
      sessionIds = sessions.map(s => s._id);
    }

    // 6. Query AttendanceRecords with escalation
    const disputeQuery = {
      lectureSessionId: { $in: sessionIds },
      'escalation.status': { $in: ['pending', 'resolved'] }
    };

    if (req.query.status && ['pending', 'resolved'].includes(req.query.status)) {
      disputeQuery['escalation.status'] = req.query.status;
    }

    if (tenantId && !isSuperAdmin && mongoose.Types.ObjectId.isValid(tenantId)) {
      disputeQuery.institutionId = new mongoose.Types.ObjectId(tenantId);
    }

    const records = await AttendanceRecord.find(disputeQuery)
      .populate('lectureSessionId')
      .sort({ 'escalation.escalatedAt': -1 });

    // Enrich disputes with section, subject, and session metadata
    const enrichedDisputes = records.map(rec => {
      const recObj = rec.toObject();
      const session = recObj.lectureSessionId;
      let assignment = null;
      let sectionName = null;
      let subjectName = null;
      let subjectCode = null;

      if (session && session.teachingAssignmentId) {
        assignment = assignmentMap.get(session.teachingAssignmentId.toString());
        if (assignment) {
          sectionName = sectionMap.get(assignment.sectionId?.toString()) || null;
          const sub = subjectMap.get(assignment.subjectId?.toString());
          if (sub) {
            subjectName = sub.name;
            subjectCode = sub.code;
          }
        }
      }

      return {
        ...recObj,
        sectionId: assignment?.sectionId || null,
        sectionName,
        subjectId: assignment?.subjectId || null,
        subjectName,
        subjectCode
      };
    });

    res.json(success({ disputes: enrichedDisputes }));
  } catch (err) {
    console.error('Failed to list escalated disputes:', err);
    res.status(500).json(fail('Internal server error'));
  }
};

/**
 * POST /disputes/:id/resolve-escalation
 * HOD-only route to resolve an escalated attendance dispute.
 */
const resolveEscalation = async (req, res) => {
  try {
    const callerRoles = req.user?.roles || [];
    const isSuperAdmin = callerRoles.includes('SUPERADMIN');
    const isAdmin = callerRoles.includes('ADMIN');
    const isHOD = callerRoles.includes('HOD') || req.effectiveRoles?.some(r => r.role === 'HOD');

    if (!isSuperAdmin && !isAdmin && !isHOD) {
      return res.status(403).json(fail('Access Denied: Only HOD can resolve escalated disputes'));
    }

    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const recordFilter = { _id: req.params.id };
    if (tenantId && !isSuperAdmin) {
      recordFilter.institutionId = tenantId;
    }

    const record = await AttendanceRecord.findOne(recordFilter);
    if (!record) {
      return res.status(404).json(fail('Attendance record not found'));
    }

    if (!record.escalation || record.escalation.status !== 'pending') {
      return res.status(400).json(fail('Record dispute has no pending escalation to resolve'));
    }

    const { resolution, newStatus } = req.body;
    if (!resolution || !resolution.trim()) {
      return res.status(400).json(fail('Resolution reason/text is required'));
    }

    if (newStatus && !VALID_STATUSES.includes(newStatus)) {
      return res.status(400).json(fail(`newStatus must be one of: ${VALID_STATUSES.join(', ')}`));
    }

    // Verify HOD owns the parent department
    const session = await LectureSession.findById(record.lectureSessionId);
    let disputeDeptId = null;
    let assignment = null;

    if (session && mongoose.connection.db) {
      assignment = await mongoose.connection.db
        .collection('teachingassignments')
        .findOne({ _id: session.teachingAssignmentId });

      if (assignment) {
        if (assignment.sectionId) {
          const section = await mongoose.connection.db
            .collection('sections')
            .findOne({ _id: assignment.sectionId });
          if (section) {
            const semester = await mongoose.connection.db
              .collection('semesters')
              .findOne({ _id: section.semesterId });
            if (semester) disputeDeptId = semester.departmentId?.toString();
          }
        }
        if (!disputeDeptId && assignment.subjectId) {
          const subject = await mongoose.connection.db
            .collection('subjects')
            .findOne({ _id: assignment.subjectId });
          if (subject) disputeDeptId = subject.departmentId?.toString();
        }
      }
    }

    if (!isSuperAdmin && !isAdmin) {
      const hodDeptId = await getHODDeptId(req, tenantId);
      if (disputeDeptId && hodDeptId && disputeDeptId !== hodDeptId.toString()) {
        return res.status(403).json(fail('Access Denied: This dispute belongs to a different department'));
      }
    }

    const oldStatus = record.status;
    if (newStatus) {
      record.status = newStatus;
    }
    record.escalation.status = 'resolved';
    record.escalation.resolution = resolution.trim();
    record.escalation.resolvedAt = new Date();
    record.escalation.resolvedBy = new mongoose.Types.ObjectId(req.user.userId);

    await record.save();

    await logAudit(req, 'ATTENDANCE_DISPUTE_RESOLVED', record._id.toString(), 'AttendanceRecord', {
      resolvedBy: req.user.userId,
      resolution: resolution.trim(),
      oldStatus,
      newStatus: record.status,
      studentId: record.studentId?.toString(),
      lectureSessionId: record.lectureSessionId?.toString(),
      sectionId: assignment?.sectionId?.toString(),
      institutionId: tenantId
    });

    res.json(success({ record, message: 'Dispute resolved successfully' }));
  } catch (err) {
    console.error('Failed to resolve escalation:', err);
    res.status(500).json(fail('Internal server error'));
  }
};

module.exports = {
  listEscalatedDisputes,
  resolveEscalation
};
