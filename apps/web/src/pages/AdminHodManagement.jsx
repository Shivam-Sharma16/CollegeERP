import { useState, useMemo } from 'react';
import { DashboardShell } from '../components/DashboardShell';
import { Table } from '../components/ui/Table';
import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { CreateHodModal } from '../components/users/CreateHodModal';
import { EmptyState } from '../components/ui/EmptyState';
import { FadeIn } from '../components/ui/FadeIn';
import { Skeleton } from '../components/ui/Skeleton';
import { useListHodsQuery } from '../api/usersApi';
import { useToast } from '../components/ui/ToastContext';
import { UserX, Eye } from 'lucide-react';
import { PageTransition } from '../components/ui/PageTransition';
import styles from './AdminHodManagement.module.css';

export default function AdminHodManagement() {
  const { data: hodsData, isLoading } = useListHodsQuery();
  const { showToast } = useToast();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deactivateConfirmOpen, setDeactivateConfirmOpen] = useState(false);
  const [hodToDeactivate, setHodToDeactivate] = useState(null);

  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState('name');
  const [sortDir, setSortDir] = useState('asc');

  const hods = hodsData?.data || [];

  const handleDeactivateClick = (hod) => {
    setHodToDeactivate(hod);
    setDeactivateConfirmOpen(true);
  };

  const confirmDeactivate = async () => {
    if (!hodToDeactivate) return;
    // Note: Replace setTimeout with actual useDeactivateHodMutation when available.
    setTimeout(() => {
      showToast(`HOD ${hodToDeactivate.name} deactivated successfully`, 'success');
      setDeactivateConfirmOpen(false);
      setHodToDeactivate(null);
    }, 500);
  };

  const handleViewDepartment = (hod) => {
    // Lightweight toast/alert for "View Department Detail" action
    const deptName = hod.departmentId?.name || 'Unknown Department';
    const deptCode = hod.departmentId?.code || 'N/A';
    showToast(`Department Details: ${deptName} (${deptCode})`, 'info');
  };

  const columns = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'department', label: 'Department Name', sortable: true, render: (_, row) => row.departmentId?.name || 'N/A' },
    // We assume backend returns facultyCount; if not, we default to 0
    { key: 'facultyCount', label: 'Faculty Count', sortable: true, render: (_, row) => row.facultyCount || 0 },
    { key: 'createdAt', label: 'Created Date', sortable: true, render: (val) => new Date(val).toLocaleDateString() },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (_, row) => (
        <div className={styles.actionButtons}>
          <Button variant="ghost" onClick={() => handleViewDepartment(row)} title="View Department Detail">
            <Eye size={16} color="var(--color-primary)" />
          </Button>
          <Button variant="ghost" onClick={() => handleDeactivateClick(row)} title="Deactivate HOD">
            <UserX size={16} color="var(--color-danger)" />
          </Button>
        </div>
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
    let result = [...hods];

    if (search) {
      const lowerSearch = search.toLowerCase();
      result = result.filter(h => 
        h.name.toLowerCase().includes(lowerSearch) || 
        (h.departmentId?.name && h.departmentId.name.toLowerCase().includes(lowerSearch))
      );
    }

    result.sort((a, b) => {
      let aVal = a[sortCol];
      let bVal = b[sortCol];

      if (sortCol === 'department') {
        aVal = a.departmentId?.name || '';
        bVal = b.departmentId?.name || '';
      }

      if (sortCol === 'facultyCount') {
        aVal = aVal || 0;
        bVal = bVal || 0;
      } else {
        aVal = (aVal || '').toString().toLowerCase();
        bVal = (bVal || '').toString().toLowerCase();
      }

      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [hods, search, sortCol, sortDir]);

  return (
    <DashboardShell title="HOD Management" subtitle="Manage Heads of Department" icon="👨‍💼">
      <PageTransition>
      <div className={styles.container}>
        
        <FadeIn
          show={!isLoading}
          skeleton={<Skeleton height="300px" />}
        >
          {(!isLoading && hods.length === 0) ? (
            <>
              <EmptyState 
                icon="users"
                title="No HODs yet" 
                description="Create your first Head of Department to assign them to a department."
              />
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '-24px', paddingBottom: '24px' }}>
                <Button onClick={() => setCreateModalOpen(true)}>Create HOD</Button>
              </div>
            </>
          ) : (
            <div className={styles.card}>
              <div className={styles.toolbar}>
                <input 
                  type="text" 
                  placeholder="Search by name or department..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={styles.searchInput}
                />
                <Button onClick={() => setCreateModalOpen(true)}>Create HOD</Button>
              </div>

              <Table 
                columns={columns}
                data={filteredAndSortedData}
                sortColumn={sortCol}
                sortDirection={sortDir}
                onSort={handleSort}
                isLoading={isLoading}
                emptyIcon="users"
              />
            </div>
          )}
        </FadeIn>

        <CreateHodModal isOpen={createModalOpen} onClose={() => setCreateModalOpen(false)} />

        <ConfirmDialog 
          isOpen={deactivateConfirmOpen}
          onClose={() => setDeactivateConfirmOpen(false)}
          onConfirm={confirmDeactivate}
          title="Deactivate HOD"
          warningText={`This will immediately deactivate the account for ${hodToDeactivate?.name}. They will lose access to the system. Are you sure?`}
          confirmLabel="Deactivate Account"
          isDestructive={true}
        />
      </div>
      </PageTransition>
    </DashboardShell>
  );
}
