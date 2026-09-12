import { useState, useMemo } from 'react';
import { useListDepartmentsQuery, useDeleteDepartmentMutation } from '../../api/departmentsApi';
import { Table } from '../ui/Table';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { CreateDepartmentModal } from './CreateDepartmentModal';
import { useToast } from '../ui/ToastContext';
import { Trash2 } from 'lucide-react';

export function DepartmentsTab() {
  const { data: deptsData, isLoading } = useListDepartmentsQuery();
  const [deleteDepartment, { isLoading: isDeleting }] = useDeleteDepartmentMutation();
  const { showToast } = useToast();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deptToDelete, setDeptToDelete] = useState(null);

  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState('name');
  const [sortDir, setSortDir] = useState('asc');

  const departments = deptsData?.data || [];

  const handleDeleteClick = (dept) => {
    setDeptToDelete(dept);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!deptToDelete) return;
    try {
      await deleteDepartment(deptToDelete._id).unwrap();
      showToast('Department deleted successfully', 'success');
      setDeleteConfirmOpen(false);
      setDeptToDelete(null);
    } catch (err) {
      showToast(err?.data?.message || 'Failed to delete department', 'error');
    }
  };

  const columns = [
    { key: 'name', label: 'Department Name', sortable: true },
    { key: 'code', label: 'Code', sortable: true },
    { key: 'hodCount', label: 'HOD Count', sortable: true, render: (_, row) => row.hodCount || 0 },
    { key: 'studentCount', label: 'Student Count', sortable: true, render: (_, row) => row.studentCount || 0 },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (_, row) => (
        <Button variant="ghost" onClick={() => handleDeleteClick(row)} title="Delete Department">
          <Trash2 size={16} color="var(--color-danger)" />
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
    let result = [...departments];

    if (search) {
      const lowerSearch = search.toLowerCase();
      result = result.filter(d => 
        d.name.toLowerCase().includes(lowerSearch) || 
        d.code.toLowerCase().includes(lowerSearch)
      );
    }

    result.sort((a, b) => {
      let aVal = a[sortCol];
      let bVal = b[sortCol];
      
      if (sortCol === 'hodCount' || sortCol === 'studentCount') {
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
  }, [departments, search, sortCol, sortDir]);

  if (!isLoading && departments.length === 0) {
    return (
      <>
        <EmptyState 
          title="No departments yet" 
          description="Create your first department to start setting up your academic structure."
          actionLabel="Add Department"
          actionRoute="" // We intercept via click
        />
        {/* We want to trigger modal instead of routing, so let's just handle it directly here if needed. 
            Since EmptyState takes a route by default, let's just wrap it or not use the actionRoute and add a button. 
            Let's customize EmptyState slightly by rendering a button below it. 
        */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '-24px', paddingBottom: '24px' }}>
          <Button onClick={() => setCreateModalOpen(true)}>Add Department</Button>
        </div>
        <CreateDepartmentModal isOpen={createModalOpen} onClose={() => setCreateModalOpen(false)} />
      </>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)', minWidth: 0, width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--spacing-3)', minWidth: 0 }}>
        <input 
          type="text" 
          placeholder="Search departments..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: 'var(--spacing-2) var(--spacing-3)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border)',
            width: '100%',
            maxWidth: '300px',
            minWidth: 0,
            boxSizing: 'border-box'
          }}
        />
        <Button onClick={() => setCreateModalOpen(true)}>Add Department</Button>
      </div>

      <Table 
        columns={columns}
        data={filteredAndSortedData}
        sortColumn={sortCol}
        sortDirection={sortDir}
        onSort={handleSort}
        isLoading={isLoading}
      />

      <CreateDepartmentModal isOpen={createModalOpen} onClose={() => setCreateModalOpen(false)} />

      <ConfirmDialog 
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={confirmDelete}
        title="Delete Department"
        warningText={`This will permanently delete the ${deptToDelete?.name} department and unassign ${deptToDelete?.hodCount || 0} HODs. Are you sure you want to proceed?`}
        confirmLabel="Delete Department"
        isDestructive={true}
        isLoading={isDeleting}
      />
    </div>
  );
}
