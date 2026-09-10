import { DashboardShell } from '../components/DashboardShell';
import { AnimatedTabs } from '../components/ui/AnimatedTabs';
import { PageTransition } from '../components/ui/PageTransition';
import { FacultyManagementTab } from '../components/hod/FacultyManagementTab';
import { CcManagementTab } from '../components/hod/CcManagementTab';
import styles from './HodManagement.module.css';

export default function HodManagement() {
  const tabs = [
    { id: 'faculty', label: 'Faculty', content: <FacultyManagementTab /> },
    { id: 'ccs', label: 'Class Coordinators', content: <CcManagementTab /> }
  ];

  return (
    <DashboardShell title="Staff Management" subtitle="Manage department Faculty and Class Coordinators" icon="Users">
      <PageTransition>
        <div className={styles.container}>
          <AnimatedTabs tabs={tabs} defaultTabId="faculty" />
        </div>
      </PageTransition>
    </DashboardShell>
  );
}
