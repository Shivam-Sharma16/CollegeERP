import { useState, useMemo } from 'react';
import { DashboardShell } from '../components/DashboardShell';
import { UsersTable } from '../components/users/UsersTable';
import { CreateHodModal } from '../components/users/CreateHodModal';
import { useListHodsQuery } from '../api/usersApi';
import { useGetDashboardStatsQuery } from '../api/reportsApi';
import { useGetRecentActivityQuery } from '../api/auditApi';
import { useResolveDeptTreeQuery } from '../api/departmentsApi';
import { 
  useGetCollectionSummaryQuery, 
  useGetDefaultersQuery 
} from '../api/feesApi';
import { useGetInstitutionAttendanceQuery } from '../api/attendanceApi';
import { useListMyNoticesQuery } from '../api/noticeApi';

import { useAuth } from '../hooks/useAuth';
import { StatCard } from '../components/ui/StatCard';
import { StatCardWithTrend } from '../components/dashboard/StatCardWithTrend';
import { DepartmentComparisonChart } from '../components/dashboard/DepartmentComparisonChart';
import { Accordion } from '../components/ui/Accordion';
import { Timeline } from '../components/ui/Timeline';
import { EmptyState } from '../components/ui/EmptyState';
import { StaggerList, StaggerItem } from '../components/ui/StaggerList';
import { FadeIn } from '../components/ui/FadeIn';
import { Skeleton } from '../components/ui/Skeleton';
import { DepartmentTree } from '../components/departments/DepartmentTree';
import { DollarSign, Percent, AlertTriangle, Bell } from 'lucide-react';
import { PageTransition } from '../components/ui/PageTransition';
import styles from './AdminDashboard.module.css';

const hodColumns = [
  { key: 'name', header: 'Name' },
  { key: 'email', header: 'Email' },
  { key: 'department', header: 'Department', render: (val, row) => row.departmentId?.name || 'N/A' }
];

