/**
 * Tool Registry — all tool implementations for every agent.
 *
 * Each tool is a plain async function: (args, context) => result
 *
 * context shape:
 *   {
 *     userId:      string,         // JWT-authenticated user's ObjectId string
 *     internalKey: string,         // x-internal-key for internal service calls
 *     serviceUrls: {               // base URLs for downstream services
 *       attendanceService, resultsService, feesService, noticeService
 *     },
 *     _fetch: Function?,           // injectable fetch (tests inject a mock here)
 *   }
 *
 * SECURITY RULES enforced IN this file:
 *   1. Student Personal Agent tools IGNORE args.userId — always use context.userId.
 *   2. createDraftNotice IGNORES args.status — always writes 'draft'.
 *   3. runAggregationQuery validates the template name BEFORE any network call.
 *   4. No tool makes a write call that could publish or auto-mark students.
 */

const NoticeDraft = require('../models/NoticeDraft.model');

// ─── Aggregation template registry (NL Admin Query Agent) ─────────────────────
const AGGREGATION_TEMPLATES = Object.freeze({
  attendanceBelowThreshold: {
    description: 'List students whose attendance percentage is below a given threshold',
    requiredParams: ['threshold'],
    optionalParams: ['department', 'year'],
  },
  defaultersByDepartment: {
    description: 'List fee defaulters filtered by department',
    requiredParams: ['department'],
    optionalParams: ['year'],
  },
  marksBelowThreshold: {
    description: 'List students whose marks are below a threshold',
    requiredParams: ['threshold'],
    optionalParams: ['department', 'year', 'examTypeId'],
  },
});

// ─── Internal HTTP helper ──────────────────────────────────────────────────────
async function callService(url, context, { method = 'GET', body } = {}) {
  const fetchFn = context._fetch ?? fetch;
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-internal-key': context.internalKey ?? '',
    },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetchFn(url, opts);
  if (!res.ok) throw new Error(`HTTP ${res.status} calling ${url}`);
  return res.json();
}

function svcUrl(context, service) {
  const map = {
    attendance: context.serviceUrls?.attendanceService ?? 'http://attendance-service:4004',
    results:    context.serviceUrls?.resultsService    ?? 'http://results-service:4005',
    fees:       context.serviceUrls?.feesService       ?? 'http://fees-service:4006',
    notice:     context.serviceUrls?.noticeService     ?? 'http://notice-service:4007',
  };
  return map[service];
}

// ─── Tool implementations ──────────────────────────────────────────────────────

/**
 * Fetch raw attendance records for a session.
 * Returns: { records: [{ studentId, deviceFingerprint, gpsCoords, livenessPingResponses }] }
 */
async function getSessionRecords(args, context) {
  const { sessionId } = args;
  if (!sessionId) return { error: 'sessionId is required' };
  const url = `${svcUrl(context, 'attendance')}/internal/sessions/${sessionId}/records`;
  return callService(url, context);
}

/**
 * Returns records grouped by device fingerprint (cluster) for fraud detection.
 * Returns: { clusters: [{ fingerprint, count, studentIds }] }
 */
async function getDeviceFingerprintClusters(args, context) {
  const { sessionId } = args;
  if (!sessionId) return { error: 'sessionId is required' };
  const url = `${svcUrl(context, 'attendance')}/internal/sessions/${sessionId}/fingerprint-clusters`;
  return callService(url, context);
}

/**
 * Attendance trend for a specific student (used by At-Risk agent — not own data).
 * Returns: { attendancePercent, recentSessions: [...], trend: 'improving'|'stable'|'declining' }
 */
async function getAttendanceTrend(args, context) {
  const { studentId, lastN = 10 } = args;
  if (!studentId) return { error: 'studentId is required' };
  const url = `${svcUrl(context, 'attendance')}/internal/students/${studentId}/attendance-trend?lastN=${lastN}`;
  return callService(url, context);
}

/**
 * Marks trend for a specific student.
 * Returns: { trend: 'improving'|'stable'|'declining', recentMarks: [...] }
 */
