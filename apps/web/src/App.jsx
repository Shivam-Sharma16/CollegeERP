import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useAuth } from './hooks/useAuth';
import { ToastProvider } from './components/ui/ToastContext';

import LoginPage        from './pages/LoginPage';
import StudentRegisterPage from './pages/StudentRegisterPage';
import SuperadminSignupPage from './pages/SuperadminSignupPage';
import AdminDashboard   from './pages/AdminDashboard';
import SuperAdminManagement from './pages/SuperAdminManagement';
import InstitutionSettings from './pages/InstitutionSettings';
import AdminHodManagement from './pages/AdminHodManagement';
import AdminReports     from './pages/AdminReports';
import FacultyDashboard from './pages/FacultyDashboard';
import StudentDashboard from './pages/StudentDashboard';
import HodDashboard     from './pages/HodDashboard';
import CcDashboard      from './pages/CcDashboard';
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
  if (roles.includes('CC'))                                      return <Navigate to="/cc"      replace />;
  return <Navigate to="/student" replace />;
}

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
        {/* ── Public ──────────────────────────────────────────────────── */}
        <Route path="/login"        element={<LoginPage />} />
        <Route path="/register"     element={<StudentRegisterPage />} />
        <Route path="/superadmin/signup" element={<SuperadminSignupPage />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />

        {/* ── Root redirect ────────────────────────────────────────────── */}
        <Route path="/" element={<RootRedirect />} />

        {/* ── Admin (ADMIN, SUPERADMIN) ────────────────────────────────── */}
        <Route
          path="/settings"
          element={
            <ProtectedRoute allowedRoles={['SUPERADMIN']}>
              <InstitutionSettings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/management"
          element={
            <ProtectedRoute allowedRoles={['SUPERADMIN']}>
              <SuperAdminManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/*"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'SUPERADMIN']}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        {/* ── HOD Management (ADMIN, SUPERADMIN) ───────────────────────── */}
        <Route
          path="/hods"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'SUPERADMIN']}>
              <AdminHodManagement />
            </ProtectedRoute>
          }
        />

        {/* ── Admin Reports (ADMIN, HOD) ───────────────────────────────── */}
        <Route
          path="/reports"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'HOD']}>
              <AdminReports />
            </ProtectedRoute>
          }
        />

        {/* ── HOD (Dashboard) ─────────────────────────────────────────── */}
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

        {/* ── Class Coordinator (CC) ───────────────────────────────────── */}
        <Route
          path="/cc/*"
          element={
            <ProtectedRoute allowedRoles={['CC', 'HOD', 'ADMIN', 'SUPERADMIN']}>
              <CcDashboard />
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
    </ToastProvider>
  );
}
