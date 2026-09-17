import { DashboardShell } from '../components/DashboardShell';
import { StatCard } from '../components/ui/StatCard';
import { AnimatedTabs } from '../components/ui/AnimatedTabs';
import { StaggerList, StaggerItem } from '../components/ui/StaggerList';
import { FacultyTab } from '../components/hod/FacultyTab';
import { SubjectsTab } from '../components/hod/SubjectsTab';
import { SectionsTab } from '../components/hod/SectionsTab';
import { NoticesTab } from '../components/hod/NoticesTab';
import { HodAnalyticsTab } from '../components/hod/HodAnalyticsTab';
import { EscalatedDisputesTab } from '../components/hod/EscalatedDisputesTab';
import { useGetHodDashboardStatsQuery } from '../api/reportsApi';
import { PageTransition } from '../components/ui/PageTransition';
import styles from './HodDashboard.module.css';

export default function HodDashboard() {
  const { data: statsData, isLoading: isLoadingStats } = useGetHodDashboardStatsQuery();
  const stats = statsData?.data || {};

  const tabs = [
    { id: 'faculty', label: 'Faculty', content: <FacultyTab /> },
    { id: 'subjects', label: 'Subjects', content: <SubjectsTab /> },
    { id: 'sections', label: 'Sections', content: <SectionsTab /> },
    { id: 'disputes', label: 'Escalated Disputes', content: <EscalatedDisputesTab /> },
    { id: 'notices', label: 'Notices', content: <NoticesTab /> },
    { id: 'analytics', label: 'Analytics', content: <HodAnalyticsTab /> }
  ];

  return (
    <DashboardShell title="HOD Dashboard" subtitle="Department management" icon="🏛️">
      <PageTransition>
      <div className={styles.dashboard}>
        <StaggerList className={styles.statsGrid}>
          <StaggerItem>
            <StatCard 
              title="Faculty Count" 
              value={stats.facultyCount || 0} 
              icon="Users" 
              isLoading={isLoadingStats} 
              trend={+2}
            />
          </StaggerItem>
          <StaggerItem>
            <StatCard 
              title="Students in Dept" 
              value={stats.studentCount || 0} 
              icon="UserCheck" 
              isLoading={isLoadingStats} 
            />
          </StaggerItem>
          <StaggerItem>
            <StatCard 
              title="Avg Attendance" 
              value={`${stats.avgAttendance || 0}%`} 
              icon="CheckSquare" 
              isLoading={isLoadingStats} 
            />
          </StaggerItem>
          <StaggerItem>
            <StatCard 
              title="Avg Marks" 
              value={`${stats.avgMarks || 0}%`} 
              icon="Award" 
              isLoading={isLoadingStats} 
            />
          </StaggerItem>
        </StaggerList>

        <div className={styles.tabsSection}>
          <AnimatedTabs tabs={tabs} defaultTabId="faculty" />
        </div>
      </div>
      </PageTransition>
    </DashboardShell>
  );
}
