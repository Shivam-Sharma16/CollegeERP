import { useState, useMemo } from 'react';
import {
  useListAdminsQuery,
  useUpdateUserMutation,
  useDeleteUserMutation,
} from '../../api/usersApi';
import { Table } from '../ui/Table';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { CreateAdminModal } from './CreateAdminModal';
import { EditAdminModal } from './EditAdminModal';
import { useToast } from '../ui/ToastContext';
import { UserX, UserCheck, Pencil, Trash2, ShieldCheck, Plus, Search } from 'lucide-react';

export function AdminsTab() {
  const { data: adminsData, isLoading, refetch } = useListAdminsQuery();
  const [updateUser, { isLoading: isUpdating }] = useUpdateUserMutation();
  const [deleteUser, { isLoading: isDeleting }] = useDeleteUserMutation();
  const { showToast } = useToast();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [adminToEdit, setAdminToEdit] = useState(null);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [adminToDelete, setAdminToDelete] = useState(null);

  const [toggleConfirmOpen, setToggleConfirmOpen] = useState(false);
  const [adminToToggle, setAdminToToggle] = useState(null);

  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState('name');
  const [sortDir, setSortDir] = useState('asc');

  const admins = adminsData?.data || [];

  const handleEditClick = (admin) => {
    setAdminToEdit(admin);
    setEditModalOpen(true);
  };

  const handleDeleteClick = (admin) => {
    setAdminToDelete(admin);
    setDeleteConfirmOpen(true);
  };

  const handleToggleStatusClick = (admin) => {
    setAdminToToggle(admin);
    setToggleConfirmOpen(true);
  };

  const confirmToggleStatus = async () => {
    if (!adminToToggle) return;
    const isCurrentlyActive = adminToToggle.isActive !== false && adminToToggle.status !== 'SUSPENDED';
    const nextActive = !isCurrentlyActive;
    try {
      await updateUser({
        id: adminToToggle._id,
        isActive: nextActive,
        status: nextActive ? 'ACTIVE' : 'SUSPENDED',
      }).unwrap();
      showToast(
        `Admin "${adminToToggle.name}" ${nextActive ? 'activated' : 'suspended'} successfully.`,
        'success'
      );
      setToggleConfirmOpen(false);
      setAdminToToggle(null);
    } catch (err) {
      showToast(err?.data?.message || 'Failed to update admin status', 'error');
    }
  };

  const confirmDelete = async () => {
    if (!adminToDelete) return;
    try {
      await deleteUser(adminToDelete._id).unwrap();
      showToast(`Admin account "${adminToDelete.name}" was permanently removed.`, 'success');
      setDeleteConfirmOpen(false);
      setAdminToDelete(null);
    } catch (err) {
      showToast(err?.data?.message || 'Failed to delete admin', 'error');
    }
  };

  const columns = [
    { key: 'name', label: 'Administrator', sortable: true },
    { key: 'email', label: 'Email Address', sortable: true },
    {
      key: 'createdAt',
      label: 'Created Date',
      sortable: true,
      render: (val) => (val ? new Date(val).toLocaleDateString() : 'N/A'),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (_, row) => {
        const isActive = row.isActive !== false && row.status !== 'SUSPENDED';
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '0.75rem',
              fontWeight: 600,
              background: isActive
                ? 'color-mix(in srgb, var(--color-success) 15%, transparent)'
                : 'color-mix(in srgb, var(--color-danger) 15%, transparent)',
              color: isActive ? 'var(--color-success)' : 'var(--color-danger)',
            }}
          >
            {isActive ? 'Active' : 'Suspended'}
          </span>
        );
      },
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (_, row) => {
        const isActive = row.isActive !== false && row.status !== 'SUSPENDED';
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              onClick={() => handleEditClick(row)}
              title="Edit Admin Details"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '30px',
                height: '30px',
                borderRadius: '6px',
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface-elevated)',
                color: 'var(--color-text)',
                cursor: 'pointer',
              }}
            >
              <Pencil size={14} />
            </button>

            <button
              type="button"
              onClick={() => handleToggleStatusClick(row)}
              title={isActive ? 'Suspend Administrator' : 'Activate Administrator'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '30px',
                height: '30px',
                borderRadius: '6px',
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface-elevated)',
                color: isActive ? 'var(--color-warning, #eab308)' : 'var(--color-success)',
                cursor: 'pointer',
              }}
            >
              {isActive ? <UserX size={14} /> : <UserCheck size={14} />}
            </button>

            <button
              type="button"
              onClick={() => handleDeleteClick(row)}
              title="Delete Admin Account"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '30px',
                height: '30px',
                borderRadius: '6px',
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface-elevated)',
                color: 'var(--color-danger)',
                cursor: 'pointer',
              }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        );
      },
    },
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
      result = result.filter(
        (a) =>
          a.name?.toLowerCase().includes(lowerSearch) ||
          a.email?.toLowerCase().includes(lowerSearch)
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
          icon={<ShieldCheck size={48} />}
          title="No administrators yet"
          description="Create designated campus administrators to manage college portals and department staff."
          actionLabel="Create First Administrator"
          onAction={() => setCreateModalOpen(true)}
        />
        <CreateAdminModal isOpen={createModalOpen} onClose={() => setCreateModalOpen(false)} />
      </>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)', minWidth: 0, width: '100%' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 'var(--spacing-3)',
          minWidth: 0,
        }}
      >
        <div style={{ position: 'relative', width: '100%', maxWidth: '300px' }}>
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--color-text-muted)',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            placeholder="Search administrators..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: 'var(--spacing-2) var(--spacing-3) var(--spacing-2) 32px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)',
              width: '100%',
              minWidth: 0,
              boxSizing: 'border-box',
              background: 'var(--color-surface-elevated)',
              color: 'var(--color-text)',
            }}
          />
        </div>
        <Button variant="primary" onClick={() => setCreateModalOpen(true)}>
          <Plus size={16} /> Create Administrator
        </Button>
      </div>

      <Table
        columns={columns}
        data={filteredAndSortedData}
        sortColumn={sortCol}
        sortDirection={sortDir}
        onSort={handleSort}
        isLoading={isLoading}
      />

      {/* Create Admin Modal */}
      <CreateAdminModal isOpen={createModalOpen} onClose={() => setCreateModalOpen(false)} />

      {/* Edit Admin Modal */}
      <EditAdminModal
        isOpen={editModalOpen}
        admin={adminToEdit}
        onClose={() => {
          setEditModalOpen(false);
          setAdminToEdit(null);
        }}
      />

      {/* Toggle Status Confirmation Dialog */}
      <ConfirmDialog
        isOpen={toggleConfirmOpen}
        onClose={() => {
          setToggleConfirmOpen(false);
          setAdminToToggle(null);
        }}
        onConfirm={confirmToggleStatus}
        title={
          adminToToggle?.isActive !== false && adminToToggle?.status !== 'SUSPENDED'
            ? 'Suspend Administrator'
            : 'Activate Administrator'
        }
        warningText={`Are you sure you want to change access status for ${adminToToggle?.name} (${adminToToggle?.email})?`}
        confirmLabel={isUpdating ? 'Updating...' : 'Confirm'}
        isDestructive={adminToToggle?.isActive !== false && adminToToggle?.status !== 'SUSPENDED'}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setAdminToDelete(null);
        }}
        onConfirm={confirmDelete}
        title={`Delete Administrator: ${adminToDelete?.name || ''}`}
        warningText={`Are you sure you want to permanently delete the administrator account for ${adminToDelete?.name} (${adminToDelete?.email})? If this administrator is assigned to a college campus, that campus will lose its assigned admin. This action CANNOT be undone.`}
        confirmLabel={isDeleting ? 'Deleting...' : 'Delete Admin Account'}
        isDestructive={true}
      />
    </div>
  );
}
