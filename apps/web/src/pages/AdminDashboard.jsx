import { useState } from 'react';
import { DashboardShell } from '../components/DashboardShell';
import { UsersTable } from '../components/users/UsersTable';
import { CreateAdminModal } from '../components/users/CreateAdminModal';
import { CreateHodModal } from '../components/users/CreateHodModal';
import { useListAdminsQuery, useListHodsQuery } from '../api/usersApi';
import { useAuth } from '../hooks/useAuth';
import styles from './AdminDashboard.module.css';

const adminColumns = [
  { key: 'name', header: 'Name' },
  { key: 'email', header: 'Email' }
];

const hodColumns = [
  { key: 'name', header: 'Name' },
  { key: 'email', header: 'Email' },
  { key: 'department', header: 'Department', render: (val, row) => row.departmentId?.name || 'N/A' }
];

export default function AdminDashboard() {
  const { user } = useAuth();
  const isSuperAdmin = user?.roles?.includes('SUPERADMIN');

  const { data: adminsData, isLoading: isLoadingAdmins } = useListAdminsQuery(undefined, { skip: !isSuperAdmin });
  const { data: hodsData, isLoading: isLoadingHods } = useListHodsQuery();

  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [hodModalOpen, setHodModalOpen] = useState(false);

  return (
    <DashboardShell title="Admin Dashboard" subtitle="System-wide management" icon="⚙️">
      <div className={styles.dashboard} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-6)' }}>
        {isSuperAdmin && (
          <UsersTable
            title="Administrators"
            data={adminsData?.data}
            columns={adminColumns}
            isLoading={isLoadingAdmins}
            onCreate={() => setAdminModalOpen(true)}
            createLabel="Create Admin"
          />
        )}

        <UsersTable
          title="Heads of Department (HOD)"
          data={hodsData?.data}
          columns={hodColumns}
          isLoading={isLoadingHods}
          onCreate={() => setHodModalOpen(true)}
          createLabel="Create HOD"
        />

        {isSuperAdmin && (
          <CreateAdminModal isOpen={adminModalOpen} onClose={() => setAdminModalOpen(false)} />
        )}
        <CreateHodModal isOpen={hodModalOpen} onClose={() => setHodModalOpen(false)} />
      </div>
    </DashboardShell>
  );
}
