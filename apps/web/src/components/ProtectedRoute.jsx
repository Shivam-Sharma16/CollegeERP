/**
 * ProtectedRoute
 *
 * Usage:
 *   <ProtectedRoute allowedRoles={['ADMIN', 'SUPERADMIN']}>
 *     <AdminDashboard />
 *   </ProtectedRoute>
 *
 * Behaviour:
 *   1. Not authenticated → redirect to /login (preserves attempted URL via `state`).
 *   2. Authenticated but wrong role → redirect to /unauthorized.
 *   3. Authenticated + correct role → render children.
 *
 * `allowedRoles` defaults to [] which means ANY authenticated user can access.
 */

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import usePageMeta from '../hooks/usePageMeta';
import { getUserRoleDashboard, getRoleFromPath } from '../utils/domain';

const ROLE_PREFIX_PERMISSIONS = {
  superadmin: ['SUPERADMIN'],
  admin: ['ADMIN', 'SUPERADMIN'],
  hod: ['HOD', 'ADMIN', 'SUPERADMIN'],
  cc: ['CC', 'HOD', 'ADMIN', 'SUPERADMIN'],
  faculty: ['FACULTY', 'HOD', 'ADMIN', 'SUPERADMIN'],
  student: ['STUDENT'],
};

export function ProtectedRoute({ children, allowedRoles = [] }) {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  // Add noindex to all authenticated routes automatically (Phase 59)
  usePageMeta({
    title: 'Dashboard',
    description: 'Internal college dashboard',
    isPublic: false
  });

  // Extract optional tenant slug from path
  const slugMatch = location.pathname.match(/^\/inst\/([a-z0-9-]+)/i);
  const slug = slugMatch ? slugMatch[1] : null;

  // ── 1. Must be logged in ──────────────────────────────────────────────────
  if (!isAuthenticated) {
    const loginPath = slug ? `/inst/${slug}/login` : '/login';
    return <Navigate to={loginPath} state={{ from: location }} replace />;
  }

  const userRoles = user?.roles ?? [];

  // ── 2. Check path role-prefix mismatch ────────────────────────────────────
  // If user accesses /hod/dashboard directly without HOD role, redirect to /faculty/dashboard, etc.
  const pathRole = getRoleFromPath(location.pathname);
  if (pathRole && ROLE_PREFIX_PERMISSIONS[pathRole]) {
    const requiredRoles = ROLE_PREFIX_PERMISSIONS[pathRole];
    const hasPathRole = requiredRoles.some((r) => userRoles.includes(r));
    if (!hasPathRole) {
      const targetDashboard = getUserRoleDashboard(user, slug);
      // Avoid infinite loop if dashboard itself matched
      if (location.pathname !== targetDashboard) {
        return <Navigate to={targetDashboard} replace />;
      }
      return <Navigate to="/unauthorized" replace />;
    }
  }

  // ── 3. Explicit allowedRoles check ────────────────────────────────────────
  if (allowedRoles.length > 0) {
    const allowed = allowedRoles.some((r) => userRoles.includes(r));
    if (!allowed) {
      const targetDashboard = getUserRoleDashboard(user, slug);
      if (location.pathname !== targetDashboard) {
        return <Navigate to={targetDashboard} replace />;
      }
      return <Navigate to="/unauthorized" replace />;
    }
  }

  // ── 4. All checks passed ──────────────────────────────────────────────────
  return children;
}
