import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Copy, Check } from 'lucide-react';
import { useToast } from '../ui/ToastContext';
import styles from './CreateUserModal.module.css';

/**
 * Generates an 8-character random password.
 */
function generatePassword() {
  return Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-2).toUpperCase();
}

/**
 * Base Create User Modal
 */
export function CreateUserModal({
  isOpen,
  onClose,
  title,
  roleLabel,
  useMutationHook,
  showDepartmentSelect = false,
  departments = [],
  disabledDepartmentText = null,
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [copied, setCopied] = useState(false);
  const { showToast } = useToast();

  const [createUser, { isLoading }] = useMutationHook();

  // Reset form and generate new password when modal opens
  useEffect(() => {
    if (isOpen) {
      setName('');
      setEmail('');
      setPassword(generatePassword());
      setDepartmentId('');
      setCopied(false);
    }
  }, [isOpen]);

  const handleCopy = () => {
    navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { name, email, password };
      if (showDepartmentSelect) {
        payload.departmentId = departmentId;
      }
      // Note: disabledDepartmentText implies backend auto-scopes it, so no departmentId sent
      
      await createUser(payload).unwrap();
      showToast(`${roleLabel} created successfully`, 'success');
      onClose();
    } catch (err) {
      showToast(err?.data?.message || `Failed to create ${roleLabel}`, 'error');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
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
            className={styles.input}
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
          />
        </div>

        {showDepartmentSelect && (
          <div className={styles.field}>
            <label htmlFor="department">Department</label>
            {departments.length === 0 ? (
              <div style={{ padding: '12px', background: 'color-mix(in srgb, var(--color-warning) 15%, transparent)', color: 'var(--color-warning)', borderRadius: 'var(--radius-sm)', fontSize: '14px', border: '1px solid color-mix(in srgb, var(--color-warning) 30%, transparent)' }}>
                No departments exist yet. Please contact a SuperAdmin to create a department before assigning an HOD.
              </div>
            ) : (
              <select
                id="department"
                className={styles.input}
                required
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                disabled={isLoading}
              >
                <option value="" disabled>Select Department</option>
                {departments.map((dept) => (
                  <option key={dept._id} value={dept._id}>
                    {dept.name} ({dept.code})
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {disabledDepartmentText && (
          <div className={styles.field}>
            <label>Department</label>
            <input
              className={styles.input}
              type="text"
              disabled
              value={disabledDepartmentText}
            />
          </div>
        )}

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
          <Button 
            type="submit" 
            variant="primary" 
            disabled={isLoading || (showDepartmentSelect && departments.length === 0)}
          >
            {isLoading ? 'Creating...' : `Create ${roleLabel}`}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
