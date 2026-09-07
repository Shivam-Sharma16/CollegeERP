import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useToast } from '../ui/ToastContext';
import { useCreateSectionMutation } from '../../api/academicApi';
import styles from './CreateSubjectModal.module.css'; // Reusing styles

export function CreateSectionModal({ isOpen, onClose, semester, departmentId }) {
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState('60');
  const { showToast } = useToast();

  const [createSection, { isLoading }] = useCreateSectionMutation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await createSection({
        departmentId,
        semesterId: semester._id,
        name,
        capacity: parseInt(capacity, 10)
      }).unwrap();
      
      showToast(`Section ${name} added successfully`, 'success');
      setName('');
      setCapacity('60');
      onClose();
    } catch (err) {
      showToast(err?.data?.message || 'Failed to add section', 'error');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Section">
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.infoBox}>
          Adding to <strong>Semester {semester?.semester}</strong>
        </div>

        <div className={styles.field}>
          <label htmlFor="name">Section Name</label>
          <input
            id="name"
            className={styles.input}
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isLoading}
            placeholder="e.g. A, B, C"
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="capacity">Capacity</label>
          <input
            id="capacity"
            className={styles.input}
            type="number"
            min="1"
            required
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            disabled={isLoading}
          />
        </div>

        <div className={styles.actions}>
          <Button type="button" variant="ghost" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isLoading || !name}>
            {isLoading ? 'Adding...' : 'Add Section'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
