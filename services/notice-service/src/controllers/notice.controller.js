const mongoose = require('mongoose');
const { v2: cloudinary } = require('cloudinary');
const Notice = require('../models/Notice.model');
const Note   = require('../models/Note.model');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * clampTargeting
 *
 * Rebuilds the `targeting` object entirely from the caller's own scope.
 * The raw client payload is *ignored* for non-Admin roles.
 *
 * Role → Allowed targeting
 *  SUPERADMIN / ADMIN : pass through whatever the client sent (full trust)
 *  HOD                : departments clamped to [own deptId], years/sections/roles from payload
 *  CC / FACULTY       : sections clamped to [own sectionId(s)], departments/years stripped
 *  STUDENT            : blocked upstream; included here for safety → empty targeting
 */
const clampTargeting = (rawTargeting = {}, callerScope) => {
  const { role, departmentIds, sectionIds } = callerScope;

  if (role === 'SUPERADMIN' || role === 'ADMIN') {
    // Full trust — return as-is (sanitised to arrays)
    return {
      departments: toObjectIdArray(rawTargeting.departments),
      years:       toNumberArray(rawTargeting.years),
      sections:    toObjectIdArray(rawTargeting.sections),
      roles:       toStringArray(rawTargeting.roles),
    };
  }

  if (role === 'HOD') {
    // Clamp departments to own department(s); allow years/sections/roles from payload
    return {
      departments: departmentIds,
      years:       toNumberArray(rawTargeting.years),
      sections:    toObjectIdArray(rawTargeting.sections),
      roles:       toStringArray(rawTargeting.roles),
    };
  }

  // CC / FACULTY — clamp to own section(s) only; strip department / year targeting
  if (role === 'CC' || role === 'FACULTY') {
    return {
      departments: [],
      years:       [],
      sections:    sectionIds,
      roles:       [],
    };
  }

  // STUDENT or unknown — produce empty targeting (caller should have been blocked)
  return { departments: [], years: [], sections: [], roles: [] };
};

const toObjectIdArray = (arr) => {
  if (!Array.isArray(arr)) return [];
  return arr.map(id => {
    try { return new mongoose.Types.ObjectId(id); } catch { return null; }
  }).filter(Boolean);
};

const toNumberArray = (arr) => {
  if (!Array.isArray(arr)) return [];
  return arr.map(Number).filter(n => !isNaN(n));
};

const toStringArray = (arr) => {
  if (!Array.isArray(arr)) return [];
  return arr.filter(s => typeof s === 'string');
};

// ---------------------------------------------------------------------------
// getNoticesForUser  (Phase 7 pipeline)
// ---------------------------------------------------------------------------
const getNoticesForUser = async (userId, searchQuery = '') => {
  const rolesPipeline = [
    { $match: { userId: new mongoose.Types.ObjectId(userId) } },
    { $lookup: { from: 'sections',  localField: 'sectionId',       foreignField: '_id', as: 'section'  } },
    { $unwind: { path: '$section',  preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'semesters', localField: 'section.semesterId', foreignField: '_id', as: 'semester' } },
    { $unwind: { path: '$semester', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'years',     localField: 'semester.yearId',  foreignField: '_id', as: 'yearDoc'  } },
    { $unwind: { path: '$yearDoc',  preserveNullAndEmptyArrays: true } },
    { $project: { role: 1, departmentId: 1, sectionId: 1, yearNumber: '$yearDoc.yearNumber' } },
  ];

  const assignments = await mongoose.connection
    .collection('roleassignments')
    .aggregate(rolesPipeline)
    .toArray();

  const userRoles       = new Set();
  const userDepartments = new Set();
  const userSections    = new Set();
  const userYears       = new Set();

  for (const a of assignments) {
    if (a.role)         userRoles.add(a.role);
    if (a.departmentId) userDepartments.add(a.departmentId.toString());
    if (a.sectionId)    userSections.add(a.sectionId.toString());
    if (a.yearNumber)   userYears.add(a.yearNumber);
  }

  const query = {
    $and: [
      { $or: [
        { 'targeting.departments': { $size: 0 } },
        { 'targeting.departments': { $exists: false } },
        { 'targeting.departments': { $in: Array.from(userDepartments).map(id => new mongoose.Types.ObjectId(id)) } },
      ]},
      { $or: [
        { 'targeting.years': { $size: 0 } },
        { 'targeting.years': { $exists: false } },
        { 'targeting.years': { $in: Array.from(userYears) } },
      ]},
      { $or: [
        { 'targeting.sections': { $size: 0 } },
        { 'targeting.sections': { $exists: false } },
        { 'targeting.sections': { $in: Array.from(userSections).map(id => new mongoose.Types.ObjectId(id)) } },
      ]},
      { $or: [
        { 'targeting.roles': { $size: 0 } },
        { 'targeting.roles': { $exists: false } },
        { 'targeting.roles': { $in: Array.from(userRoles) } },
      ]},
    ],
  };

  if (searchQuery) {
    const regex = new RegExp(searchQuery, 'i');
    query.$and.push({
      $or: [
        { title: regex },
        { body: regex }
      ]
    });
  }

  return Notice.find(query).sort({ publishedAt: -1 }).lean();
};

// ---------------------------------------------------------------------------
// Controllers
// ---------------------------------------------------------------------------

