import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useToast } from '../ui/ToastContext';
import { useCreateDepartmentMutation } from '../../api/departmentsApi';
import { Building2, Hash, Layers } from 'lucide-react';
import styles from './CreateDepartmentModal.module.css';

export function CreateDepartmentModal({ isOpen, onClose }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const { showToast } = useToast();

  const [createDepartment, { isLoading }] = useCreateDepartmentMutation();

  useEffect(() => {
    if (isOpen) {
      setName('');
      setCode('');
      setFieldErrors({});
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFieldErrors({}); // reset errors before submitting

    try {
      await createDepartment({ name, code }).unwrap();
      showToast('Department created successfully', 'success');
      onClose();
    } catch (err) {
      const errData = err?.data || {};
      const newErrors = {};

      if (errData.errors) {
        Object.keys(errData.errors).forEach((key) => {
          newErrors[key] = errData.errors[key];
        });
      } else if (errData.message && errData.message.toLowerCase().includes('duplicate')) {
        if (errData.message.includes('code')) {
          newErrors.code = 'This department code is already in use.';
        } else if (errData.message.includes('name')) {
          newErrors.name = 'This department name is already in use.';
        } else {
          showToast('A duplicate entry error occurred.', 'error');
        }
      } else {
        showToast(errData.message || 'Failed to create department', 'error');
      }

      setFieldErrors(newErrors);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Department">
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formIntro}>
          <div className={styles.introIcon}>
            <Layers size={18} />
          </div>
          <div className={styles.introText}>
            <p className={styles.introTitle}>Academic Department</p>
            <p className={styles.introDesc}>
              Define an academic faculty branch to organize courses, professors, and students.
            </p>
          </div>
        </div>

        <div className={styles.field}>
          <label htmlFor="deptName" className={styles.label}>
            Department Name <span className={styles.required}>*</span>
          </label>
          <div className={styles.inputWithIcon}>
            <Building2 size={16} className={styles.inputIcon} />
            <input
              id="deptName"
              className={`${styles.input} ${fieldErrors.name ? styles.inputError : ''}`}
              type="text"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (fieldErrors.name) setFieldErrors({ ...fieldErrors, name: null });
              }}
              disabled={isLoading}
              placeholder="e.g. Computer Science & Engineering"
            />
          </div>
          {fieldErrors.name && <span className={styles.errorText}>{fieldErrors.name}</span>}
        </div>

        <div className={styles.field}>
          <label htmlFor="deptCode" className={styles.label}>
            Department Code <span className={styles.required}>*</span>
          </label>
          <div className={styles.inputWithIcon}>
            <Hash size={16} className={styles.inputIcon} />
            <input
              id="deptCode"
              className={`${styles.input} ${fieldErrors.code ? styles.inputError : ''}`}
              type="text"
              required
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                if (fieldErrors.code) setFieldErrors({ ...fieldErrors, code: null });
              }}
              disabled={isLoading}
              placeholder="e.g. CSE"
              maxLength={10}
            />
          </div>
          {fieldErrors.code && <span className={styles.errorText}>{fieldErrors.code}</span>}
          <span className={styles.helpText}>Short uppercase identifier used across course codes.</span>
        </div>

        <div className={styles.actions}>
          <Button type="button" variant="ghost" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isLoading}>
            {isLoading ? 'Creating...' : 'Create Department'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