async function getMarksTrend(args, context) {
  const { studentId } = args;
  if (!studentId) return { error: 'studentId is required' };
  const url = `${svcUrl(context, 'results')}/internal/students/${studentId}/marks-trend`;
  return callService(url, context);
}

/**
 * Fee payment status for a specific student.
 * Returns: { hasDues: boolean, overdueCount, nextDueDate }
 */
async function getFeeStatus(args, context) {
  const { studentId } = args;
  if (!studentId) return { error: 'studentId is required' };
  const url = `${svcUrl(context, 'fees')}/internal/students/${studentId}/fee-status`;
  return callService(url, context);
}

/**
 * Execute a pre-approved aggregation template.
 * Template name is validated BEFORE any HTTP call — unknown names are rejected in-process.
 */
async function runAggregationQuery(args, context) {
  const { template, ...params } = args;

  // ── Template validation (in-process, no network round-trip on failure) ──────
  if (!template) {
    return { error: 'template name is required', allowedTemplates: Object.keys(AGGREGATION_TEMPLATES) };
  }
  if (!AGGREGATION_TEMPLATES[template]) {
    return {
      error: `Unknown template '${template}'. The agent may only use pre-approved templates.`,
      allowedTemplates: Object.keys(AGGREGATION_TEMPLATES),
    };
  }
  // ────────────────────────────────────────────────────────────────────────────

  const url = `${svcUrl(context, 'attendance')}/internal/aggregate`;
  return callService(url, context, { method: 'POST', body: { template, params } });
}

/**
 * Create an AI-generated notice DRAFT.
 * args.status is IGNORED — status is always 'draft' (enforced by Mongoose schema enum too).
 */
async function createDraftNotice(args, context) {
  // Deliberately destructure and discard 'status' from args
  const { title, body, targeting, status: _ignoredStatus, ...rest } = args;

  const draft = await NoticeDraft.create({
    title:       title || 'Untitled Draft',
    body:        body  || '',
    targeting:   targeting ?? {},
    status:      'draft',       // Hardcoded — args.status is intentionally discarded
    createdBy:   context.userId,
    aiGenerated: true,
  });

  return {
    draftId: draft._id.toString(),
    title:   draft.title,
    status:  draft.status,       // Will always be 'draft'
    message: 'Draft created. A human reviewer must publish this notice.',
  };
}

// ── Student Personal Agent tools — ALL use context.userId (never args.userId) ─

/**
 * Get the AUTHENTICATED student's own attendance.
 * args.userId is INTENTIONALLY IGNORED.
 */
async function getOwnAttendance(args, context) {
  const userId = context.userId;  // ← Server-enforced: never args.userId
  const url = `${svcUrl(context, 'attendance')}/internal/students/${userId}/attendance`;
  return callService(url, context);
}

/**
 * Get the AUTHENTICATED student's own marks.
 * args.userId is INTENTIONALLY IGNORED.
 */
async function getOwnMarks(args, context) {
  const userId = context.userId;  // ← Server-enforced
  const url = `${svcUrl(context, 'results')}/internal/students/${userId}/marks`;
  return callService(url, context);
}

/**
 * Get the AUTHENTICATED student's own fee status.
 * args.userId is INTENTIONALLY IGNORED.
 */
async function getOwnFees(args, context) {
  const userId = context.userId;  // ← Server-enforced
  const url = `${svcUrl(context, 'fees')}/internal/students/${userId}/fees`;
  return callService(url, context);
}

/**
 * Search study notes for the AUTHENTICATED student's enrolled subjects.
 * args.userId is INTENTIONALLY IGNORED.
 */
async function searchOwnSubjectNotes(args, context) {
  const userId = context.userId;  // ← Server-enforced
  const { query = '', subjectId = '' } = args;
  const q = encodeURIComponent(query);
  const url = `${svcUrl(context, 'notice')}/internal/students/${userId}/notes?q=${q}&subjectId=${subjectId}`;
  return callService(url, context);
}

