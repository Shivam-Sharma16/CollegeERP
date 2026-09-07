import { useState } from 'react';
import { DashboardShell } from '../components/DashboardShell';
import { UsersTable } from '../components/users/UsersTable';
import { CreateHodModal } from '../components/users/CreateHodModal';
import { useListHodsQuery } from '../api/usersApi';
import { useGetDashboardStatsQuery } from '../api/reportsApi';
import { useGetRecentActivityQuery } from '../api/auditApi';
import { useResolveDeptTreeQuery } from '../api/departmentsApi';
import { useAuth } from '../hooks/useAuth';
import { StatCard } from '../components/ui/StatCard';
import { Accordion } from '../components/ui/Accordion';
import { Timeline } from '../components/ui/Timeline';
import { EmptyState } from '../components/ui/EmptyState';
import { DepartmentTree } from '../components/departments/DepartmentTree';
import styles from './AdminDashboard.module.css';

const hodColumns = [
  { key: 'name', header: 'Name' },
  { key: 'email', header: 'Email' },
  { key: 'department', header: 'Department', render: (val, row) => row.departmentId?.name || 'N/A' }
];

export default function AdminDashboard() {
  const { user } = useAuth();
  const isSuperAdmin = user?.roles?.includes('SUPERADMIN');

  // Existing Users Data
  const { data: hodsData, isLoading: isLoadingHods } = useListHodsQuery();

  // New SuperAdmin Data
  const { data: statsData, isLoading: isLoadingStats } = useGetDashboardStatsQuery(undefined, { skip: !isSuperAdmin });
  const { data: auditData, isLoading: isLoadingAudit } = useGetRecentActivityQuery(undefined, { skip: !isSuperAdmin });
  const { data: treeData, isLoading: isLoadingTree } = useResolveDeptTreeQuery(undefined, { skip: !isSuperAdmin });

  const [hodModalOpen, setHodModalOpen] = useState(false);

  const stats = statsData?.data || {};
  const departments = treeData?.data?.departments || [];
  const auditLogs = auditData?.data || [];

  return (
    <DashboardShell title="Admin Dashboard" subtitle="System-wide overview" icon="⚙️">
      <div className={styles.dashboard}>
        {isSuperAdmin && (
          <div className={styles.superadminLayout}>
            {/* Main Content Area */}
            <div className={styles.mainContent}>
              <div className={styles.statsGrid}>
                <StatCard title="Departments" value={stats.totalDepartments} icon="🏢" isLoading={isLoadingStats} />
                <StatCard title="Total Students" value={stats.totalStudents} icon="👩‍🎓" isLoading={isLoadingStats} />
                <StatCard title="Total Faculty" value={stats.totalFaculty} icon="👨‍🏫" isLoading={isLoadingStats} />
                <StatCard title="Active Sessions" value={stats.activeSessions} icon="🟢" isLoading={isLoadingStats} />
              </div>

              <div className={styles.departmentsSection}>
                <h2 className={styles.sectionTitle}>Departments Hierarchy</h2>
                {isLoadingTree ? (
                  <p className={styles.loadingText}>Loading departments...</p>
                ) : departments.length === 0 ? (
                  <EmptyState 
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

        <CreateHodModal isOpen={hodModalOpen} onClose={() => setHodModalOpen(false)} />
      </div>
    </DashboardShell>
  );
}
