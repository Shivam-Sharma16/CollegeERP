import { useState, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useToast } from '../ui/ToastContext';
import { useCreateSubjectMutation } from '../../api/academicApi';
import styles from './CreateSubjectModal.module.css';

export function CreateSubjectModal({ isOpen, onClose, departmentId, department }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [credits, setCredits] = useState('3');
  const [type, setType] = useState('CORE');
  const [semesterId, setSemesterId] = useState('');

  const { showToast } = useToast();
  const [createSubject, { isLoading }] = useCreateSubjectMutation();

  const semestersList = useMemo(() => {
    const list = [];
    if (!department) return list;
    department.years?.forEach(year => {
      year.semesters?.forEach(sem => {
        list.push({ _id: sem._id, label: `Year ${year.year} - Semester ${sem.semester}` });
      });
    });
    return list;
  }, [department]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await createSubject({
        departmentId,
        semesterId,
        name,
        code,
        credits: parseInt(credits, 10),
        type
      }).unwrap();
      
      showToast(`Subject ${code} added successfully`, 'success');
      setName('');
      setCode('');
      setCredits('3');
      setType('CORE');
      setSemesterId('');
      onClose();
    } catch (err) {
      showToast(err?.data?.message || 'Failed to add subject', 'error');
    }
  };

  return (
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
            <option value="" disabled>Select a semester...</option>
            {semestersList.map(sem => (
              <option key={sem._id} value={sem._id}>{sem.label}</option>
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
            placeholder="e.g. Intro to Computer Science"
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="type">Subject Type</label>
          <select
            id="type"
            className={styles.input}
            required
            value={type}
            onChange={(e) => setType(e.target.value)}
            disabled={isLoading}
          >
            <option value="CORE">CORE</option>
            <option value="ELECTIVE">ELECTIVE</option>
            <option value="LAB">LAB</option>
          </select>
        </div>

        <div className={styles.actions}>
          <Button type="button" variant="ghost" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isLoading || !semesterId || !name || !code}>
            {isLoading ? 'Adding...' : 'Add Subject'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
