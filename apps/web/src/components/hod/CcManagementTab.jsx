import { useState, useMemo, useCallback } from 'react';
import { useListCcQuery, useDeactivateCcMutation } from '../../api/usersApi';
import { useListSectionAssignmentsQuery } from '../../api/teachingApi';
import { Button } from '../ui/Button';
import { Table } from '../ui/Table';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { CreateCcModal } from '../users/CreateCcModal';
import { SectionAssignmentModal } from './SectionAssignmentModal';
import { useToast } from '../ui/ToastContext';
import { UserPlus, UserX } from 'lucide-react';
import styles from './CcManagementTab.module.css';

export function CcManagementTab() {
  const { data: usersData, isLoading: isLoadingUsers } = useListCcQuery();
  const { data: assignmentsData, isLoading: isLoadingAssignments } = useListSectionAssignmentsQuery();
  const [deactivateCc, { isLoading: isDeactivating }] = useDeactivateCcMutation();
  const { showToast } = useToast();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedCc, setSelectedCc]     = useState(null);

  // Deactivate confirm state
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [deactivateOpen,   setDeactivateOpen]   = useState(false);

  const users       = usersData?.data || [];
  const assignments = assignmentsData?.data || [];

  const tableData = useMemo(() => {
    return users.map(user => {
      const assignment = assignments.find(a => a.facultyId?._id === user._id);
      return {
        _id: user._id,
        name: user.name,
        email: user.email,
        assignedSection: assignment?.sectionId?.name || 'Unassigned',
        semester: assignment?.sectionId?.semester
          ? `Sem ${assignment.sectionId.semester}` : '-',
        validFrom: assignment?.validFrom
          ? new Date(assignment.validFrom).toLocaleDateString() : '-',
      };
    });
  }, [users, assignments]);

  const handleDeactivateClick = useCallback((row) => {
    setDeactivateTarget(row);
    setDeactivateOpen(true);
  }, []);

  const confirmDeactivate = useCallback(async () => {
    if (!deactivateTarget) return;
    try {
      await deactivateCc(deactivateTarget._id).unwrap();
      showToast(`${deactivateTarget.name} has been deactivated.`, 'success');
    } catch {
      showToast(`Failed to deactivate ${deactivateTarget.name}.`, 'error');
    } finally {
      setDeactivateOpen(false);
      setDeactivateTarget(null);
    }
  }, [deactivateTarget, deactivateCc, showToast]);

  // Build named-confirmation warning that mentions the specific section
  const deactivateWarning = deactivateTarget
    ? deactivateTarget.assignedSection && deactivateTarget.assignedSection !== 'Unassigned'
      ? `This will deactivate ${deactivateTarget.name}'s account and remove them as Class Coordinator of Section ${deactivateTarget.assignedSection}.`
      : `This will deactivate ${deactivateTarget.name}'s account. They will lose all system access immediately.`
    : '';

  const columns = [
    { key: 'name',  label: 'Name',  sortable: true },
    { key: 'email', label: 'Email' },
    { key: 'assignedSection', label: 'Assigned Section', sortable: true },
    { key: 'semester', label: 'Semester' },
    { key: 'validFrom', label: 'Valid From' },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div className={styles.actionButtons}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedCc({ _id: row._id, name: row.name })}
          >
            <UserPlus size={15} style={{ marginRight: 5 }} /> Assign Section
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDeactivateClick(row)}
            title="Deactivate CC Account"
            className={styles.dangerBtn}
          >
            <UserX size={15} style={{ marginRight: 5 }} /> Deactivate
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Class Coordinators</h3>
        <Button variant="primary" onClick={() => setIsCreateOpen(true)}>
          Create CC
        </Button>
      </div>

      <Table
        columns={columns}
        data={tableData}
        isLoading={isLoadingUsers || isLoadingAssignments}
        emptyIcon="users"
      />

      <CreateCcModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />

      {selectedCc && (
        <SectionAssignmentModal
          isOpen={!!selectedCc}
          onClose={() => setSelectedCc(null)}
          cc={selectedCc}
        />
      )}

      {deactivateTarget && (
        <ConfirmDialog
          isOpen={deactivateOpen}
          onClose={() => {
            setDeactivateOpen(false);
            setDeactivateTarget(null);
          }}
          onConfirm={confirmDeactivate}
          title="Deactivate Class Coordinator"
          warningText={deactivateWarning}
          confirmLabel="Deactivate Account"
          isDestructive
          isLoading={isDeactivating}
        />
      )}
    </div>
  );
}
