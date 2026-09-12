/**
 * Domain and Role Routing Utilities
 */

const ROOT_DOMAINS = new Set([
  'localhost',
  '127.0.0.1',
  'collegeerp.com',
  'www.collegeerp.com',
]);

/**
 * Checks if the current browser environment is on the root platform domain
 * (no tenant subdomain prefix).
 */
export function isRootDomain() {
  if (typeof window === 'undefined') return true;
  const hostname = window.location.hostname.toLowerCase().trim();

  // Explicit localhost or IP
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return true;
  }

  // Exact root domain match
  if (ROOT_DOMAINS.has(hostname)) {
    return true;
  }

  // Check if hostname has a subdomain prefix (e.g. apex-tech.localhost, jecrc.collegeerp.com)
  const parts = hostname.split('.');
  if (parts.length > 2 || (parts.length === 2 && parts[1] === 'localhost')) {
    const sub = parts[0];
    if (!['www', 'localhost', '127', 'collegeerp'].includes(sub)) {
      return false;
    }
  }

  return true;
}

/**
 * Role hierarchy for resolving the default home/dashboard path of any authenticated user.
 */
export function getUserRoleDashboard(user, tenantSlug = null) {
  const roles = user?.roles ?? [];
  const prefix = tenantSlug ? `/inst/${tenantSlug}` : '';

  if (roles.includes('SUPERADMIN')) {
    return `${prefix}/superadmin/dashboard`;
  }
  if (roles.includes('ADMIN')) {
    return `${prefix}/admin/dashboard`;
  }
  if (roles.includes('HOD')) {
    return `${prefix}/hod/dashboard`;
  }
  if (roles.includes('CC')) {
    return `${prefix}/cc/dashboard`;
  }
  if (roles.includes('FACULTY')) {
    return `${prefix}/faculty/dashboard`;
  }
  return `${prefix}/student/dashboard`;
}

/**
 * Extract role prefix from pathname.
 * Handles both root paths (/hod/dashboard) and tenant paths (/inst/apex-tech/hod/dashboard).
 */
export function getRoleFromPath(pathname = '') {
  // Strip /inst/:slug if present
  const cleanPath = pathname.replace(/^\/inst\/[a-z0-9-]+\/?/i, '/');
  
  const match = cleanPath.match(/^\/([a-z0-9-]+)/i);
  if (!match) return null;

  const segment = match[1].toLowerCase();
  const knownRoles = ['superadmin', 'admin', 'hod', 'cc', 'faculty', 'student'];
  return knownRoles.includes(segment) ? segment : null;
}
