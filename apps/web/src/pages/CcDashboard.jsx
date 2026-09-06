import { useState } from 'react';
import { DashboardShell } from '../components/DashboardShell';
import { UsersTable } from '../components/users/UsersTable';
import { CreateStudentModal } from '../components/users/CreateStudentModal';
import { useListStudentsQuery } from '../api/usersApi';
import styles from './CcDashboard.module.css';

const studentColumns = [
  { key: 'name', header: 'Name' },
  { key: 'email', header: 'Email' }
];

export default function CcDashboard() {
  const { data: studentsData, isLoading } = useListStudentsQuery();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <DashboardShell title="Student Roster" subtitle="Class management" icon="👥">
      <div className={styles.dashboard} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-6)' }}>
        <UsersTable
          title="Students in your Section"
          data={studentsData?.data}
          columns={studentColumns}
          isLoading={isLoading}
          onCreate={() => setModalOpen(true)}
          createLabel="Onboard Student"
        />

        <CreateStudentModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
      </div>
    </DashboardShell>
  );
}
