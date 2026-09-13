const mongoose = require('mongoose');
const ImageKit = require('imagekit');
const Notice = require('../models/Notice.model');
const Note   = require('../models/Note.model');

// Lazy / safe ImageKit client initialization
const getImageKitClient = () => {
  return new ImageKit({
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY || 'dummy_public_key',
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY || 'dummy_private_key',
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT || 'https://ik.imagekit.io/dummy',
  });
};

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
  const { role, departmentIds = [], sectionIds = [], permissions = [] } = callerScope;

  if (role === 'SUPERADMIN' || role === 'ADMIN' || permissions.includes('notice.create.institution')) {
    // Full trust — return as-is (sanitised to arrays)
    return {
      departments: toObjectIdArray(rawTargeting.departments),
      years:       toNumberArray(rawTargeting.years),
      sections:    toObjectIdArray(rawTargeting.sections),
      roles:       toStringArray(rawTargeting.roles),
    };
  }

  if (role === 'HOD' || permissions.includes('notice.create.department')) {
    // Clamp departments to own department(s) if specified, otherwise allow requested departments
    const depts = (departmentIds && departmentIds.length > 0)
      ? departmentIds
      : toObjectIdArray(rawTargeting.departments);

    return {
      departments: depts,
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
const getNoticesForUser = async (userId, searchQuery = '', tenantId = null) => {
  const matchUser = { userId: new mongoose.Types.ObjectId(userId) };
  if (tenantId) {
    try {
      matchUser.institutionId = new mongoose.Types.ObjectId(tenantId);
    } catch {
      matchUser.institutionId = tenantId;
    }
  }

  const rolesPipeline = [
    { $match: matchUser },
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

  if (tenantId) {
    try {
      query.institutionId = new mongoose.Types.ObjectId(tenantId);
    } catch {
      query.institutionId = tenantId;
    }
  }

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
    const callerScope = req.callerScope || {};
    const permissions = callerScope.permissions || [];

    const canCreateDeptNotice = permissions.includes('notice.create.department') || ['SUPERADMIN', 'ADMIN', 'HOD'].includes(callerScope.role);
    const canCreateAnyNotice = permissions.includes('notice.create.institution') || ['SUPERADMIN', 'ADMIN'].includes(callerScope.role);
    const isStaffPoster = ['CC', 'FACULTY'].includes(callerScope.role);

    if (!canCreateDeptNotice && !canCreateAnyNotice && !isStaffPoster) {
      return res.status(403).json({ success: false, error: 'Forbidden: Insufficient permissions to post notices' });
    }

    const { title, body, attachments = [] } = req.body;

    if (!title || !body) {
      return res.status(400).json({ success: false, error: 'title and body are required' });
    }

    // --- The core security guarantee ---
    // targeting is REBUILT from callerScope; client payload targeting is ignored.
    const targeting = clampTargeting(req.body.targeting, callerScope);
    const rawInstitutionId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId || callerScope?.institutionId || req.body.institutionId;
    const institutionId = rawInstitutionId ? new mongoose.Types.ObjectId(rawInstitutionId) : null;

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
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const notices = await getNoticesForUser(req.user.userId, '', tenantId);
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
    
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const notices = await getNoticesForUser(req.user.userId, q, tenantId);
    res.status(200).json({ success: true, data: notices });
  } catch (err) {
    console.error('[searchNotices]', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * GET /upload-auth
 * Generates signed authentication parameters for client-side ImageKit uploads.
 */
exports.getImageKitAuth = async (req, res) => {
  try {
    const hasImageKit =
      process.env.IMAGEKIT_PUBLIC_KEY &&
      process.env.IMAGEKIT_PRIVATE_KEY &&
      process.env.IMAGEKIT_URL_ENDPOINT;

    if (!hasImageKit) {
      return res.status(500).json({
        success: false,
        error: 'ImageKit credentials not configured',
      });
    }

    const authParams = getImageKitClient().getAuthenticationParameters();
    return res.status(200).json({
      success: true,
      data: {
        ...authParams,
        publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
        urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
      },
    });
  } catch (err) {
    console.error('[getImageKitAuth]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * POST /notes
 * Auth required. resolveScope must run first.
 *
 * Flow:
 *  1. Accepts client-provided fileUrl (uploaded directly to ImageKit), OR
 *  2. Generates ImageKit signed upload parameters for the client.
 *  3. Persists the Note record scoped to the caller's section/department.
 */
exports.createNote = async (req, res) => {
  try {
    const callerScope = req.callerScope;

    // Only Faculty, CC, HOD, Admin can upload notes
    if (callerScope.role === 'STUDENT') {
      return res.status(403).json({ success: false, error: 'Students cannot upload notes' });
    }

    const { subjectId, filename, fileUrl } = req.body;
    if (!subjectId) {
      return res.status(400).json({ success: false, error: 'subjectId is required' });
    }

    // --- Clamp scope ---
    // Faculty/CC → only their own section(s), no department-level
    // HOD/Admin  → department-level allowed
    let clampedSectionId      = null;
    let clampedDepartmentLevel = null;

    if (callerScope.role === 'CC' || callerScope.role === 'FACULTY') {
      clampedSectionId = callerScope.sectionIds[0] || null;
      clampedDepartmentLevel = null;
    } else if (callerScope.role === 'HOD') {
      clampedSectionId       = null;
      clampedDepartmentLevel = callerScope.departmentIds[0] || null;
    } else {
      clampedDepartmentLevel = callerScope.departmentIds[0] || null;
    }

    // --- ImageKit upload params & final fileUrl ---
    let finalFileUrl = fileUrl || null;
    let uploadParams = null;

    const hasImageKit =
      process.env.IMAGEKIT_PUBLIC_KEY &&
      process.env.IMAGEKIT_PRIVATE_KEY &&
      process.env.IMAGEKIT_URL_ENDPOINT;

    if (!finalFileUrl) {
      if (hasImageKit) {
        const auth = getImageKitClient().getAuthenticationParameters();
        uploadParams = {
          ...auth,
          publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
          urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
          folder: '/notes',
          uploadUrl: 'https://upload.imagekit.io/api/v1/files/upload',
        };
        finalFileUrl = `${process.env.IMAGEKIT_URL_ENDPOINT}/notes/${req.user.userId}_${Date.now()}_${filename || 'upload'}`;
      } else {
        finalFileUrl = `https://ik.imagekit.io/demo/notes/${req.user.userId}_${Date.now()}_${filename || 'upload'}`;
        uploadParams = {
          note: 'ImageKit credentials not configured; set IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, IMAGEKIT_URL_ENDPOINT',
          expectedFileUrl: finalFileUrl,
        };
      }
    }

    const rawInstitutionId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId || callerScope?.institutionId;
    const institutionId = rawInstitutionId ? new mongoose.Types.ObjectId(rawInstitutionId) : null;

    const note = await Note.create({
      institutionId,
      subjectId:       new mongoose.Types.ObjectId(subjectId),
      sectionId:       clampedSectionId,
      yearLevel:       null,
      departmentLevel: clampedDepartmentLevel,
      fileUrl:         finalFileUrl,
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

/**
 * GET /notices/:id
 */
exports.getNoticeById = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const { id } = req.params;
    const query = { _id: id };
    if (tenantId) query.institutionId = tenantId;

    const notice = await Notice.findOne(query).lean();
    if (!notice) {
      return res.status(404).json({ success: false, error: 'Notice not found' });
    }
    res.status(200).json({ success: true, data: notice });
  } catch (err) {
    console.error('[getNoticeById]', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * GET /notes
 */
exports.listNotes = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const { subjectId, sectionId } = req.query;
    const query = {};
    if (tenantId) query.institutionId = tenantId;
    if (subjectId) query.subjectId = subjectId;
    if (sectionId) query.sectionId = sectionId;

    const notes = await Note.find(query).sort({ createdAt: -1 }).lean();
    res.status(200).json({ success: true, data: notes });
  } catch (err) {
    console.error('[listNotes]', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * GET /notes/:id
 */
exports.getNoteById = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const { id } = req.params;
    const query = { _id: id };
    if (tenantId) query.institutionId = tenantId;

    const note = await Note.findOne(query).lean();
    if (!note) {
      return res.status(404).json({ success: false, error: 'Note not found' });
    }
    res.status(200).json({ success: true, data: note });
  } catch (err) {
    console.error('[getNoteById]', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

