import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useToast } from '../ui/ToastContext';
import { useUpdateUserMutation, useGetUserQuery } from '../../api/usersApi';
import { useListDepartmentsQuery } from '../../api/departmentsApi';
import { User, Mail, Phone, Building2, Key, ShieldCheck } from 'lucide-react';
import styles from './EditHodModal.module.css';

export function EditHodModal({ isOpen, onClose, hod }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [password, setPassword] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [fieldErrors, setFieldErrors] = useState({});
  const { showToast } = useToast();

  const [updateUser, { isLoading }] = useUpdateUserMutation();
  const { data: deptsRes } = useListDepartmentsQuery(undefined, { skip: !isOpen });
  const { data: userDetails } = useGetUserQuery(hod?._id, {
    skip: !isOpen || !hod?._id,
  });

  const departments = deptsRes?.data || [];

  useEffect(() => {
    if (hod && isOpen) {
      const current = userDetails || hod;
      setName(current.name || '');
      setEmail(current.email || '');
      setPhone(current.phone || '');
      setDepartmentId(current.departmentId?._id || current.departmentId || '');
      setIsActive(current.isActive !== false);
      setPassword('');
      setFieldErrors({});
    }
  }, [hod, userDetails, isOpen]);

  const validateForm = () => {
    const errors = {};
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPhone = phone.trim();

    if (!trimmedName) {
      errors.name = 'Full name is required.';
    } else if (trimmedName.length < 2) {
      errors.name = 'Name must be at least 2 characters.';
    } else if (trimmedName.length > 100) {
      errors.name = 'Name cannot exceed 100 characters.';
    }

    if (!trimmedEmail) {
      errors.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errors.email = 'Please enter a valid email address.';
    }

    if (trimmedPhone) {
      if (!/^\d{10}$/.test(trimmedPhone)) {
        errors.phone = 'Phone number must be exactly 10 digits.';
      }
    }

    if (password && password.length < 6) {
      errors.password = 'New password must be at least 6 characters.';
    }

    return errors;
  };

  const handlePhoneChange = (e) => {
    const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 10);
    setPhone(digitsOnly);
    if (fieldErrors.phone) {
      setFieldErrors((prev) => ({ ...prev, phone: null }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!hod) return;

    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      return;
    }

    setFieldErrors({});

    try {
      const payload = {
        id: hod._id,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        departmentId: departmentId || null,
        isActive,
      };

      if (password) {
        payload.password = password;
      }

      await updateUser(payload).unwrap();

      showToast(`HOD ${name.trim()} updated successfully`, 'success');
      onClose();
    } catch (err) {
      const errData = err?.data || {};
      const newErrors = {};

      if (errData.error && errData.error.toLowerCase().includes('email')) {
        newErrors.email = errData.error;
      } else if (errData.message && errData.message.toLowerCase().includes('email')) {
        newErrors.email = errData.message;
      } else {
        showToast(
          errData.error || errData.message || 'Failed to update HOD profile',
          'error'
        );
      }

      setFieldErrors(newErrors);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Head of Department">
      <form onSubmit={handleSubmit} className={styles.form} noValidate>
        <div className={styles.formIntro}>
          <div className={styles.introIcon}>
            <ShieldCheck size={18} />
          </div>
          <div className={styles.introText}>
            <p className={styles.introTitle}>Modify HOD Account</p>
            <p className={styles.introDesc}>
              Update personal information, contact phone, department assignment, and active status.
            </p>
          </div>
        </div>

        {/* Full Name */}
        <div className={styles.field}>
          <label htmlFor="hodName" className={styles.label}>
            Full Name <span className={styles.required}>*</span>
          </label>
          <div className={styles.inputWithIcon}>
            <User size={16} className={styles.inputIcon} />
            <input
              id="hodName"
              className={`${styles.input} ${fieldErrors.name ? styles.inputError : ''}`}
              type="text"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (fieldErrors.name) setFieldErrors({ ...fieldErrors, name: null });
              }}
              disabled={isLoading}
              placeholder="e.g. Dr. Ada Lovelace"
              maxLength={100}
            />
          </div>
          {fieldErrors.name && <span className={styles.errorText}>{fieldErrors.name}</span>}
        </div>

        {/* Email & Phone */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-3)' }}>
          <div className={styles.field}>
            <label htmlFor="hodEmail" className={styles.label}>
              Email Address <span className={styles.required}>*</span>
            </label>
            <div className={styles.inputWithIcon}>
              <Mail size={16} className={styles.inputIcon} />
              <input
                id="hodEmail"
                className={`${styles.input} ${fieldErrors.email ? styles.inputError : ''}`}
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: null });
                }}
                disabled={isLoading}
                placeholder="hod@college.edu"
              />
            </div>
            {fieldErrors.email && <span className={styles.errorText}>{fieldErrors.email}</span>}
          </div>

          <div className={styles.field}>
            <label htmlFor="hodPhone" className={styles.label}>
              Contact Phone
            </label>
            <div className={styles.inputWithIcon}>
              <Phone size={16} className={styles.inputIcon} />
              <input
                id="hodPhone"
                className={`${styles.input} ${fieldErrors.phone ? styles.inputError : ''}`}
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={phone}
                onChange={handlePhoneChange}
                disabled={isLoading}
                placeholder="10-digit number"
              />
            </div>
            {fieldErrors.phone && <span className={styles.errorText}>{fieldErrors.phone}</span>}
          </div>
        </div>

        {/* Department Assignment */}
        <div className={styles.field}>
          <label htmlFor="hodDept" className={styles.label}>
            Assigned Department
          </label>
          <div className={styles.inputWithIcon}>
            <Building2 size={16} className={styles.inputIcon} />
            <select
              id="hodDept"
              className={styles.input}
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              disabled={isLoading}
              style={{ appearance: 'auto', paddingLeft: '38px' }}
            >
              <option value="">-- No Department assigned (Unassign) --</option>
              {departments.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
          </div>
          <span className={styles.helpText}>Reassigning this HOD will update the leadership of the selected department.</span>
        </div>

        {/* Optional Password Reset */}
        <div className={styles.field}>
          <label htmlFor="hodPassword" className={styles.label}>
            Reset Password (Optional)
          </label>
          <div className={styles.inputWithIcon}>
            <Key size={16} className={styles.inputIcon} />
            <input
              id="hodPassword"
              className={`${styles.input} ${fieldErrors.password ? styles.inputError : ''}`}
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) setFieldErrors({ ...fieldErrors, password: null });
              }}
              disabled={isLoading}
              placeholder="Leave blank to keep existing password"
              autoComplete="new-password"
            />
          </div>
          {fieldErrors.password && <span className={styles.errorText}>{fieldErrors.password}</span>}
        </div>

        {/* Active Status Toggle */}
        <div className={styles.statusRow}>
          <div className={styles.statusLabel}>
            <p className={styles.statusTitle}>HOD Account Status</p>
            <p className={styles.statusDesc}>
              {isActive
                ? 'Account is active. HOD can log in and manage staff.'
                : 'Account is deactivated. Login and permissions are suspended.'}
            </p>
          </div>
          <label className={styles.switch}>
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              disabled={isLoading}
            />
            <span className={styles.slider}></span>
          </label>
        </div>

        {/* Action Buttons */}
        <div className={styles.actions}>
          <Button type="button" variant="ghost" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isLoading}>
            {isLoading ? 'Saving Changes...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
