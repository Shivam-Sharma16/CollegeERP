import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useAuth } from './hooks/useAuth';

import LoginPage        from './pages/LoginPage';
import AdminDashboard   from './pages/AdminDashboard';
import FacultyDashboard from './pages/FacultyDashboard';
import StudentDashboard from './pages/StudentDashboard';
import HodDashboard     from './pages/HodDashboard';
import UnauthorizedPage from './pages/UnauthorizedPage';

/**
 * Root redirect — send "/" to the correct dashboard based on the user's role.
 * Falls back to /student for unknown roles so authenticated users always land
 * somewhere meaningful.
 */
function RootRedirect() {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const roles = user?.roles ?? [];
  if (roles.includes('SUPERADMIN') || roles.includes('ADMIN'))  return <Navigate to="/admin"   replace />;
  if (roles.includes('HOD'))                                     return <Navigate to="/hod"     replace />;
  if (roles.includes('FACULTY'))                                 return <Navigate to="/faculty" replace />;
  return <Navigate to="/student" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ── Public ──────────────────────────────────────────────────── */}
        <Route path="/login"        element={<LoginPage />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />

        {/* ── Root redirect ────────────────────────────────────────────── */}
        <Route path="/" element={<RootRedirect />} />

        {/* ── Admin (ADMIN, SUPERADMIN) ────────────────────────────────── */}
        <Route
          path="/admin/*"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'SUPERADMIN']}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        {/* ── HOD ─────────────────────────────────────────────────────── */}
        <Route
          path="/hod/*"
          element={
            <ProtectedRoute allowedRoles={['HOD', 'ADMIN', 'SUPERADMIN']}>
              <HodDashboard />
            </ProtectedRoute>
          }
        />

        {/* ── Faculty ──────────────────────────────────────────────────── */}
        <Route
          path="/faculty/*"
          element={
            <ProtectedRoute allowedRoles={['FACULTY', 'HOD', 'ADMIN', 'SUPERADMIN']}>
              <FacultyDashboard />
            </ProtectedRoute>
          }
        />

        {/* ── Student ──────────────────────────────────────────────────── */}
        <Route
          path="/student/*"
          element={
            <ProtectedRoute allowedRoles={['STUDENT']}>
              <StudentDashboard />
            </ProtectedRoute>
          }
        />

        {/* ── 404 fallback ─────────────────────────────────────────────── */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