// ─── Registry export ───────────────────────────────────────────────────────────
const toolRegistry = {
  getSessionRecords,
  getDeviceFingerprintClusters,
  getAttendanceTrend,
  getMarksTrend,
  getFeeStatus,
  runAggregationQuery,
  createDraftNotice,
  getOwnAttendance,
  getOwnMarks,
  getOwnFees,
  searchOwnSubjectNotes,
};

// Tool definitions for the LLM (Anthropic input_schema format)
const TOOL_DEFINITIONS = {
  getSessionRecords: {
    name: 'getSessionRecords',
    description: 'Fetch all attendance records (student IDs, device fingerprints, GPS coords, liveness responses) for a lecture session.',
    input_schema: { type: 'object', properties: { sessionId: { type: 'string', description: 'Lecture session ObjectId' } }, required: ['sessionId'] },
  },
  getDeviceFingerprintClusters: {
    name: 'getDeviceFingerprintClusters',
    description: 'Get attendance records grouped by device fingerprint to detect shared-device check-ins.',
    input_schema: { type: 'object', properties: { sessionId: { type: 'string' } }, required: ['sessionId'] },
  },
  getAttendanceTrend: {
    name: 'getAttendanceTrend',
    description: 'Get a student\'s attendance percentage and trend over recent sessions.',
    input_schema: { type: 'object', properties: { studentId: { type: 'string' }, lastN: { type: 'number', description: 'Number of recent sessions', default: 10 } }, required: ['studentId'] },
  },
  getMarksTrend: {
    name: 'getMarksTrend',
    description: 'Get a student\'s marks trend across recent exams.',
    input_schema: { type: 'object', properties: { studentId: { type: 'string' } }, required: ['studentId'] },
  },
  getFeeStatus: {
    name: 'getFeeStatus',
    description: 'Get the fee payment status for a student — whether dues exist and when the next due date is.',
    input_schema: { type: 'object', properties: { studentId: { type: 'string' } }, required: ['studentId'] },
  },
  runAggregationQuery: {
    name: 'runAggregationQuery',
    description: `Execute a pre-approved aggregation query. Templates: ${Object.keys(AGGREGATION_TEMPLATES).join(', ')}.`,
    input_schema: {
      type: 'object',
      properties: {
        template:   { type: 'string', description: 'Template name (must be one of the approved list)' },
        threshold:  { type: 'number' },
        department: { type: 'string' },
        year:       { type: 'number' },
        examTypeId: { type: 'string' },
      },
      required: ['template'],
    },
  },
  createDraftNotice: {
    name: 'createDraftNotice',
    description: 'Create a draft notice. Status is always "draft" — cannot be published by this agent.',
    input_schema: {
      type: 'object',
      properties: {
        title:     { type: 'string' },
        body:      { type: 'string' },
        targeting: {
          type: 'object',
          properties: {
            departments: { type: 'array', items: { type: 'string' } },
            years:       { type: 'array', items: { type: 'number' } },
            sections:    { type: 'array', items: { type: 'string' } },
            roles:       { type: 'array', items: { type: 'string' } },
          },
        },
      },
      required: ['title', 'body'],
    },
  },
  getOwnAttendance: {
    name: 'getOwnAttendance',
    description: 'Get the authenticated student\'s own attendance records. Server ignores any userId in args.',
    input_schema: { type: 'object', properties: {} },
  },
  getOwnMarks: {
    name: 'getOwnMarks',
    description: 'Get the authenticated student\'s own marks. Server ignores any userId in args.',
    input_schema: { type: 'object', properties: {} },
  },
  getOwnFees: {
    name: 'getOwnFees',
    description: 'Get the authenticated student\'s own fee payment status. Server ignores any userId in args.',
    input_schema: { type: 'object', properties: {} },
  },
  searchOwnSubjectNotes: {
    name: 'searchOwnSubjectNotes',
    description: 'Search study notes for the authenticated student\'s subjects. Server ignores any userId in args.',
    input_schema: { type: 'object', properties: { query: { type: 'string' }, subjectId: { type: 'string' } } },
  },
};

module.exports = { toolRegistry, TOOL_DEFINITIONS, AGGREGATION_TEMPLATES };
