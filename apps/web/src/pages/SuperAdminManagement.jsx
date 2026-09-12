import { DashboardShell } from '../components/DashboardShell';
import { Tabs } from '../components/ui/Tabs';
import { PageTransition } from '../components/ui/PageTransition';
import { InstitutionsTab } from '../components/institutions/InstitutionsTab';
import { DepartmentsTab } from '../components/departments/DepartmentsTab';
import { AdminsTab } from '../components/users/AdminsTab';
import styles from './SuperAdminManagement.module.css';

export default function SuperAdminManagement() {
  const tabs = [
    {
      id: 'institutions',
      label: 'Institutions',
      content: <InstitutionsTab />
    },
    {
      id: 'admins',
      label: 'Administrators',
      content: <AdminsTab />
    },
    {
      id: 'departments',
      label: 'Departments',
      content: <DepartmentsTab />
    }
  ];

  return (
    <DashboardShell 
      title="Platform Administration" 
      subtitle="Manage multi-tenant college institutions, dedicated admins, and white-labeled portals" 
      icon="🌐"
    >
      <PageTransition>
        <div className={styles.container}>
          <div className={styles.card}>
            <Tabs tabs={tabs} defaultTabId="institutions" />
          </div>
        </div>
      </PageTransition>
    </DashboardShell>
  );
}
