import { useState, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useToast } from '../ui/ToastContext';
import { useCreateTeachingAssignmentMutation } from '../../api/teachingApi';
import { useResolveDeptTreeQuery } from '../../api/departmentsApi';
import styles from './TeachingAssignmentModal.module.css';

export function TeachingAssignmentModal({ isOpen, onClose, faculty }) {
  const [subjectId, setSubjectId] = useState('');
  const { showToast } = useToast();

  const { data: deptData, isLoading: isLoadingDepts } = useResolveDeptTreeQuery();
  const [assignSubject, { isLoading: isAssigning }] = useCreateTeachingAssignmentMutation();

  const subjects = useMemo(() => {
    const list = [];
    if (!deptData?.data?.departments) return list;

    deptData.data.departments.forEach(dept => {
      dept.years?.forEach(year => {
        year.semesters?.forEach(sem => {
          sem.subjects?.forEach(sub => {
            list.push({ ...sub, _label: `${sub.name} (${sub.code}) - Year ${year.year} Sem ${sem.semester}` });
          });
        });
      });
    });

    return Array.from(new Map(list.map(s => [s._id, s])).values());
  }, [deptData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subjectId) return;

    try {
      await assignSubject({
        facultyId: faculty._id,
        subjectId,
        validFrom: new Date().toISOString()
      }).unwrap();
      
      showToast('Subject assigned to faculty successfully', 'success');
      onClose();
    } catch (err) {
      showToast(err?.data?.message || 'Failed to assign subject', 'error');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Assign Subject">
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.facultyInfo}>
          <p><strong>Faculty:</strong> {faculty?.name}</p>
        </div>

        <div className={styles.field}>
          <label htmlFor="subject">Subject</label>
          <select
            id="subject"
            className={styles.input}
            required
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            disabled={isLoadingDepts || isAssigning}
          >
            <option value="" disabled>Select a subject</option>
            {subjects.map(sub => (
              <option key={sub._id} value={sub._id}>{sub._label}</option>
            ))}
          </select>
        </div>

        <div className={styles.actions}>
          <Button type="button" variant="ghost" onClick={onClose} disabled={isAssigning}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isAssigning || !subjectId}>
            {isAssigning ? 'Assigning...' : 'Confirm Assignment'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
