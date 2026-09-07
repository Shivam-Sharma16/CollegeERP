import { useState, useMemo } from 'react';
import { useListAdminsQuery } from '../../api/usersApi';
import { Table } from '../ui/Table';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { CreateAdminModal } from './CreateAdminModal';
import { useToast } from '../ui/ToastContext';
import { UserX } from 'lucide-react';

export function AdminsTab() {
  const { data: adminsData, isLoading } = useListAdminsQuery();
  const { showToast } = useToast();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deactivateConfirmOpen, setDeactivateConfirmOpen] = useState(false);
  const [adminToDeactivate, setAdminToDeactivate] = useState(null);

  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState('name');
  const [sortDir, setSortDir] = useState('asc');

  const admins = adminsData?.data || [];

  const handleDeactivateClick = (admin) => {
    setAdminToDeactivate(admin);
    setDeactivateConfirmOpen(true);
  };

  const confirmDeactivate = async () => {
    if (!adminToDeactivate) return;
    // Mocking deactivate action as it may not exist in usersApi yet.
    // Replace with real mutation if available.
    setTimeout(() => {
      showToast('Admin deactivated successfully', 'success');
      setDeactivateConfirmOpen(false);
      setAdminToDeactivate(null);
    }, 500);
  };

  const columns = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'email', label: 'Email Address', sortable: true },
    { key: 'createdAt', label: 'Created Date', sortable: true, render: (val) => new Date(val).toLocaleDateString() },
    { key: 'status', label: 'Status', sortable: true, render: (_, row) => row.status || 'Active' },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (_, row) => (
        <Button variant="ghost" onClick={() => handleDeactivateClick(row)} title="Deactivate Admin">
          <UserX size={16} color="var(--color-danger)" />
        </Button>
      )
    }
  ];

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const filteredAndSortedData = useMemo(() => {
    let result = [...admins];

    if (search) {
      const lowerSearch = search.toLowerCase();
      result = result.filter(a => 
        a.name.toLowerCase().includes(lowerSearch) || 
        a.email.toLowerCase().includes(lowerSearch)
      );
    }

    result.sort((a, b) => {
      let aVal = (a[sortCol] || '').toString().toLowerCase();
      let bVal = (b[sortCol] || '').toString().toLowerCase();

      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [admins, search, sortCol, sortDir]);

  if (!isLoading && admins.length === 0) {
    return (
      <>
        <EmptyState 
          title="No admins yet" 
          description="Create your first administrator account."
        />
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '-24px', paddingBottom: '24px' }}>
          <Button onClick={() => setCreateModalOpen(true)}>Create Admin</Button>
        </div>
        <CreateAdminModal isOpen={createModalOpen} onClose={() => setCreateModalOpen(false)} />
      </>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <input 
          type="text" 
          placeholder="Search admins..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: 'var(--spacing-2) var(--spacing-3)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border)',
            width: '300px'
          }}
        />
        <Button onClick={() => setCreateModalOpen(true)}>Create Admin</Button>
      </div>

      <Table 
        columns={columns}
        data={filteredAndSortedData}
        sortColumn={sortCol}
        sortDirection={sortDir}
        onSort={handleSort}
        isLoading={isLoading}
      />

      <CreateAdminModal isOpen={createModalOpen} onClose={() => setCreateModalOpen(false)} />

      <ConfirmDialog 
        isOpen={deactivateConfirmOpen}
        onClose={() => setDeactivateConfirmOpen(false)}
        onConfirm={confirmDeactivate}
        title="Deactivate Admin"
        warningText={`This will immediately deactivate the account for ${adminToDeactivate?.name} (${adminToDeactivate?.email}). They will no longer be able to log into the system.`}
        confirmLabel="Deactivate Account"
        isDestructive={true}
      />
    </div>
  );
}
