import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useAuth } from './hooks/useAuth';
import { ToastProvider } from './components/ui/ToastContext';
import { TenantProvider } from './context/TenantContext';
import { isRootDomain, getUserRoleDashboard } from './utils/domain';

import { lazy, Suspense } from 'react';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const StudentRegisterPage = lazy(() => import('./pages/StudentRegisterPage'));
const SuperadminSignupPage = lazy(() => import('./pages/SuperadminSignupPage'));
const SuperAdminDashboard = lazy(() => import('./pages/SuperAdminDashboard'));
const SuperAdminManagement = lazy(() => import('./pages/SuperAdminManagement'));
const InstitutionSettings = lazy(() => import('./pages/InstitutionSettings'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AdminDepartments = lazy(() => import('./pages/AdminDepartments'));
const AdminHodManagement = lazy(() => import('./pages/AdminHodManagement'));
const AdminReports = lazy(() => import('./pages/AdminReports'));
const AdminFeePolicy = lazy(() => import('./pages/AdminFeePolicy'));
const AdminNotices = lazy(() => import('./pages/AdminNotices'));
const AdminRoleManagement = lazy(() => import('./pages/AdminRoleManagement'));
const AdminOperations = lazy(() => import('./pages/AdminOperations'));
const FacultyDashboard = lazy(() => import('./pages/FacultyDashboard'));
const StudentDashboard = lazy(() => import('./pages/StudentDashboard'));
const HodDashboard = lazy(() => import('./pages/HodDashboard'));
const HodManagement = lazy(() => import('./pages/HodManagement'));
const HodAcademicStructure = lazy(() => import('./pages/HodAcademicStructure'));
const HodTeachingAssignments = lazy(() => import('./pages/HodTeachingAssignments'));
const HodEscalatedDisputesPage = lazy(() => import('./pages/HodEscalatedDisputesPage'));
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
 * Root redirect — send "/" to the correct role dashboard based on the user's role.
 */
function RootRedirect() {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Navigate to={getUserRoleDashboard(user)} replace />;
}

function TenantRootRedirect() {
  const { slug } = useParams();
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Navigate to={`/inst/${slug}/login`} replace />;
  return <Navigate to={getUserRoleDashboard(user, slug)} replace />;
}

function AppLoadingFallback() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--color-bg)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '50%', border: '3px solid var(--color-border)', borderTopColor: 'var(--color-primary)', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ marginTop: '1rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>Loading component...</p>
      </div>
    </div>
  );
}

