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

export function ProtectedRoute({ children, allowedRoles = [] }) {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  // ── 1. Must be logged in ──────────────────────────────────────────────────
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // ── 2. Role gate (skip if no roles specified) ─────────────────────────────
  if (allowedRoles.length > 0) {
    const userRoles = user?.roles ?? [];
    const allowed   = allowedRoles.some((r) => userRoles.includes(r));
    if (!allowed) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  // ── 3. All checks passed ──────────────────────────────────────────────────
  return children;
}
