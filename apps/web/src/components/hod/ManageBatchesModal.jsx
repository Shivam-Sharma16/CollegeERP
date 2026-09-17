import { useState, useMemo, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useToast } from '../ui/ToastContext';
import {
  useListBatchesQuery,
  useCreateBatchMutation,
  useUpdateBatchMutation,
  useDeleteBatchMutation,
} from '../../api/academicApi';
import { useListSectionStudentsQuery } from '../../api/usersApi';
import {
  Users,
  Plus,
  Trash2,
  Check,
  AlertCircle,
  Search,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react';
import styles from './ManageBatchesModal.module.css';

export function ManageBatchesModal({ isOpen, onClose, section }) {
  const { showToast } = useToast();
  const sectionId = section?._id;

  const { data: batches = [], isLoading: isLoadingBatches } = useListBatchesQuery(sectionId, {
    skip: !sectionId,
  });

  const { data: studentsData, isLoading: isLoadingStudents } = useListSectionStudentsQuery(
    { sectionId },
    { skip: !sectionId }
  );

  const students = useMemo(() => {
    const list = studentsData?.data || studentsData || [];
    return Array.isArray(list) ? list : [];
  }, [studentsData]);

  const [createBatch, { isLoading: isCreating }] = useCreateBatchMutation();
  const [updateBatch, { isLoading: isUpdating }] = useUpdateBatchMutation();
  const [deleteBatch, { isLoading: isDeleting }] = useDeleteBatchMutation();

  // Active batch selection: null = "+ New Batch", or batch._id
  const [activeBatchId, setActiveBatchId] = useState(null);
  const [name, setName] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // Map of studentId -> { batchId, batchName } across ALL existing batches in this section
  const studentBatchMap = useMemo(() => {
    const map = new Map();
    if (!Array.isArray(batches)) return map;

    batches.forEach((b) => {
      const studentIds = b.studentIds || [];
      studentIds.forEach((s) => {
        const id = typeof s === 'string' ? s : s?._id || s?.id;
        if (id) {
          map.set(id.toString(), {
            batchId: b._id,
            batchName: b.name,
          });
        }
      });
    });
    return map;
  }, [batches]);

  // When switching active batch or opening modal, initialize state
  useEffect(() => {
    if (activeBatchId) {
      const current = batches.find((b) => b._id === activeBatchId);
      if (current) {
        setName(current.name || '');
        const ids = (current.studentIds || []).map((s) =>
          typeof s === 'string' ? s : s?._id || s?.id
        );
        setSelectedStudentIds(new Set(ids.filter(Boolean).map(String)));
      }
    } else {
      // Default: create new batch with auto-suggested name
      const nextBatchNumber = (batches?.length || 0) + 1;
      setName(`Batch ${nextBatchNumber}`);
      setSelectedStudentIds(new Set());
    }
  }, [activeBatchId, batches]);

  // Filtered students according to search
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const q = searchQuery.toLowerCase();
    return students.filter(
      (s) =>
        s.name?.toLowerCase().includes(q) ||
        s.rollNumber?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q)
    );
  }, [students, searchQuery]);

  // Toggle student selection with strict mutual exclusivity
  const handleToggleStudent = (studentId) => {
    const idStr = studentId.toString();
    const assigned = studentBatchMap.get(idStr);

    // MUTUAL EXCLUSIVITY CHECK:
    // If student is assigned to another batch in the same section, reject toggle
    if (assigned && assigned.batchId !== activeBatchId) {
      showToast(
        `Cannot assign ${idStr}: Student is already enrolled in ${assigned.batchName} of this section.`,
        'error'
      );
      return;
    }

    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(idStr)) {
        next.delete(idStr);
      } else {
        next.add(idStr);
      }
      return next;
    });
  };

  // Quick select unassigned students
  const handleSelectAllUnassigned = () => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      filteredStudents.forEach((s) => {
        const idStr = s._id.toString();
        const assigned = studentBatchMap.get(idStr);
        if (!assigned || assigned.batchId === activeBatchId) {
          next.add(idStr);
        }
      });
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedStudentIds(new Set());
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Batch name is required', 'error');
      return;
    }

    const payload = {
      name: name.trim(),
      studentIds: Array.from(selectedStudentIds),
    };

    try {
      if (activeBatchId) {
        await updateBatch({ id: activeBatchId, ...payload }).unwrap();
        showToast(`Batch "${payload.name}" updated successfully`, 'success');
      } else {
        const res = await createBatch({ sectionId, ...payload }).unwrap();
        showToast(`Batch "${payload.name}" created successfully`, 'success');
        const createdBatch = res?.data?.batch || res?.batch || res;
        if (createdBatch?._id) {
          setActiveBatchId(createdBatch._id);
        }
      }
    } catch (err) {
      showToast(err?.data?.message || err?.data?.error || 'Failed to save batch', 'error');
    }
  };

  const handleDelete = async () => {
    if (!activeBatchId) return;
    if (!window.confirm(`Are you sure you want to delete batch "${name}"?`)) return;

    try {
      await deleteBatch(activeBatchId).unwrap();
      showToast(`Batch "${name}" deleted`, 'success');
      setActiveBatchId(null);
    } catch (err) {
      showToast(err?.data?.message || err?.data?.error || 'Failed to delete batch', 'error');
    }
  };

  const isSaving = isCreating || isUpdating;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Lab Batches — Section ${section?.name || ''}`}
    >
      <div className={styles.container}>
        <div className={styles.headerNote}>
          <AlertCircle size={16} color="var(--color-primary)" />
          <span>
            Lab subjects are conducted in batches. Students can belong to <strong>at most one batch</strong> per section.
          </span>
        </div>

        {/* ── Top Batch Navigation Tabs ── */}
        <div className={styles.batchTabs} role="tablist">
          {batches.map((b) => {
            const count = (b.studentIds || []).length;
            const isActive = activeBatchId === b._id;
            return (
              <button
                key={b._id}
                type="button"
                className={`${styles.batchTab} ${isActive ? styles.batchTabActive : ''}`}
                onClick={() => setActiveBatchId(b._id)}
              >
                <span>{b.name}</span>
                <span className={styles.countBadge}>{count}</span>
              </button>
            );
          })}

          <button
            type="button"
            className={`${styles.addBatchBtn} ${activeBatchId === null ? styles.batchTabActive : ''}`}
            onClick={() => setActiveBatchId(null)}
          >
            <Plus size={14} /> Add Batch
          </button>
        </div>

        {/* ── Batch Editor ── */}
        <form onSubmit={handleSave} className={styles.editorCard}>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="batchNameInput">
                Batch Name
              </label>
              <input
                id="batchNameInput"
                type="text"
                className={styles.input}
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Batch 1, Group A"
                disabled={isSaving}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem' }}>
              {activeBatchId && (
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={handleDelete}
                  disabled={isDeleting || isSaving}
                  title="Delete Batch"
                >
                  <Trash2 size={14} /> Delete
                </Button>
              )}
            </div>
          </div>

          {/* ── Student Multi-Select Roster ── */}
          <div className={styles.rosterHeader}>
            <div className={styles.rosterTitle}>
              <Users size={16} />
              <span>
                Assign Students ({selectedStudentIds.size} / {students.length} selected)
              </span>
            </div>

            <div className={styles.rosterControls}>
              <div className={styles.searchBox}>
                <Search size={14} className={styles.searchIcon} />
                <input
                  type="text"
                  placeholder="Search roster…"
                  className={styles.searchInput}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleSelectAllUnassigned}
              >
                Select Unassigned
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearSelection}
              >
                Clear
              </Button>
            </div>
          </div>

          <div className={styles.rosterTableWrapper}>
            {isLoadingStudents ? (
              <div className={styles.emptyRoster}>Loading section roster…</div>
            ) : filteredStudents.length === 0 ? (
              <div className={styles.emptyRoster}>No students found in this section.</div>
            ) : (
              <table className={styles.rosterTable}>
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>Select</th>
                    <th>Roll No</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Current Assignment</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((student) => {
                    const idStr = student._id.toString();
                    const isChecked = selectedStudentIds.has(idStr);
                    const assigned = studentBatchMap.get(idStr);

                    // If student is assigned to another batch in this section, disable checkbox!
                    const isAssignedToOther = assigned && assigned.batchId !== activeBatchId;
                    const isAssignedToCurrent = assigned && assigned.batchId === activeBatchId;

                    return (
                      <tr
                        key={idStr}
                        className={`${isAssignedToOther ? styles.rowDisabled : ''} ${
                          isChecked ? styles.rowSelected : ''
                        }`}
                      >
                        <td>
                          <input
                            type="checkbox"
                            id={`student-check-${idStr}`}
                            aria-label={`Select student ${student.name}`}
                            checked={isChecked}
                            disabled={isAssignedToOther || isSaving}
                            onChange={() => handleToggleStudent(idStr)}
                          />
                        </td>
                        <td>
                          <code>{student.rollNumber || '—'}</code>
                        </td>
                        <td>
                          <strong>{student.name}</strong>
                        </td>
                        <td>{student.email}</td>
                        <td>
                          {isAssignedToOther ? (
                            <span className={styles.assignedBadge} title="Mutually exclusive assignment">
                              <ShieldAlert size={12} />
                              In: {assigned.batchName}
                            </span>
                          ) : isAssignedToCurrent ? (
                            <span className={styles.currentBatchBadge}>
                              <CheckCircle2 size={12} />
                              This Batch
                            </span>
                          ) : (
                            <span className={styles.unassignedBadge}>Unassigned</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className={styles.actionsBar}>
            <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving}>
              Close
            </Button>
            <div className={styles.rightActions}>
              <Button type="submit" variant="primary" disabled={isSaving || !name.trim()}>
                {isSaving ? 'Saving...' : activeBatchId ? 'Update Batch' : 'Create Batch'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
}
