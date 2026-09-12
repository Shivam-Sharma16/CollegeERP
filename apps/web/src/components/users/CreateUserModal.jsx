import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Copy, Check, User, Mail, Key, Building2, ShieldCheck } from 'lucide-react';
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
        <div className={styles.formIntro}>
          <div className={styles.introIcon}>
            <ShieldCheck size={18} />
          </div>
          <div className={styles.introText}>
            <p className={styles.introTitle}>New {roleLabel} Account</p>
            <p className={styles.introDesc}>
              Provision an institutional account with direct role permissions and initial login credentials.
            </p>
          </div>
        </div>

        {/* Full Name */}
        <div className={styles.field}>
          <label htmlFor="name" className={styles.label}>
            Full Name <span className={styles.required}>*</span>
          </label>
          <div className={styles.inputWithIcon}>
            <User size={16} className={styles.inputIcon} />
            <input
              id="name"
              className={styles.input}
              type="text"
              required
              placeholder="e.g. Prof. Alan Turing"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Email Address */}
        <div className={styles.field}>
          <label htmlFor="email" className={styles.label}>
            Email Address <span className={styles.required}>*</span>
          </label>
          <div className={styles.inputWithIcon}>
            <Mail size={16} className={styles.inputIcon} />
            <input
              id="email"
              className={styles.input}
              type="email"
              required
              placeholder="name@institution.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Department Selection */}
        {showDepartmentSelect && (
          <div className={styles.field}>
            <label htmlFor="department" className={styles.label}>
              Assigned Department <span className={styles.required}>*</span>
            </label>
            {departments.length === 0 ? (
              <div className={styles.warningBox}>
                No departments exist yet. Please configure a department before assigning this role.
              </div>
            ) : (
              <div className={styles.inputWithIcon}>
                <Building2 size={16} className={styles.inputIcon} />
                <select
                  id="department"
                  className={styles.input}
                  required
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  disabled={isLoading}
                >
                  <option value="" disabled>
                    Select Department
                  </option>
                  {departments.map((dept) => (
                    <option key={dept._id} value={dept._id}>
                      {dept.name} ({dept.code})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {disabledDepartmentText && (
          <div className={styles.field}>
            <label className={styles.label}>Assigned Department</label>
            <div className={styles.inputWithIcon}>
              <Building2 size={16} className={styles.inputIcon} />
              <input
                className={styles.input}
                type="text"
                disabled
                value={disabledDepartmentText}
              />
            </div>
          </div>
        )}

        {/* Generated Password Card */}
        <div className={styles.passwordCard}>
          <div className={styles.passwordHeader}>
            <div className={styles.passwordTitleWrap}>
              <Key size={14} className={styles.passwordIcon} />
              <label htmlFor="password" className={styles.passwordLabel}>
                Initial System Password
              </label>
            </div>
            <span className={styles.autoGenBadge}>Auto-Generated</span>
          </div>

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
              variant={copied ? 'primary' : 'secondary'}
              onClick={handleCopy}
              disabled={isLoading}
              className={styles.copyBtn}
              title="Copy credentials to clipboard"
            >
              {copied ? (
                <>
                  <Check size={14} style={{ marginRight: '4px' }} /> Copied
                </>
              ) : (
                <>
                  <Copy size={14} style={{ marginRight: '4px' }} /> Copy
                </>
              )}
            </Button>
          </div>
          <p className={styles.passwordHelp}>
            Secure temporary key. Please copy and provide it to the user upon initial provisioning.
          </p>
        </div>

        {/* Modal Actions */}
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
