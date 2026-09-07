import { DashboardShell } from '../components/DashboardShell';
import { StatCard } from '../components/dashboard/StatCard';
import { AnimatedTabs } from '../components/ui/AnimatedTabs';
import { FacultyTab } from '../components/hod/FacultyTab';
import { SubjectsTab } from '../components/hod/SubjectsTab';
import { SectionsTab } from '../components/hod/SectionsTab';
import { NoticesTab } from '../components/hod/NoticesTab';
import { useGetHodDashboardStatsQuery } from '../api/reportsApi';
import styles from './HodDashboard.module.css';

export default function HodDashboard() {
  const { data: statsData, isLoading: isLoadingStats } = useGetHodDashboardStatsQuery();
  const stats = statsData?.data || {};

  const tabs = [
    { id: 'faculty', label: 'Faculty', content: <FacultyTab /> },
    { id: 'subjects', label: 'Subjects', content: <SubjectsTab /> },
    { id: 'sections', label: 'Sections', content: <SectionsTab /> },
    { id: 'notices', label: 'Notices', content: <NoticesTab /> }
  ];

  return (
    <DashboardShell title="HOD Dashboard" subtitle="Department management" icon="🏛️">
      <div className={styles.dashboard}>
        <div className={styles.statsGrid}>
          <StatCard 
            title="Faculty Count" 
            value={stats.facultyCount || 0} 
            icon="Users" 
            isLoading={isLoadingStats} 
            trend={+2}
          />
          <StatCard 
            title="Students in Dept" 
            value={stats.studentCount || 0} 
            icon="UserCheck" 
            isLoading={isLoadingStats} 
          />
          <StatCard 
            title="Avg Attendance" 
            value={`${stats.avgAttendance || 0}%`} 
            icon="CheckSquare" 
            isLoading={isLoadingStats} 
          />
          <StatCard 
            title="Avg Marks" 
            value={`${stats.avgMarks || 0}%`} 
            icon="Award" 
            isLoading={isLoadingStats} 
          />
        </div>

        <div className={styles.tabsSection}>
          <AnimatedTabs tabs={tabs} defaultTabId="faculty" />
        </div>
      </div>
    </DashboardShell>
  );
}
