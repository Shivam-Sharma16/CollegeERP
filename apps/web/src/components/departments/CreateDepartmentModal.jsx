import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useToast } from '../ui/ToastContext';
import { useCreateDepartmentMutation } from '../../api/departmentsApi';
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
      // Simulate/Parse field-level errors
      // E.g. backend returns { data: { message: 'duplicate key error... code_1 dup key' } }
      // Or { data: { errors: { code: 'Code already exists' } } }
      const errData = err?.data || {};
      const newErrors = {};

      if (errData.errors) {
        // Explicit field errors
        Object.keys(errData.errors).forEach(key => {
          newErrors[key] = errData.errors[key];
        });
      } else if (errData.message && errData.message.toLowerCase().includes('duplicate')) {
        // Fallback for Mongo Duplicate key on 'code'
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
        <div className={styles.field}>
          <label htmlFor="deptName">Department Name</label>
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
            placeholder="e.g. Computer Science"
          />
          {fieldErrors.name && <span className={styles.errorText}>{fieldErrors.name}</span>}
        </div>

        <div className={styles.field}>
          <label htmlFor="deptCode">Department Code</label>
          <input
            id="deptCode"
            className={`${styles.input} ${fieldErrors.code ? styles.inputError : ''}`}
            type="text"
            required
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              if (fieldErrors.code) setFieldErrors({ ...fieldErrors, code: null });
            }}
            disabled={isLoading}
            placeholder="e.g. CS"
          />
          {fieldErrors.code && <span className={styles.errorText}>{fieldErrors.code}</span>}
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
