import { DashboardShell } from '../components/DashboardShell';
import { Tabs } from '../components/ui/Tabs';
import { DepartmentsTab } from '../components/departments/DepartmentsTab';
import { AdminsTab } from '../components/users/AdminsTab';
import styles from './SuperAdminManagement.module.css';

export default function SuperAdminManagement() {
  const tabs = [
    {
      id: 'departments',
      label: 'Departments',
      content: <DepartmentsTab />
    },
    {
      id: 'admins',
      label: 'Administrators',
      content: <AdminsTab />
    }
  ];

  return (
    <DashboardShell 
      title="System Management" 
      subtitle="Manage departments and system administrators" 
      icon="🛡️"
    >
      <div className={styles.container}>
        <div className={styles.card}>
          <Tabs tabs={tabs} defaultTabId="departments" />
        </div>
      </div>
    </DashboardShell>
  );
}