/**
 * POST /notices
 * Auth required. resolveScope middleware must run first to populate req.callerScope.
 * Targeting is rebuilt server-side; the client payload targeting is discarded
 * for non-Admin roles.
 */
exports.createNotice = async (req, res) => {
  try {
    const callerScope = req.callerScope;

    // Students cannot post notices
    if (callerScope.role === 'STUDENT') {
      return res.status(403).json({ success: false, error: 'Students cannot post notices' });
    }

    const { title, body, attachments = [] } = req.body;

    if (!title || !body) {
      return res.status(400).json({ success: false, error: 'title and body are required' });
    }

    // --- The core security guarantee ---
    // targeting is REBUILT from callerScope; client payload targeting is ignored.
    const targeting = clampTargeting(req.body.targeting, callerScope);
    const institutionId = req.user?.institutionId || callerScope?.institutionId || req.body.institutionId;

    const notice = await Notice.create({
      institutionId,
      title,
      body,
      attachments,
      targeting,
      createdBy: new mongoose.Types.ObjectId(req.user.userId),
    });

    res.status(201).json({ success: true, data: notice });
  } catch (err) {
    console.error('[createNotice]', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * GET /notices/mine
 * Returns notices visible to the calling user based on their role/section/dept.
 */
exports.getNoticesMine = async (req, res) => {
  try {
    const notices = await getNoticesForUser(req.user.userId);
    res.status(200).json({ success: true, data: notices });
  } catch (err) {
    console.error('[getNoticesMine]', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * GET /notices/search
 * Searches notices visible to the caller
 */
exports.searchNotices = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(200).json({ success: true, data: [] });
    
    const notices = await getNoticesForUser(req.user.userId, q);
    res.status(200).json({ success: true, data: notices });
  } catch (err) {
    console.error('[searchNotices]', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * POST /notes
 * Auth required. resolveScope must run first.
 *
 * Flow:
 *  1. Generate a Cloudinary signed upload URL (or mock params if creds absent).
 *  2. Return { uploadUrl, publicId, signature, ... } to the client.
 *  3. Client uploads directly; client then POSTs the final fileUrl back, OR
 *     we persist the Note record here with an expected URL pattern.
 *
 * The note's sectionId / departmentLevel are CLAMPED from callerScope —
 * a Faculty can only target their own section, not the whole department.
 */
exports.createNote = async (req, res) => {
  try {
    const callerScope = req.callerScope;

    // Only Faculty, CC, HOD, Admin can upload notes
    if (callerScope.role === 'STUDENT') {
      return res.status(403).json({ success: false, error: 'Students cannot upload notes' });
    }

    const { subjectId, filename } = req.body;
    if (!subjectId) {
      return res.status(400).json({ success: false, error: 'subjectId is required' });
    }

    // --- Clamp scope ---
    // Faculty/CC → only their own section(s), no department-level
    // HOD/Admin  → department-level allowed
    let clampedSectionId      = null;
    let clampedDepartmentLevel = null;

    if (callerScope.role === 'CC' || callerScope.role === 'FACULTY') {
      // Use first (and typically only) section assignment
      clampedSectionId = callerScope.sectionIds[0] || null;
      clampedDepartmentLevel = null;
    } else if (callerScope.role === 'HOD') {
      clampedSectionId       = null;
      clampedDepartmentLevel = callerScope.departmentIds[0] || null;
    } else {
      // ADMIN / SUPERADMIN: trust client-supplied scope, fall back to caller's dept
      clampedDepartmentLevel = callerScope.departmentIds[0] || null;
    }

    // --- Cloudinary signed URL ---
    const publicId = `notes/${req.user.userId}/${Date.now()}_${filename || 'upload'}`;
    let uploadParams;

    const hasCloudinaryCreds =
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY    &&
      process.env.CLOUDINARY_API_SECRET;

    if (hasCloudinaryCreds) {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key:    process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      });

      const timestamp = Math.round(Date.now() / 1000);
      const signature = cloudinary.utils.api_sign_request(
        { public_id: publicId, timestamp },
        process.env.CLOUDINARY_API_SECRET
      );

      uploadParams = {
        uploadUrl:  `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/raw/upload`,
        publicId,
        timestamp,
        signature,
        apiKey: process.env.CLOUDINARY_API_KEY,
        // Derived URL the client should POST back after upload completes
        expectedFileUrl: `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/raw/upload/${publicId}`,
      };
    } else {
      // Local dev / no creds — return mock params
      uploadParams = {
        uploadUrl: null,
        publicId,
        note: 'Cloudinary credentials not configured; set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET',
        expectedFileUrl: `https://res.cloudinary.com/demo/raw/upload/${publicId}`,
      };
    }

    // Persist the Note record with the expected URL
    // (In production the client would confirm upload; here we pre-create the record)
    const note = await Note.create({
      subjectId:       new mongoose.Types.ObjectId(subjectId),
      sectionId:       clampedSectionId,
      yearLevel:       null,
      departmentLevel: clampedDepartmentLevel,
      fileUrl:         uploadParams.expectedFileUrl,
      uploadedBy:      new mongoose.Types.ObjectId(req.user.userId),
    });

    res.status(201).json({
      success: true,
      data: {
        note,
        upload: uploadParams,
      },
    });
  } catch (err) {
    console.error('[createNote]', err);
    res.status(500).json({ success: false, error: err.message });
  }
};
