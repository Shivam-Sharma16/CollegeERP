import { useState, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useToast } from '../ui/ToastContext';
import { useCreateSectionAssignmentMutation } from '../../api/teachingApi';
import { useResolveDeptTreeQuery } from '../../api/departmentsApi';
import styles from './TeachingAssignmentModal.module.css'; // Reuse styles

export function SectionAssignmentModal({ isOpen, onClose, cc }) {
  const [sectionId, setSectionId] = useState('');
  const { showToast } = useToast();

  const { data: deptData, isLoading: isLoadingDepts } = useResolveDeptTreeQuery();
  const [assignSection, { isLoading: isAssigning }] = useCreateSectionAssignmentMutation();

  const sections = useMemo(() => {
    const list = [];
    if (!deptData?.data?.departments) return list;

    deptData.data.departments.forEach(dept => {
      dept.years?.forEach(year => {
        year.semesters?.forEach(sem => {
          sem.sections?.forEach(sec => {
            list.push({ ...sec, _label: `${sec.name} - Year ${year.year} Sem ${sem.semester}` });
          });
        });
      });
    });

    return Array.from(new Map(list.map(s => [s._id, s])).values());
  }, [deptData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!sectionId) return;

    try {
      await assignSection({
        facultyId: cc._id, // Faculty and CC are technically same collection conceptually in assignment API
        sectionId,
        validFrom: new Date().toISOString()
      }).unwrap();
      
      showToast('CC assigned to section successfully', 'success');
      onClose();
    } catch (err) {
      showToast(err?.data?.message || 'Failed to assign section', 'error');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Assign CC to Section">
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.facultyInfo}>
          <p><strong>Class Coordinator:</strong> {cc?.name}</p>
        </div>

        <div className={styles.field}>
          <label htmlFor="section">Section</label>
          <select
            id="section"
            className={styles.input}
            required
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
            disabled={isLoadingDepts || isAssigning}
          >
            <option value="" disabled>Select a section</option>
            {sections.map(sec => (
              <option key={sec._id} value={sec._id}>{sec._label}</option>
            ))}
          </select>
        </div>

        <div className={styles.actions}>
          <Button type="button" variant="ghost" onClick={onClose} disabled={isAssigning}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isAssigning || !sectionId}>
            {isAssigning ? 'Assigning...' : 'Confirm Assignment'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
