import { useState, useCallback, useMemo } from 'react';
import { useListFacultyQuery, useDeactivateFacultyMutation } from '../../api/usersApi';
import { useGetFacultyLoadQuery } from '../../api/teachingApi';
import { Button } from '../ui/Button';
import { Table } from '../ui/Table';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { CreateFacultyModal } from '../users/CreateFacultyModal';
import { TeachingAssignmentModal } from './TeachingAssignmentModal';
import { useToast } from '../ui/ToastContext';
import { BookOpen, UserX } from 'lucide-react';
import styles from './FacultyManagementTab.module.css';

/**
 * FacultyLoadCell — fetches load for a single faculty ID and renders
 * the subjects count in-cell, used only by the table render function.
 */
function FacultyLoadCell({ facultyId }) {
  const { data, isLoading } = useGetFacultyLoadQuery(facultyId);
  const count = data?.data?.subjects?.length ?? 0;
  if (isLoading) return <span className={styles.loadingDot}>…</span>;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
      <BookOpen size={13} />
      {count}
    </span>
  );
}

/**
 * DeactivateConfirm — resolves the live faculty load for the targeted faculty
 * member and renders the named-confirmation dialog with the exact count.
 * Stays mounted while `faculty` is non-null so the query fires lazily.
 */
function DeactivateConfirm({ faculty, isOpen, onClose, onConfirm, isLoading }) {
  const { data: loadData, isLoading: isLoadingLoad } = useGetFacultyLoadQuery(
    faculty?._id,
    { skip: !faculty?._id }
  );

  const assignmentCount = loadData?.data?.subjects?.length ?? 0;

  const warningText = isLoadingLoad
    ? `Fetching active assignments for ${faculty?.name}…`
    : assignmentCount > 0
      ? `This will deactivate ${faculty?.name}'s account and remove them from ${assignmentCount} active teaching assignment${assignmentCount !== 1 ? 's' : ''}.`
      : `This will deactivate ${faculty?.name}'s account. They will lose all system access immediately.`;

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={isLoadingLoad ? undefined : onConfirm}
      title="Deactivate Faculty"
      warningText={warningText}
      confirmLabel={isLoadingLoad ? 'Loading…' : 'Deactivate Account'}
      isDestructive
      isLoading={isLoading || isLoadingLoad}
    />
  );
}

export function FacultyManagementTab() {
  const { data, isLoading: isLoadingList, isError } = useListFacultyQuery();
  const [deactivateFaculty, { isLoading: isDeactivating }] = useDeactivateFacultyMutation();
  const { showToast } = useToast();

  const [isCreateOpen, setIsCreateOpen]       = useState(false);
  const [assignModalOpen, setAssignModalOpen]  = useState(false);
  const [selectedFaculty, setSelectedFaculty]  = useState(null);

  // Deactivate confirm state
  const [deactivateTarget,    setDeactivateTarget]    = useState(null);
  const [deactivateOpen,      setDeactivateOpen]      = useState(false);

  const [sortCol, setSortCol] = useState('name');
  const [sortDir, setSortDir] = useState('asc');

  const facultyList = data?.data || [];

  const handleReassign = useCallback((faculty) => {
    setSelectedFaculty(faculty);
    setAssignModalOpen(true);
  }, []);

  const handleDeactivateClick = useCallback((row) => {
    setDeactivateTarget(row);
    setDeactivateOpen(true);
  }, []);

  const confirmDeactivate = useCallback(async () => {
    if (!deactivateTarget) return;
    try {
      await deactivateFaculty(deactivateTarget._id).unwrap();
      showToast(`${deactivateTarget.name} has been deactivated.`, 'success');
    } catch {
      showToast(`Failed to deactivate ${deactivateTarget.name}.`, 'error');
    } finally {
      setDeactivateOpen(false);
      setDeactivateTarget(null);
    }
  }, [deactivateTarget, deactivateFaculty, showToast]);

  const handleSort = useCallback((col) => {
    setSortDir(prev => (sortCol === col ? (prev === 'asc' ? 'desc' : 'asc') : 'asc'));
    setSortCol(col);
  }, [sortCol]);

  const tableData = useMemo(() => {
    const list = [...facultyList];
    list.sort((a, b) => {
      const av = (a[sortCol] ?? '').toString().toLowerCase();
      const bv = (b[sortCol] ?? '').toString().toLowerCase();
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ?  1 : -1;
      return 0;
    });
    return list;
  }, [facultyList, sortCol, sortDir]);

  const columns = [
    { key: 'name',  label: 'Name',  sortable: true },
    { key: 'email', label: 'Email', sortable: true },
    {
      key: 'subjects',
      label: 'Assignments',
      render: (_, row) => <FacultyLoadCell facultyId={row._id} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div className={styles.actionButtons}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleReassign(row)}
            title="Assign Subject"
          >
            <BookOpen size={15} style={{ marginRight: 4 }} />
            Assign
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDeactivateClick(row)}
            title="Deactivate Faculty Account"
            className={styles.dangerBtn}
          >
            <UserX size={15} style={{ marginRight: 4 }} />
            Deactivate
          </Button>
        </div>
      ),
    },
  ];

  if (isError) return <div className={styles.error}>Failed to load faculty.</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Department Faculty</h3>
        <Button variant="primary" onClick={() => setIsCreateOpen(true)}>
          Create Faculty
        </Button>
      </div>

      <Table
        columns={columns}
        data={tableData}
        isLoading={isLoadingList}
        skeletonRows={4}
        sortColumn={sortCol}
        sortDirection={sortDir}
        onSort={handleSort}
        emptyIcon="users"
      />

      <CreateFacultyModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />

      {selectedFaculty && (
        <TeachingAssignmentModal
          isOpen={assignModalOpen}
          onClose={() => {
            setAssignModalOpen(false);
            setSelectedFaculty(null);
          }}
          faculty={selectedFaculty}
        />
      )}

      {deactivateTarget && (
        <DeactivateConfirm
          faculty={deactivateTarget}
          isOpen={deactivateOpen}
          onClose={() => {
            setDeactivateOpen(false);
            setDeactivateTarget(null);
          }}
          onConfirm={confirmDeactivate}
          isLoading={isDeactivating}
        />
      )}
    </div>
  );
}
