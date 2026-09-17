import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useToast } from '../ui/ToastContext';
import {
  useCreateTeachingAssignmentMutation,
  useDeleteTeachingAssignmentMutation,
} from '../../api/teachingApi';
import { useListBatchesQuery } from '../../api/academicApi';
import { AlertCircle, FlaskConical } from 'lucide-react';
import styles from './MatrixAssignmentModal.module.css';

export function MatrixAssignmentModal({ isOpen, onClose, cellData }) {
  const { faculty, column, existingAssignment } = cellData;
  const { showToast } = useToast();

  const isLab = column?.subjectType === 'lab';
  const [batchId, setBatchId] = useState('');

  const { data: batches = [], isLoading: isLoadingBatches } = useListBatchesQuery(
    column?.sectionId,
    { skip: !column?.sectionId || !isLab || Boolean(existingAssignment) }
  );

  const [createAssignment, { isLoading: isCreating }] = useCreateTeachingAssignmentMutation();
  const [deleteAssignment, { isLoading: isDeleting }] = useDeleteTeachingAssignmentMutation();

  const [conflictError, setConflictError] = useState(null);

  const handleAssign = async () => {
    setConflictError(null);
    if (isLab && !batchId) {
      showToast('Lab subjects require selecting a specific batch', 'error');
      return;
    }

    // Auto-generate academic year label (e.g., "2025-26")
    const now = new Date();
    const startYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
    const academicYearLabel = `${startYear}-${String(startYear + 1).slice(-2)}`;

    const payload = {
      facultyId: faculty._id,
      subjectId: column.subjectId,
      sectionId: column.sectionId,
      academicYearLabel,
      validFrom: new Date().toISOString(),
    };

    if (isLab && batchId) {
      payload.batchId = batchId;
    }

    try {
      await createAssignment(payload).unwrap();
      showToast('Assignment created successfully', 'success');
      onClose();
    } catch (err) {
      const message = err?.data?.message || err?.data?.error || 'Failed to create assignment.';
      setConflictError(message);
    }
  };

  const handleUnassign = async () => {
    try {
      await deleteAssignment(existingAssignment._id).unwrap();
      showToast('Assignment removed successfully', 'success');
      onClose();
    } catch (err) {
      showToast(err?.data?.message || err?.data?.error || 'Failed to remove assignment', 'error');
    }
  };

  const isBusy = isCreating || isDeleting;
  const canConfirm = !isBusy && (!isLab || Boolean(batchId));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Manage Assignment">
      <div className={styles.body}>
        <div className={styles.summaryGrid}>
          <div className={styles.summaryLabel}>Faculty:</div>
          <div className={styles.summaryValue}>{faculty.name}</div>

          <div className={styles.summaryLabel}>Subject:</div>
          <div className={styles.summaryValue}>
            {column.subjectName} ({column.subjectCode})
            {isLab && (
              <span
                style={{
                  marginLeft: '0.5rem',
                  fontSize: '0.72rem',
                  padding: '0.15rem 0.45rem',
                  borderRadius: '999px',
                  background: 'rgba(99, 102, 241, 0.15)',
                  color: '#818cf8',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                }}
              >
                <FlaskConical size={11} /> LAB
              </span>
            )}
          </div>

          <div className={styles.summaryLabel}>Section:</div>
          <div className={styles.summaryValue}>{column.sectionName}</div>

          {existingAssignment?.batchId && (
            <>
              <div className={styles.summaryLabel}>Assigned Batch:</div>
              <div className={styles.summaryValue}>
                {existingAssignment.batchId.name || existingAssignment.batchId}
              </div>
            </>
          )}
        </div>

        {/* ── Lab Batch Selection for unassigned cell ── */}
        {!existingAssignment && isLab && (
          <div style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
            <label
              htmlFor="matrixBatchSelect"
              style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}
            >
              Select Lab Batch <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            {isLoadingBatches ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Loading section batches…</p>
            ) : batches.length === 0 ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  color: '#eab308',
                  fontSize: '0.8rem',
                  padding: '0.4rem 0.6rem',
                  background: 'rgba(234, 179, 8, 0.1)',
                  borderRadius: '4px',
                }}
              >
                <AlertCircle size={14} />
                <span>No lab batches found for this section. Configure batches in Academic Structure first.</span>
              </div>
            ) : (
              <select
                id="matrixBatchSelect"
                value={batchId}
                onChange={(e) => setBatchId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: '4px',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface-elevated)',
                  color: 'var(--color-text)',
                  fontSize: '0.85rem',
                }}
              >
                <option value="" disabled>
                  Select a lab batch…
                </option>
                {batches.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name} ({(b.studentIds || []).length} students)
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

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
            <Button variant="primary" onClick={handleAssign} disabled={!canConfirm}>
              {isCreating ? 'Assigning...' : 'Confirm Assignment'}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