export default function AdminDashboard() {
  const { user } = useAuth();
  const isSuperAdmin = user?.roles?.includes('SUPERADMIN');
  const isAdmin = user?.roles?.includes('ADMIN') && !isSuperAdmin;

  // Existing Users Data
  const { data: hodsData, isLoading: isLoadingHods } = useListHodsQuery();

  // SuperAdmin Data
  const { data: statsData, isLoading: isLoadingStats } = useGetDashboardStatsQuery(undefined, { skip: !isSuperAdmin });
  const { data: auditData, isLoading: isLoadingAudit } = useGetRecentActivityQuery(undefined, { skip: !isSuperAdmin });
  const { data: treeData, isLoading: isLoadingTree } = useResolveDeptTreeQuery(undefined, { skip: !isSuperAdmin });

  // Admin Data (isolated queries)
  const { data: feesData, isLoading: isFeesLoading, isError: isFeesError, refetch: refetchFees } = useGetCollectionSummaryQuery(undefined, { skip: !isAdmin });
  const { data: attData, isLoading: isAttLoading, isError: isAttError, refetch: refetchAtt } = useGetInstitutionAttendanceQuery(undefined, { skip: !isAdmin });
  const { data: defData, isLoading: isDefLoading, isError: isDefError, refetch: refetchDef } = useGetDefaultersQuery(undefined, { skip: !isAdmin });
  const { data: noticesData, isLoading: isNoticesLoading, isError: isNoticesError, refetch: refetchNotices } = useListMyNoticesQuery(undefined, { skip: !isAdmin });

  const [hodModalOpen, setHodModalOpen] = useState(false);

  const stats = statsData?.data || {};
  const departments = treeData?.data?.departments || [];
  const auditLogs = auditData?.data || [];

  // Parse Admin Data
  const feesSummary = feesData?.data || { total: 0, trend: [] };
  const attSummary = attData?.data || { percentage: 0, trend: [] };
  const defaultersCount = defData?.data?.length || 0;
  const activeNoticesCount = noticesData?.data?.length || 0;

  // Mock department comparison data since backend might not provide it perfectly yet
  const deptChartData = useMemo(() => [
    { name: 'CS', attendance: 85, fees: 92 },
    { name: 'IT', attendance: 88, fees: 89 },
    { name: 'EC', attendance: 78, fees: 85 },
    { name: 'ME', attendance: 82, fees: 75 },
    { name: 'CE', attendance: 75, fees: 80 },
  ], []);

  return (
    <DashboardShell 
      title={isSuperAdmin ? "System Overview" : "Admin Dashboard"} 
      subtitle={isSuperAdmin ? "Global system statistics" : "Institution-wide metrics and reports"} 
      icon={isSuperAdmin ? "⚙️" : "📊"}
    >
      <PageTransition>
      <div className={styles.dashboard}>
        
        {/* ── SUPERADMIN VIEW ────────────────────────────────────── */}
        {isSuperAdmin && (
          <div className={styles.superadminLayout}>
            {/* Main Content Area */}
            <div className={styles.mainContent}>
              <StaggerList className={styles.statsGrid}>
                <StaggerItem><StatCard title="Departments" value={stats.totalDepartments} icon="🏢" isLoading={isLoadingStats} /></StaggerItem>
                <StaggerItem><StatCard title="Total Students" value={stats.totalStudents} icon="👩‍🎓" isLoading={isLoadingStats} /></StaggerItem>
                <StaggerItem><StatCard title="Total Faculty" value={stats.totalFaculty} icon="👨‍🏫" isLoading={isLoadingStats} /></StaggerItem>
                <StaggerItem><StatCard title="Active Sessions" value={stats.activeSessions} icon="🟢" isLoading={isLoadingStats} /></StaggerItem>
              </StaggerList>

              <div className={styles.departmentsSection}>
                <h2 className={styles.sectionTitle}>Departments Hierarchy</h2>
                <FadeIn
                  show={!isLoadingTree}
                  skeleton={<><Skeleton height="48px" style={{ marginBottom: '8px' }} /><Skeleton height="48px" width="90%" style={{ marginBottom: '8px' }} /><Skeleton height="48px" width="80%" /></>}
                >
                  {departments.length === 0 ? (
                    <EmptyState
                      icon="folder"
                      title="No Departments Yet"
                      description="Create your first department to start building the academic structure."
                      actionLabel="Go to Management"
                      actionRoute="/admin/management"
                    />
                  ) : (
                    departments.map(dept => (
                      <Accordion key={dept._id} title={dept.name}>
                        <DepartmentTree department={dept} />
                      </Accordion>
                    ))
                  )}
                </FadeIn>
              </div>
            </div>

            {/* Side Panel Area */}
            <div className={styles.sidePanel}>
              <div className={styles.sidePanelCard}>
                <h2 className={styles.sectionTitle}>Recent Activity</h2>
                <Timeline items={auditLogs} isLoading={isLoadingAudit} />
              </div>
            </div>
          </div>
        )}

        {/* ── ADMIN VIEW ───────────────────────────────────────── */}
        {isAdmin && (
          <div className={styles.adminLayout}>
            {/* Top Stats Grid */}
            <StaggerList className={styles.statsGrid}>
              <StaggerItem>
                <StatCardWithTrend 
                  title="Fees Collected (Month)" 
                  value={`$${feesSummary.total.toLocaleString()}`} 
                  trendData={feesSummary.trend}
                  trendColor="var(--color-success)"
                  icon={DollarSign}
                  isLoading={isFeesLoading}
                  isError={isFeesError}
                  onRetry={refetchFees}
                />
              </StaggerItem>
              <StaggerItem>
                <StatCardWithTrend 
                  title="Attendance (Institution)" 
                  value={`${attSummary.percentage}%`} 
                  trendData={attSummary.trend}
                  trendColor="var(--color-primary)"
                  icon={Percent}
                  isLoading={isAttLoading}
                  isError={isAttError}
                  onRetry={refetchAtt}
                />
              </StaggerItem>
              <StaggerItem>
                <StatCardWithTrend 
                  title="Defaulters" 
                  value={defaultersCount} 
                  trendData={[]} // No trend for defaulters
                  trendColor="var(--color-danger)"
                  icon={AlertTriangle}
                  isLoading={isDefLoading}
                  isError={isDefError}
                  onRetry={refetchDef}
                />
              </StaggerItem>
              <StaggerItem>
                <StatCardWithTrend 
                  title="Active Notices" 
                  value={activeNoticesCount} 
                  trendData={[]} // No trend for notices
                  trendColor="var(--color-warning)"
                  icon={Bell}
                  isLoading={isNoticesLoading}
                  isError={isNoticesError}
                  onRetry={refetchNotices}
                />
              </StaggerItem>
            </StaggerList>

            {/* Bottom 2-Col Layout */}
            <div className={styles.adminTwoCol}>
              <div className={styles.chartCol}>
                <DepartmentComparisonChart data={deptChartData} />
              </div>
              <div className={styles.tableCol}>
                <UsersTable
                  title="Heads of Department (HOD)"
                  data={hodsData?.data}
                  columns={hodColumns}
                  isLoading={isLoadingHods}
                  onCreate={() => setHodModalOpen(true)}
                  createLabel="Create HOD"
                />
              </div>
            </div>
          </div>
        )}

        {/* ── SHARED TABLES (SuperAdmin only sees HODs below their main view) */}
        {isSuperAdmin && (
          <div className={styles.tablesSection}>
            <UsersTable
              title="Heads of Department (HOD)"
              data={hodsData?.data}
              columns={hodColumns}
              isLoading={isLoadingHods}
              onCreate={() => setHodModalOpen(true)}
              createLabel="Create HOD"
            />
          </div>
        )}

        <CreateHodModal isOpen={hodModalOpen} onClose={() => setHodModalOpen(false)} />
      </div>
      </PageTransition>
    </DashboardShell>
  );
}
