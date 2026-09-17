import { useState, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useToast } from '../ui/ToastContext';
import { useCreateSubjectMutation } from '../../api/academicApi';
import { ManageBatchesModal } from './ManageBatchesModal';
import { BookOpen, FlaskConical, Users, AlertCircle, Layers } from 'lucide-react';
import styles from './CreateSubjectModal.module.css';

export function CreateSubjectModal({ isOpen, onClose, departmentId, department }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [credits, setCredits] = useState('3');
  const [type, setType] = useState('lecture'); // 'lecture' | 'lab'
  const [semesterId, setSemesterId] = useState('');
  const [activeSectionForBatches, setActiveSectionForBatches] = useState(null);

  const { showToast } = useToast();
  const [createSubject, { isLoading }] = useCreateSubjectMutation();

  const semestersList = useMemo(() => {
    const list = [];
    if (!department) return list;
    department.years?.forEach((year) => {
      year.semesters?.forEach((sem) => {
        list.push({
          _id: sem._id,
          label: `Year ${year.year} - Semester ${sem.semester}`,
          sections: sem.sections || [],
        });
      });
    });
    return list;
  }, [department]);

  // Find currently selected semester to inspect its sections
  const selectedSemester = useMemo(() => {
    return semestersList.find((s) => s._id === semesterId);
  }, [semestersList, semesterId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await createSubject({
        departmentId,
        semesterId,
        name,
        code,
        credits: parseInt(credits, 10),
        type, // 'lecture' or 'lab'
      }).unwrap();

      showToast(`Subject ${code} (${type.toUpperCase()}) added successfully`, 'success');
      setName('');
      setCode('');
      setCredits('3');
      setType('lecture');
      setSemesterId('');
      onClose();
    } catch (err) {
      showToast(err?.data?.message || 'Failed to add subject', 'error');
    }
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Add Subject">
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="semesterId">Assign to Semester</label>
            <select
              id="semesterId"
              className={styles.input}
              required
              value={semesterId}
              onChange={(e) => setSemesterId(e.target.value)}
              disabled={isLoading}
            >
              <option value="" disabled>
                Select a semester...
              </option>
              {semestersList.map((sem) => (
                <option key={sem._id} value={sem._id}>
                  {sem.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.grid}>
            <div className={styles.field}>
              <label htmlFor="code">Subject Code</label>
              <input
                id="code"
                className={styles.input}
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                disabled={isLoading}
                placeholder="e.g. CS101"
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="credits">Credits</label>
              <input
                id="credits"
                className={styles.input}
                type="number"
                min="1"
                max="10"
                required
                value={credits}
                onChange={(e) => setCredits(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>

          <div className={styles.field}>
            <label htmlFor="name">Subject Name</label>
            <input
              id="name"
              className={styles.input}
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
              placeholder="e.g. Data Structures & Algorithms Lab"
            />
          </div>

          {/* ── Lecture / Lab Toggle ── */}
          <div className={styles.field}>
            <label>Subject Type</label>
            <div className={styles.toggleContainer} role="radiogroup" aria-label="Subject Type">
              <button
                type="button"
                role="radio"
                aria-checked={type === 'lecture'}
                className={`${styles.toggleBtn} ${type === 'lecture' ? styles.toggleBtnActive : ''}`}
                onClick={() => setType('lecture')}
              >
                <BookOpen size={16} />
                <span>Lecture</span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={type === 'lab'}
                className={`${styles.toggleBtn} ${type === 'lab' ? styles.toggleBtnActive : ''}`}
                onClick={() => setType('lab')}
              >
                <FlaskConical size={16} />
                <span>Lab</span>
              </button>
            </div>
          </div>

          {/* ── Lab Sections Batch Setup Callout ── */}
          {type === 'lab' && (
            <div className={styles.labBatchesBox}>
              <div className={styles.labBatchesHeader}>
                <FlaskConical size={18} />
                <span>Lab Subject: Section Batches Required</span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0 }}>
                Teaching assignments for lab subjects must be mapped to distinct student batches within each section.
              </p>

              {selectedSemester ? (
                selectedSemester.sections?.length > 0 ? (
                  <div className={styles.labSectionsList}>
                    {selectedSemester.sections.map((sec) => (
                      <div key={sec._id} className={styles.labSectionRow}>
                        <span className={styles.labSectionName}>
                          <Layers size={14} color="var(--color-primary)" />
                          Section {sec.name} (Cap: {sec.capacity})
                        </span>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => setActiveSectionForBatches(sec)}
                        >
                          <Users size={13} /> Manage Batches
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    No sections created in this semester yet.
                  </div>
                )
              ) : (
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <AlertCircle size={14} />
                  <span>Select a semester above to manage section lab batches.</span>
                </div>
              )}
            </div>
          )}

          <div className={styles.actions}>
            <Button type="button" variant="ghost" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isLoading || !semesterId || !name || !code}
            >
              {isLoading ? 'Adding...' : 'Add Subject'}
            </Button>
          </div>
        </form>
      </Modal>

      {activeSectionForBatches && (
        <ManageBatchesModal
          isOpen={Boolean(activeSectionForBatches)}
          onClose={() => setActiveSectionForBatches(null)}
          section={activeSectionForBatches}
          departmentId={departmentId}
        />
      )}
    </>
  );
}
