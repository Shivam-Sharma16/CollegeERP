const crypto = require('crypto');
const env = require('../config/env');

const buildHeaders = ({ tenantId, token }) => {
  const headers = {
    'Accept': 'application/json'
  };

  if (env.INTERNAL_SERVICE_KEY) {
    headers['x-internal-key'] = env.INTERNAL_SERVICE_KEY;
    if (tenantId) {
      headers['x-tenant-id'] = tenantId.toString();
      const signature = crypto
        .createHmac('sha256', env.INTERNAL_SERVICE_KEY)
        .update(tenantId.toString())
        .digest('hex');
      headers['x-tenant-signature'] = signature;
    }
  }

  if (token) {
    headers['Authorization'] = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
  }

  return headers;
};

const safeFetch = async (url, options = {}, timeoutMs = 5000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) {
      console.warn(`[ExternalReporting] HTTP ${res.status} from ${url}`);
      return null;
    }
    const body = await res.json();
    return body.data !== undefined ? body.data : body;
  } catch (err) {
    clearTimeout(timer);
    console.warn(`[ExternalReporting] Error calling ${url}:`, err.message);
    return null;
  }
};

/**
 * Fetch teaching assignments from academic-service
 */
const fetchTeachingAssignments = async ({ tenantId, departmentId, facultyId, token }) => {
  const params = new URLSearchParams();
  if (departmentId) params.append('departmentId', departmentId);
  if (facultyId) params.append('facultyId', facultyId);

  const query = params.toString() ? `?${params.toString()}` : '';
  const url = `${env.ACADEMIC_SERVICE_URL}/teaching-assignments${query}`;
  const headers = buildHeaders({ tenantId, token });

  const data = await safeFetch(url, { headers });
  if (!data) return [];
  return Array.isArray(data) ? data : (data.assignments || []);
};

/**
 * Fetch subjects from academic-service
 */
const fetchSubjects = async ({ tenantId, departmentId, token }) => {
  const params = new URLSearchParams();
  if (departmentId) params.append('departmentId', departmentId);

  const query = params.toString() ? `?${params.toString()}` : '';
  const url = `${env.ACADEMIC_SERVICE_URL}/subjects${query}`;
  const headers = buildHeaders({ tenantId, token });

  const data = await safeFetch(url, { headers });
  if (!data) return [];
  return Array.isArray(data) ? data : (data.subjects || []);
};

/**
 * Fetch attendance trend from attendance-service
 */
const fetchAttendanceTrend = async ({ tenantId, teachingAssignmentIds, token }) => {
  const params = new URLSearchParams();
  if (teachingAssignmentIds && teachingAssignmentIds.length > 0) {
    params.append('teachingAssignmentIds', teachingAssignmentIds.join(','));
  }

  const query = params.toString() ? `?${params.toString()}` : '';
  const url = `${env.ATTENDANCE_SERVICE_URL}/records/reports/trend${query}`;
  const headers = buildHeaders({ tenantId, token });

  const data = await safeFetch(url, { headers });
  if (!data) return [];
  return data.trend || (Array.isArray(data) ? data : []);
};

/**
 * Fetch academic performance from results-service
 */
const fetchAcademicPerformance = async ({ tenantId, subjectIds, token }) => {
  const params = new URLSearchParams();
  if (subjectIds && subjectIds.length > 0) {
    params.append('subjectIds', subjectIds.join(','));
  }

  const query = params.toString() ? `?${params.toString()}` : '';
  const url = `${env.RESULTS_SERVICE_URL}/marks/reports/academic-performance${query}`;
  const headers = buildHeaders({ tenantId, token });

  const data = await safeFetch(url, { headers });
  if (!data) return [];
  return data.trend || (Array.isArray(data) ? data : []);
};

module.exports = {
  fetchTeachingAssignments,
  fetchSubjects,
  fetchAttendanceTrend,
  fetchAcademicPerformance
};
