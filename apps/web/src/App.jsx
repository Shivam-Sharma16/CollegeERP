import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useAuth } from './hooks/useAuth';
import { ToastProvider } from './components/ui/ToastContext';

import { lazy, Suspense } from 'react';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const StudentRegisterPage = lazy(() => import('./pages/StudentRegisterPage'));
const SuperadminSignupPage = lazy(() => import('./pages/SuperadminSignupPage'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const SuperAdminManagement = lazy(() => import('./pages/SuperAdminManagement'));
const InstitutionSettings = lazy(() => import('./pages/InstitutionSettings'));
const AdminHodManagement = lazy(() => import('./pages/AdminHodManagement'));
const AdminReports = lazy(() => import('./pages/AdminReports'));
const AdminFeePolicy = lazy(() => import('./pages/AdminFeePolicy'));
const AdminNotices = lazy(() => import('./pages/AdminNotices'));
const FacultyDashboard = lazy(() => import('./pages/FacultyDashboard'));
const StudentDashboard = lazy(() => import('./pages/StudentDashboard'));
const HodDashboard = lazy(() => import('./pages/HodDashboard'));
const HodManagement = lazy(() => import('./pages/HodManagement'));
const HodAcademicStructure = lazy(() => import('./pages/HodAcademicStructure'));
const HodTeachingAssignments = lazy(() => import('./pages/HodTeachingAssignments'));
const StudentAttendancePage = lazy(() => import('./pages/StudentAttendancePage'));
const StudentTranscriptPage = lazy(() => import('./pages/StudentTranscriptPage'));
const StudentFeesPage = lazy(() => import('./pages/StudentFeesPage'));
const StudentNoticesPage = lazy(() => import('./pages/StudentNoticesPage'));
const LiveAttendanceSession = lazy(() => import('./pages/LiveAttendanceSession'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const FacultyNotesPage = lazy(() => import('./pages/FacultyNotesPage'));
const FacultyMarksEntryPage = lazy(() => import('./pages/FacultyMarksEntryPage'));
const FacultySubjectAnalyticsPage = lazy(() => import('./pages/FacultySubjectAnalyticsPage'));
const CcDashboard = lazy(() => import('./pages/CcDashboard'));
const CcWorkspace = lazy(() => import('./pages/CcWorkspace'));
const UnauthorizedPage = lazy(() => import('./pages/UnauthorizedPage'));

import { GlobalSearch } from './components/ui/GlobalSearch';

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

function AppLoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="flex flex-col items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
        <p className="mt-4 text-gray-600 dark:text-gray-400 font-medium">Loading component...</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <GlobalSearch />
        <Suspense fallback={<AppLoadingFallback />}>
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

        {/* ── Fee Policy (ADMIN) ───────────────────────────────────────── */}
        <Route
          path="/fee-policy"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <AdminFeePolicy />
            </ProtectedRoute>
          }
        />

        {/* ── Institution Notices (ADMIN) ──────────────────────────────── */}
        <Route
          path="/notices"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <AdminNotices />
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

        {/* ── HOD Management ──────────────────────────────────────────── */}
        <Route
          path="/hod/management"
          element={
            <ProtectedRoute allowedRoles={['HOD', 'ADMIN', 'SUPERADMIN']}>
              <HodManagement />
            </ProtectedRoute>
          }
        />

        {/* ── HOD Academic Structure ───────────────────────────────────── */}
        <Route
          path="/hod/academic-structure"
          element={
            <ProtectedRoute allowedRoles={['HOD', 'ADMIN', 'SUPERADMIN']}>
              <HodAcademicStructure />
            </ProtectedRoute>
          }
        />

        {/* ── HOD Teaching Assignments ───────────────────────────────────── */}
        <Route
          path="/assignments"
          element={
            <ProtectedRoute allowedRoles={['HOD', 'ADMIN', 'SUPERADMIN']}>
              <HodTeachingAssignments />
            </ProtectedRoute>
          }
        />

        {/* ── Faculty ──────────────────────────────────────────────────── */}
        <Route
          path="/faculty/notes"
          element={
            <ProtectedRoute allowedRoles={['FACULTY', 'HOD', 'ADMIN', 'SUPERADMIN']}>
              <FacultyNotesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/faculty/analytics"
          element={
            <ProtectedRoute allowedRoles={['FACULTY', 'HOD', 'ADMIN', 'SUPERADMIN']}>
              <FacultySubjectAnalyticsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/marks-entry"
          element={
            <ProtectedRoute allowedRoles={['FACULTY', 'HOD', 'ADMIN', 'SUPERADMIN']}>
              <FacultyMarksEntryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/faculty/attendance/session/:sessionId"
          element={
            <ProtectedRoute allowedRoles={['FACULTY', 'HOD', 'ADMIN', 'SUPERADMIN']}>
              <LiveAttendanceSession />
            </ProtectedRoute>
          }
        />
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
          path="/cc/workspace"
          element={
            <ProtectedRoute allowedRoles={['CC', 'HOD', 'ADMIN', 'SUPERADMIN']}>
              <CcWorkspace />
            </ProtectedRoute>
          }
        />
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
          path="/attendance"
          element={
            <ProtectedRoute allowedRoles={['STUDENT']}>
              <StudentAttendancePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/student/attendance"
          element={
            <ProtectedRoute allowedRoles={['STUDENT']}>
              <StudentAttendancePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/student/transcript"
          element={
            <ProtectedRoute allowedRoles={['STUDENT']}>
              <StudentTranscriptPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/student/fees"
          element={
            <ProtectedRoute allowedRoles={['STUDENT']}>
              <StudentFeesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/student/notices"
          element={
            <ProtectedRoute allowedRoles={['STUDENT']}>
              <StudentNoticesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/student/*"
          element={
            <ProtectedRoute allowedRoles={['STUDENT']}>
              <StudentDashboard />
            </ProtectedRoute>
          }
        />

        {/* Global Profile Route */}
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />

        {/* ── 404 fallback ─────────────────────────────────────────────── */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
    </ToastProvider>
  );
}
