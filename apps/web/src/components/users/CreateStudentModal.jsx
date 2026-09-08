import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Copy, Check } from 'lucide-react';
import { useToast } from '../ui/ToastContext';
import { useOnboardStudentMutation } from '../../api/usersApi';
import { useGetMySectionQuery } from '../../api/academicApi';
import styles from './CreateUserModal.module.css'; // Reusing styles

function generatePassword() {
  return Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-2).toUpperCase();
}

export function CreateStudentModal({ isOpen, onClose }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [password, setPassword] = useState('');
  const [copied, setCopied] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  const { showToast } = useToast();
  const [onboardStudent, { isLoading }] = useOnboardStudentMutation();
  const { data: sectionData } = useGetMySectionQuery();
  const sectionName = sectionData?.data?.name || 'Loading...';

  useEffect(() => {
    if (isOpen) {
      setName('');
      setEmail('');
      setRollNumber('');
      setPassword(generatePassword());
      setCopied(false);
      setFieldErrors({});
    }
  }, [isOpen]);

  const handleCopy = () => {
    navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFieldErrors({}); // clear errors
    
    try {
      await onboardStudent({ name, email, rollNumber, password }).unwrap();
      showToast('Student onboarded successfully', 'success');
      onClose();
    } catch (err) {
      if (err?.data?.data?.field) {
        setFieldErrors({ [err.data.data.field]: err.data.error || err.data.message });
      } else {
        showToast(err?.data?.error || err?.data?.message || 'Failed to onboard student', 'error');
      }
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Onboard Student">
      <form onSubmit={handleSubmit} className={styles.form}>
        
        <div className={styles.field}>
          <label htmlFor="name">Full Name</label>
          <input
            id="name"
            className={styles.input}
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isLoading}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="email">Email Address</label>
          <input
            id="email"
            className={`${styles.input} ${fieldErrors.email ? styles.inputError : ''}`}
            type="email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setFieldErrors(prev => ({ ...prev, email: null }));
            }}
            disabled={isLoading}
          />
          {fieldErrors.email && <span className={styles.errorText} style={{color: 'var(--danger-500)', fontSize: '12px'}}>{fieldErrors.email}</span>}
        </div>

        <div className={styles.field}>
          <label htmlFor="rollNumber">Roll Number</label>
          <input
            id="rollNumber"
            className={`${styles.input} ${fieldErrors.rollNumber ? styles.inputError : ''}`}
            type="text"
            required
            value={rollNumber}
            onChange={(e) => {
              setRollNumber(e.target.value);
              setFieldErrors(prev => ({ ...prev, rollNumber: null }));
            }}
            disabled={isLoading}
          />
          {fieldErrors.rollNumber && <span className={styles.errorText} style={{color: 'var(--danger-500)', fontSize: '12px'}}>{fieldErrors.rollNumber}</span>}
        </div>

        <div className={styles.field}>
          <label>Role</label>
          <input
            className={styles.input}
            type="text"
            disabled
            value="Student"
          />
        </div>

        <div className={styles.field}>
          <label>Section</label>
          <input
            className={styles.input}
            type="text"
            disabled
            value={sectionName}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="password">Temporary Password</label>
          <div className={styles.passwordWrap}>
            <input
              id="password"
              className={`${styles.input} ${styles.passwordInput}`}
              type="text"
              readOnly
              value={password}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={handleCopy}
              disabled={isLoading}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </Button>
          </div>
          <small style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>
            Copy this password. It will not be shown again.
          </small>
        </div>

        <div className={styles.actions}>
          <Button type="button" variant="ghost" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isLoading}>
            {isLoading ? 'Onboarding...' : 'Onboard Student'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
