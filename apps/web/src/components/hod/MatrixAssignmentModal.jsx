import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useToast } from '../ui/ToastContext';
import { useCreateTeachingAssignmentMutation, useDeleteTeachingAssignmentMutation } from '../../api/teachingApi';
import { AlertCircle } from 'lucide-react';
import styles from './MatrixAssignmentModal.module.css';

export function MatrixAssignmentModal({ isOpen, onClose, cellData }) {
  const { faculty, column, existingAssignment } = cellData;
  const { showToast } = useToast();

  const [createAssignment, { isLoading: isCreating }] = useCreateTeachingAssignmentMutation();
  const [deleteAssignment, { isLoading: isDeleting }] = useDeleteTeachingAssignmentMutation();

  const [conflictError, setConflictError] = useState(null);

  const handleAssign = async () => {
    setConflictError(null);
    try {
      await createAssignment({
        facultyId: faculty._id,
        subjectId: column.subjectId,
        sectionId: column.sectionId,
        validFrom: new Date().toISOString()
      }).unwrap();
      
      showToast('Assignment created successfully', 'success');
      onClose();
    } catch (err) {
      // Inline conflict warning sourcing error message directly from Phase 14 backend
      const message = err?.data?.message || 'Failed to create assignment due to an unknown error.';
      setConflictError(message);
    }
  };

  const handleUnassign = async () => {
    try {
      await deleteAssignment(existingAssignment._id).unwrap();
      showToast('Assignment removed successfully', 'success');
      onClose();
    } catch (err) {
      showToast(err?.data?.message || 'Failed to remove assignment', 'error');
    }
  };

  const isBusy = isCreating || isDeleting;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Manage Assignment">
      <div className={styles.body}>
        <div className={styles.summaryGrid}>
          <div className={styles.summaryLabel}>Faculty:</div>
          <div className={styles.summaryValue}>{faculty.name}</div>
          
          <div className={styles.summaryLabel}>Subject:</div>
          <div className={styles.summaryValue}>{column.subjectName} ({column.subjectCode})</div>
          
          <div className={styles.summaryLabel}>Section:</div>
          <div className={styles.summaryValue}>{column.sectionName}</div>
        </div>

        <div className={styles.statusBox}>
          Status: <strong>{existingAssignment ? 'Assigned' : 'Unassigned'}</strong>
        </div>

        {conflictError && (
          <div className={styles.conflictAlert}>
            <AlertCircle size={18} />
            <div>
              <strong>Conflict Detected</strong>
              <p>{conflictError}</p>
            </div>
          </div>
        )}

        <div className={styles.actions}>
          <Button variant="ghost" onClick={onClose} disabled={isBusy}>
            Cancel
          </Button>

          {existingAssignment ? (
            <Button variant="danger" onClick={handleUnassign} disabled={isBusy}>
              {isDeleting ? 'Removing...' : 'Remove Assignment'}
            </Button>
          ) : (
            <Button variant="primary" onClick={handleAssign} disabled={isBusy}>
              {isCreating ? 'Assigning...' : 'Confirm Assignment'}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
