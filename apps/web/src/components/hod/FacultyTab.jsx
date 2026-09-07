import { useState } from 'react';
import { useListFacultyQuery } from '../../api/usersApi';
import { UsersTable } from '../users/UsersTable';
import { CreateFacultyModal } from '../users/CreateFacultyModal';

const columns = [
  { key: 'name', header: 'Name' },
  { key: 'email', header: 'Email' },
  { key: 'createdAt', header: 'Joined', render: (val) => new Date(val).toLocaleDateString() }
];

export function FacultyTab() {
  const { data, isLoading } = useListFacultyQuery();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div>
      <UsersTable
        title="Department Faculty"
        data={data?.data}
        columns={columns}
        isLoading={isLoading}
        onCreate={() => setModalOpen(true)}
        createLabel="Add Faculty"
      />
      <CreateFacultyModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
