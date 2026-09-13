import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useToast } from '../ui/ToastContext';
import { useUpdateUserMutation } from '../../api/usersApi';
import { User, Mail, ShieldCheck, Save, ShieldAlert } from 'lucide-react';
import styles from './CreateUserModal.module.css';

export function EditAdminModal({ isOpen, onClose, admin }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [isActive, setIsActive] = useState(true);

  const { showToast } = useToast();
  const [updateUser, { isLoading }] = useUpdateUserMutation();

  useEffect(() => {
    if (isOpen && admin) {
      setName(admin.name || '');
      setEmail(admin.email || '');
      setIsActive(admin.isActive !== false && admin.status !== 'SUSPENDED');
    }
  }, [isOpen, admin]);

  if (!isOpen || !admin) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      showToast('Name and email are required', 'error');
      return;
    }

    try {
      await updateUser({
        id: admin._id,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        isActive,
        status: isActive ? 'ACTIVE' : 'SUSPENDED',
      }).unwrap();

      showToast(`Admin "${name}" updated successfully`, 'success');
      onClose();
    } catch (err) {
      showToast(err?.data?.message || 'Failed to update admin account', 'error');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Edit Administrator: ${admin.name || ''}`}>
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formIntro}>
          <div className={styles.introIcon}>
            <ShieldCheck size={18} />
          </div>
          <div className={styles.introText}>
            <p className={styles.introTitle}>Modify Administrator Account</p>
            <p className={styles.introDesc}>
              Update credential details, email address, or administrative access status.
            </p>
          </div>
        </div>

        {/* Full Name */}
        <div className={styles.field}>
          <label htmlFor="edit-admin-name" className={styles.label}>
            Full Name <span className={styles.required}>*</span>
          </label>
          <div className={styles.inputWithIcon}>
            <User size={16} className={styles.inputIcon} />
            <input
              id="edit-admin-name"
              className={styles.input}
              type="text"
              required
              placeholder="e.g. Dr. John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Email Address */}
        <div className={styles.field}>
          <label htmlFor="edit-admin-email" className={styles.label}>
            Email Address <span className={styles.required}>*</span>
          </label>
          <div className={styles.inputWithIcon}>
            <Mail size={16} className={styles.inputIcon} />
            <input
              id="edit-admin-email"
              className={styles.input}
              type="email"
              required
              placeholder="admin@college.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Account Status */}
        <div className={styles.field}>
          <label htmlFor="edit-admin-status" className={styles.label}>
            Account Access Status
          </label>
          <select
            id="edit-admin-status"
            className={styles.input}
            value={isActive ? 'ACTIVE' : 'SUSPENDED'}
            onChange={(e) => setIsActive(e.target.value === 'ACTIVE')}
            disabled={isLoading}
            style={{ height: '40px' }}
          >
            <option value="ACTIVE">Active (Permitted to Log In)</option>
            <option value="SUSPENDED">Suspended (Access Blocked)</option>
          </select>
        </div>

        {/* Form Actions */}
        <div className={styles.actions}>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isLoading}>
            <Save size={15} />
            {isLoading ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