export default function App() {
  const onRootDomain = isRootDomain();

  return (
    <ToastProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <GlobalSearch />
        <Suspense fallback={<AppLoadingFallback />}>
          <Routes>
            {/* ── Public ──────────────────────────────────────────────────── */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/hod/login" element={<LoginPage isHodMode={true} />} />
            <Route path="/hod-login" element={<LoginPage isHodMode={true} />} />
            <Route path="/register" element={<StudentRegisterPage />} />
            <Route path="/unauthorized" element={<UnauthorizedPage />} />

            {/* ── SuperAdmin (Root Domain Only) ───────────────────────────── */}
            {onRootDomain && (
              <>
                <Route path="/superadmin/login" element={<LoginPage isSuperAdminMode={true} />} />
                <Route path="/superadmin/signup" element={<SuperadminSignupPage />} />
                <Route path="/superadmin" element={<Navigate to="/superadmin/dashboard" replace />} />
                <Route
                  path="/superadmin/dashboard"
                  element={
                    <ProtectedRoute allowedRoles={['SUPERADMIN']}>
                      <SuperAdminDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/superadmin/institutions"
                  element={
                    <ProtectedRoute allowedRoles={['SUPERADMIN']}>
                      <SuperAdminManagement />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/superadmin/institutions/:id"
                  element={
                    <ProtectedRoute allowedRoles={['SUPERADMIN']}>
                      <InstitutionSettings />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/superadmin/settings"
                  element={
                    <ProtectedRoute allowedRoles={['SUPERADMIN']}>
                      <InstitutionSettings />
                    </ProtectedRoute>
                  }
                />
              </>
            )}

            {/* ── Whitelabeled Tenant Portals (/inst/:slug/*) ──────────────── */}
            <Route path="/inst/:slug" element={<TenantProvider><TenantRootRedirect /></TenantProvider>} />
            <Route path="/inst/:slug/login" element={<TenantProvider><LoginPage /></TenantProvider>} />
            <Route path="/inst/:slug/hod/login" element={<TenantProvider><LoginPage isHodMode={true} /></TenantProvider>} />
            <Route path="/inst/:slug/hod-login" element={<TenantProvider><LoginPage isHodMode={true} /></TenantProvider>} />
            <Route path="/inst/:slug/register" element={<TenantProvider><StudentRegisterPage /></TenantProvider>} />

            {/* Tenant Admin */}
            <Route path="/inst/:slug/admin" element={<Navigate to="dashboard" replace />} />
            <Route path="/inst/:slug/admin/dashboard" element={<TenantProvider><ProtectedRoute allowedRoles={['ADMIN', 'SUPERADMIN']}><AdminDashboard /></ProtectedRoute></TenantProvider>} />
            <Route path="/inst/:slug/admin/hods" element={<TenantProvider><ProtectedRoute allowedRoles={['ADMIN', 'SUPERADMIN']}><AdminHodManagement /></ProtectedRoute></TenantProvider>} />
            <Route path="/inst/:slug/admin/departments" element={<TenantProvider><ProtectedRoute allowedRoles={['ADMIN', 'SUPERADMIN']}><AdminDepartments /></ProtectedRoute></TenantProvider>} />
            <Route path="/inst/:slug/admin/reports" element={<TenantProvider><ProtectedRoute allowedRoles={['ADMIN', 'SUPERADMIN', 'HOD']}><AdminReports /></ProtectedRoute></TenantProvider>} />
            <Route path="/inst/:slug/admin/fee-policy" element={<TenantProvider><ProtectedRoute allowedRoles={['ADMIN', 'SUPERADMIN']}><AdminFeePolicy /></ProtectedRoute></TenantProvider>} />
            <Route path="/inst/:slug/admin/notices" element={<TenantProvider><ProtectedRoute allowedRoles={['ADMIN', 'SUPERADMIN']}><AdminNotices /></ProtectedRoute></TenantProvider>} />
            <Route path="/inst/:slug/admin/roles" element={<TenantProvider><ProtectedRoute allowedRoles={['ADMIN', 'SUPERADMIN']}><AdminRoleManagement /></ProtectedRoute></TenantProvider>} />
            <Route path="/inst/:slug/admin/operations" element={<TenantProvider><ProtectedRoute allowedRoles={['ADMIN', 'SUPERADMIN']}><AdminOperations /></ProtectedRoute></TenantProvider>} />
            <Route path="/inst/:slug/admin/settings" element={<TenantProvider><ProtectedRoute allowedRoles={['ADMIN', 'SUPERADMIN']}><InstitutionSettings /></ProtectedRoute></TenantProvider>} />

            {/* Tenant HOD */}
            <Route path="/inst/:slug/hod" element={<Navigate to="dashboard" replace />} />
            <Route path="/inst/:slug/hod/dashboard" element={<TenantProvider><ProtectedRoute allowedRoles={['HOD', 'ADMIN', 'SUPERADMIN']}><HodDashboard /></ProtectedRoute></TenantProvider>} />
            <Route path="/inst/:slug/hod/management" element={<TenantProvider><ProtectedRoute allowedRoles={['HOD', 'ADMIN', 'SUPERADMIN']}><HodManagement /></ProtectedRoute></TenantProvider>} />
            <Route path="/inst/:slug/hod/faculty" element={<TenantProvider><ProtectedRoute allowedRoles={['HOD', 'ADMIN', 'SUPERADMIN']}><HodManagement /></ProtectedRoute></TenantProvider>} />
            <Route path="/inst/:slug/hod/academic-structure" element={<TenantProvider><ProtectedRoute allowedRoles={['HOD', 'ADMIN', 'SUPERADMIN']}><HodAcademicStructure /></ProtectedRoute></TenantProvider>} />
            <Route path="/inst/:slug/hod/assignments" element={<TenantProvider><ProtectedRoute allowedRoles={['HOD', 'ADMIN', 'SUPERADMIN']}><HodTeachingAssignments /></ProtectedRoute></TenantProvider>} />
            <Route path="/inst/:slug/hod/disputes" element={<TenantProvider><ProtectedRoute allowedRoles={['HOD', 'ADMIN', 'SUPERADMIN']}><HodEscalatedDisputesPage /></ProtectedRoute></TenantProvider>} />
            <Route path="/inst/:slug/hod/reports" element={<TenantProvider><ProtectedRoute allowedRoles={['HOD', 'ADMIN', 'SUPERADMIN']}><AdminReports /></ProtectedRoute></TenantProvider>} />

            {/* Tenant CC */}
            <Route path="/inst/:slug/cc" element={<Navigate to="dashboard" replace />} />
            <Route path="/inst/:slug/cc/dashboard" element={<TenantProvider><ProtectedRoute allowedRoles={['CC', 'HOD', 'ADMIN', 'SUPERADMIN']}><CcDashboard /></ProtectedRoute></TenantProvider>} />
            <Route path="/inst/:slug/cc/workspace" element={<TenantProvider><ProtectedRoute allowedRoles={['CC', 'HOD', 'ADMIN', 'SUPERADMIN']}><CcWorkspace /></ProtectedRoute></TenantProvider>} />
            <Route path="/inst/:slug/cc/roster" element={<TenantProvider><ProtectedRoute allowedRoles={['CC', 'HOD', 'ADMIN', 'SUPERADMIN']}><CcDashboard /></ProtectedRoute></TenantProvider>} />

            {/* Tenant Faculty */}
            <Route path="/inst/:slug/faculty" element={<Navigate to="dashboard" replace />} />
            <Route path="/inst/:slug/faculty/dashboard" element={<TenantProvider><ProtectedRoute allowedRoles={['FACULTY', 'HOD', 'ADMIN', 'SUPERADMIN']}><FacultyDashboard /></ProtectedRoute></TenantProvider>} />
            <Route path="/inst/:slug/faculty/notes" element={<TenantProvider><ProtectedRoute allowedRoles={['FACULTY', 'HOD', 'ADMIN', 'SUPERADMIN']}><FacultyNotesPage /></ProtectedRoute></TenantProvider>} />
            <Route path="/inst/:slug/faculty/marks-entry" element={<TenantProvider><ProtectedRoute allowedRoles={['FACULTY', 'HOD', 'ADMIN', 'SUPERADMIN']}><FacultyMarksEntryPage /></ProtectedRoute></TenantProvider>} />
            <Route path="/inst/:slug/faculty/analytics" element={<TenantProvider><ProtectedRoute allowedRoles={['FACULTY', 'HOD', 'ADMIN', 'SUPERADMIN']}><FacultySubjectAnalyticsPage /></ProtectedRoute></TenantProvider>} />
            <Route path="/inst/:slug/faculty/attendance/session/:sessionId" element={<TenantProvider><ProtectedRoute allowedRoles={['FACULTY', 'HOD', 'ADMIN', 'SUPERADMIN']}><LiveAttendanceSession /></ProtectedRoute></TenantProvider>} />

            {/* Tenant Student */}
            <Route path="/inst/:slug/student" element={<Navigate to="dashboard" replace />} />
            <Route path="/inst/:slug/student/dashboard" element={<TenantProvider><ProtectedRoute allowedRoles={['STUDENT']}><StudentDashboard /></ProtectedRoute></TenantProvider>} />
            <Route path="/inst/:slug/student/attendance" element={<TenantProvider><ProtectedRoute allowedRoles={['STUDENT']}><StudentAttendancePage /></ProtectedRoute></TenantProvider>} />
            <Route path="/inst/:slug/student/transcript" element={<TenantProvider><ProtectedRoute allowedRoles={['STUDENT']}><StudentTranscriptPage /></ProtectedRoute></TenantProvider>} />
            <Route path="/inst/:slug/student/results" element={<Navigate to="transcript" replace />} />
            <Route path="/inst/:slug/student/fees" element={<TenantProvider><ProtectedRoute allowedRoles={['STUDENT']}><StudentFeesPage /></ProtectedRoute></TenantProvider>} />
            <Route path="/inst/:slug/student/notices" element={<TenantProvider><ProtectedRoute allowedRoles={['STUDENT']}><StudentNoticesPage /></ProtectedRoute></TenantProvider>} />

            {/* Tenant Shared */}
            <Route path="/inst/:slug/profile" element={<TenantProvider><ProtectedRoute><ProfilePage /></ProtectedRoute></TenantProvider>} />

            {/* ── Root redirect ────────────────────────────────────────────── */}
            <Route path="/" element={<RootRedirect />} />

            {/* ── Admin (/admin/*) ─────────────────────────────────────────── */}
            <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="/admin/dashboard" element={<ProtectedRoute allowedRoles={['ADMIN', 'SUPERADMIN']}><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/hods" element={<ProtectedRoute allowedRoles={['ADMIN', 'SUPERADMIN']}><AdminHodManagement /></ProtectedRoute>} />
            <Route path="/admin/departments" element={<ProtectedRoute allowedRoles={['ADMIN', 'SUPERADMIN']}><AdminDepartments /></ProtectedRoute>} />
            <Route path="/admin/reports" element={<ProtectedRoute allowedRoles={['ADMIN', 'HOD', 'SUPERADMIN']}><AdminReports /></ProtectedRoute>} />
            <Route path="/admin/fee-policy" element={<ProtectedRoute allowedRoles={['ADMIN', 'SUPERADMIN']}><AdminFeePolicy /></ProtectedRoute>} />
            <Route path="/admin/notices" element={<ProtectedRoute allowedRoles={['ADMIN', 'SUPERADMIN']}><AdminNotices /></ProtectedRoute>} />
            <Route path="/admin/roles" element={<ProtectedRoute allowedRoles={['ADMIN', 'SUPERADMIN']}><AdminRoleManagement /></ProtectedRoute>} />
            <Route path="/admin/operations" element={<ProtectedRoute allowedRoles={['ADMIN', 'SUPERADMIN']}><AdminOperations /></ProtectedRoute>} />
            <Route path="/admin/settings" element={<ProtectedRoute allowedRoles={['ADMIN', 'SUPERADMIN']}><InstitutionSettings /></ProtectedRoute>} />

            {/* ── HOD (/hod/*) ─────────────────────────────────────────────── */}
            <Route path="/hod" element={<Navigate to="/hod/dashboard" replace />} />
            <Route path="/hod/dashboard" element={<ProtectedRoute allowedRoles={['HOD', 'ADMIN', 'SUPERADMIN']}><HodDashboard /></ProtectedRoute>} />
            <Route path="/hod/management" element={<ProtectedRoute allowedRoles={['HOD', 'ADMIN', 'SUPERADMIN']}><HodManagement /></ProtectedRoute>} />
            <Route path="/hod/faculty" element={<ProtectedRoute allowedRoles={['HOD', 'ADMIN', 'SUPERADMIN']}><HodManagement /></ProtectedRoute>} />
            <Route path="/hod/academic-structure" element={<ProtectedRoute allowedRoles={['HOD', 'ADMIN', 'SUPERADMIN']}><HodAcademicStructure /></ProtectedRoute>} />
            <Route path="/hod/assignments" element={<ProtectedRoute allowedRoles={['HOD', 'ADMIN', 'SUPERADMIN']}><HodTeachingAssignments /></ProtectedRoute>} />
            <Route path="/hod/disputes" element={<ProtectedRoute allowedRoles={['HOD', 'ADMIN', 'SUPERADMIN']}><HodEscalatedDisputesPage /></ProtectedRoute>} />
            <Route path="/hod/reports" element={<ProtectedRoute allowedRoles={['HOD', 'ADMIN', 'SUPERADMIN']}><AdminReports /></ProtectedRoute>} />

            {/* ── Class Coordinator (/cc/*) ────────────────────────────────── */}
            <Route path="/cc" element={<Navigate to="/cc/dashboard" replace />} />
            <Route path="/cc/dashboard" element={<ProtectedRoute allowedRoles={['CC', 'HOD', 'ADMIN', 'SUPERADMIN']}><CcDashboard /></ProtectedRoute>} />
            <Route path="/cc/workspace" element={<ProtectedRoute allowedRoles={['CC', 'HOD', 'ADMIN', 'SUPERADMIN']}><CcWorkspace /></ProtectedRoute>} />
            <Route path="/cc/roster" element={<ProtectedRoute allowedRoles={['CC', 'HOD', 'ADMIN', 'SUPERADMIN']}><CcDashboard /></ProtectedRoute>} />

            {/* ── Faculty (/faculty/*) ──────────────────────────────────────── */}
            <Route path="/faculty" element={<Navigate to="/faculty/dashboard" replace />} />
            <Route path="/faculty/dashboard" element={<ProtectedRoute allowedRoles={['FACULTY', 'HOD', 'ADMIN', 'SUPERADMIN']}><FacultyDashboard /></ProtectedRoute>} />
            <Route path="/faculty/notes" element={<ProtectedRoute allowedRoles={['FACULTY', 'HOD', 'ADMIN', 'SUPERADMIN']}><FacultyNotesPage /></ProtectedRoute>} />
            <Route path="/faculty/marks-entry" element={<ProtectedRoute allowedRoles={['FACULTY', 'HOD', 'ADMIN', 'SUPERADMIN']}><FacultyMarksEntryPage /></ProtectedRoute>} />
            <Route path="/faculty/analytics" element={<ProtectedRoute allowedRoles={['FACULTY', 'HOD', 'ADMIN', 'SUPERADMIN']}><FacultySubjectAnalyticsPage /></ProtectedRoute>} />
            <Route path="/faculty/attendance/session/:sessionId" element={<ProtectedRoute allowedRoles={['FACULTY', 'HOD', 'ADMIN', 'SUPERADMIN']}><LiveAttendanceSession /></ProtectedRoute>} />

            {/* ── Student (/student/*) ──────────────────────────────────────── */}
            <Route path="/student" element={<Navigate to="/student/dashboard" replace />} />
            <Route path="/student/dashboard" element={<ProtectedRoute allowedRoles={['STUDENT']}><StudentDashboard /></ProtectedRoute>} />
            <Route path="/student/attendance" element={<ProtectedRoute allowedRoles={['STUDENT']}><StudentAttendancePage /></ProtectedRoute>} />
            <Route path="/student/transcript" element={<ProtectedRoute allowedRoles={['STUDENT']}><StudentTranscriptPage /></ProtectedRoute>} />
            <Route path="/student/results" element={<Navigate to="/student/transcript" replace />} />
            <Route path="/student/fees" element={<ProtectedRoute allowedRoles={['STUDENT']}><StudentFeesPage /></ProtectedRoute>} />
            <Route path="/student/notices" element={<ProtectedRoute allowedRoles={['STUDENT']}><StudentNoticesPage /></ProtectedRoute>} />

            {/* ── Shared Authenticated ─────────────────────────────────────── */}
            <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />

            {/* ── Backward Compatibility Redirects for Legacy Flat Paths ───── */}
            <Route path="/dashboard" element={<Navigate to="/" replace />} />
            <Route path="/hods" element={<Navigate to="/admin/hods" replace />} />
            <Route path="/reports" element={<Navigate to="/admin/reports" replace />} />
            <Route path="/fee-policy" element={<Navigate to="/admin/fee-policy" replace />} />
            <Route path="/notices" element={<Navigate to="/admin/notices" replace />} />
            <Route path="/roles" element={<Navigate to="/admin/roles" replace />} />
            <Route path="/operations" element={<Navigate to="/admin/operations" replace />} />
            <Route path="/assignments" element={<Navigate to="/hod/assignments" replace />} />
            <Route path="/marks-entry" element={<Navigate to="/faculty/marks-entry" replace />} />
            <Route path="/attendance" element={<Navigate to="/student/attendance" replace />} />
            <Route path="/fees" element={<Navigate to="/student/fees" replace />} />
            <Route path="/results" element={<Navigate to="/student/transcript" replace />} />
            <Route path="/settings" element={<Navigate to="/superadmin/institutions" replace />} />
            <Route path="/admin/management" element={<Navigate to="/superadmin/institutions" replace />} />

            {/* ── 404 fallback ─────────────────────────────────────────────── */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ToastProvider>
  );
}
