import { useState, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useToast } from '../ui/ToastContext';
import { useCreateTeachingAssignmentMutation } from '../../api/teachingApi';
import { useResolveDeptTreeQuery } from '../../api/departmentsApi';
import { useListBatchesQuery } from '../../api/academicApi';
import { AlertCircle, FlaskConical, BookOpen } from 'lucide-react';
import styles from './TeachingAssignmentModal.module.css';

export function TeachingAssignmentModal({ isOpen, onClose, faculty }) {
  const [subjectId, setSubjectId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [batchId, setBatchId] = useState('');
  const { showToast } = useToast();

  const { data: deptData, isLoading: isLoadingDepts } = useResolveDeptTreeQuery();
  const [assignSubject, { isLoading: isAssigning }] = useCreateTeachingAssignmentMutation();

  // Flatten all subjects along with their semester and sections
  const subjects = useMemo(() => {
    const list = [];
    if (!deptData?.data?.departments) return list;

    deptData.data.departments.forEach((dept) => {
      dept.years?.forEach((year) => {
        year.semesters?.forEach((sem) => {
          sem.subjects?.forEach((sub) => {
            list.push({
              ...sub,
              semesterId: sem._id,
              sections: sem.sections || [],
              _label: `${sub.name} (${sub.code}) - Year ${year.year} Sem ${sem.semester}`,
            });
          });
        });
      });
    });

    return Array.from(new Map(list.map((s) => [s._id, s])).values());
  }, [deptData]);

  const selectedSubject = useMemo(() => {
    return subjects.find((s) => s._id === subjectId);
  }, [subjects, subjectId]);

  const isLab = selectedSubject?.type === 'lab';
  const availableSections = selectedSubject?.sections || [];

  // Query batches for selected section (if it's a lab subject)
  const { data: batches = [], isLoading: isLoadingBatches } = useListBatchesQuery(sectionId, {
    skip: !sectionId || !isLab,
  });

  const handleSubjectChange = (e) => {
    const newSubId = e.target.value;
    setSubjectId(newSubId);
    setSectionId('');
    setBatchId('');
  };

  const handleSectionChange = (e) => {
    setSectionId(e.target.value);
    setBatchId('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subjectId) return;

    if (isLab && !batchId) {
      showToast('Lab subjects require selecting a specific batch', 'error');
      return;
    }

    if (!sectionId) {
      showToast('Please select a section', 'error');
      return;
    }

    // Auto-generate academic year label (e.g., "2025-26")
    const now = new Date();
    const startYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
    const academicYearLabel = `${startYear}-${String(startYear + 1).slice(-2)}`;

    const payload = {
      facultyId: faculty._id,
      subjectId,
      sectionId,
      academicYearLabel,
      validFrom: new Date().toISOString(),
    };

    if (isLab && batchId) {
      payload.batchId = batchId;
    }

    try {
      await assignSubject(payload).unwrap();
      showToast('Subject assigned to faculty successfully', 'success');
      onClose();
    } catch (err) {
      showToast(err?.data?.message || err?.data?.error || 'Failed to assign subject', 'error');
    }
  };

  const canSubmit =
    !isAssigning &&
    Boolean(subjectId) &&
    Boolean(sectionId) &&
    (!isLab || Boolean(batchId));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Assign Subject">
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.facultyInfo}>
          <p>
            <strong>Faculty:</strong> {faculty?.name}
          </p>
        </div>

        {/* ── Subject Selection ── */}
        <div className={styles.field}>
          <label htmlFor="subject">Subject</label>
          <select
            id="subject"
            className={styles.input}
            required
            value={subjectId}
            onChange={handleSubjectChange}
            disabled={isLoadingDepts || isAssigning}
          >
            <option value="" disabled>
              Select a subject
            </option>
            {subjects.map((sub) => (
              <option key={sub._id} value={sub._id}>
                {sub._label} {sub.type === 'lab' ? '[LAB]' : '[LECTURE]'}
              </option>
            ))}
          </select>
        </div>

        {/* ── Type Indicator ── */}
        {selectedSubject && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              padding: '0.25rem 0.6rem',
              borderRadius: '999px',
              width: 'fit-content',
              background: isLab ? 'rgba(99, 102, 241, 0.15)' : 'rgba(16, 185, 129, 0.15)',
              color: isLab ? '#818cf8' : '#34d399',
            }}
          >
            {isLab ? <FlaskConical size={14} /> : <BookOpen size={14} />}
            <span>Type: {isLab ? 'Lab Subject (Batch-Level Assignment)' : 'Lecture Subject'}</span>
          </div>
        )}

        {/* ── Section Selection (shown if subject has sections) ── */}
        {selectedSubject && availableSections.length > 0 && (
          <div className={styles.field}>
            <label htmlFor="sectionSelect">Section {isLab && '(Required for Lab)'}</label>
            <select
              id="sectionSelect"
              className={styles.input}
              required={isLab}
              value={sectionId}
              onChange={handleSectionChange}
              disabled={isAssigning}
            >
              <option value="" disabled>
                Select a section...
              </option>
              {availableSections.map((sec) => (
                <option key={sec._id} value={sec._id}>
                  Section {sec.name} (Capacity: {sec.capacity})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* ── Lab Batch Selection (Retrofit Phase 41: Required for Labs) ── */}
        {isLab && sectionId && (
          <div className={styles.field}>
            <label htmlFor="batchSelect">
              Lab Batch <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            {isLoadingBatches ? (
              <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                Loading batches for this section…
              </div>
            ) : batches.length === 0 ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  color: '#eab308',
                  fontSize: '0.82rem',
                  padding: '0.5rem',
                  background: 'rgba(234, 179, 8, 0.1)',
                  borderRadius: '4px',
                }}
              >
                <AlertCircle size={15} />
                <span>
                  No lab batches found in this section. Please configure batches in Academic Structure first.
                </span>
              </div>
            ) : (
              <select
                id="batchSelect"
                className={styles.input}
                required
                value={batchId}
                onChange={(e) => setBatchId(e.target.value)}
                disabled={isAssigning}
              >
                <option value="" disabled>
                  Select a lab batch...
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

        <div className={styles.actions}>
          <Button type="button" variant="ghost" onClick={onClose} disabled={isAssigning}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={!canSubmit}>
            {isAssigning ? 'Assigning...' : 'Confirm Assignment'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
