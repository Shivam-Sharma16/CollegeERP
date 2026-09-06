import { useState } from 'react';
import { DashboardShell } from '../components/DashboardShell';
import { UsersTable } from '../components/users/UsersTable';
import { CreateFacultyModal } from '../components/users/CreateFacultyModal';
import { CreateCcModal } from '../components/users/CreateCcModal';
import { useListFacultyQuery, useListCcQuery } from '../api/usersApi';
import styles from './HodDashboard.module.css';

const facultyColumns = [
  { key: 'name', header: 'Name' },
  { key: 'email', header: 'Email' }
];

const ccColumns = [
  { key: 'name', header: 'Name' },
  { key: 'email', header: 'Email' }
];

export default function HodDashboard() {
  const { data: facultyData, isLoading: isLoadingFaculty } = useListFacultyQuery();
  const { data: ccData, isLoading: isLoadingCc } = useListCcQuery();

  const [facultyModalOpen, setFacultyModalOpen] = useState(false);
  const [ccModalOpen, setCcModalOpen] = useState(false);

  return (
    <DashboardShell title="HOD Dashboard" subtitle="Department management" icon="🏛️">
      <div className={styles.dashboard} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-6)' }}>
        <UsersTable
          title="Faculty Members"
          data={facultyData?.data}
          columns={facultyColumns}
          isLoading={isLoadingFaculty}
          onCreate={() => setFacultyModalOpen(true)}
          createLabel="Create Faculty"
        />

        <UsersTable
          title="Class Coordinators"
          data={ccData?.data}
          columns={ccColumns}
          isLoading={isLoadingCc}
          onCreate={() => setCcModalOpen(true)}
          createLabel="Create CC"
        />

        <CreateFacultyModal isOpen={facultyModalOpen} onClose={() => setFacultyModalOpen(false)} />
        <CreateCcModal isOpen={ccModalOpen} onClose={() => setCcModalOpen(false)} />
      </div>
    </DashboardShell>
  );
}
