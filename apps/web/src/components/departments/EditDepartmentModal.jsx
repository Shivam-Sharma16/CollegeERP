import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useToast } from '../ui/ToastContext';
import { useUpdateDepartmentMutation } from '../../api/departmentsApi';
import { useListHodsQuery, useListFacultyQuery } from '../../api/usersApi';
import { Building2, Hash, Layers, Mail, Phone, FileText, UserCheck } from 'lucide-react';
import styles from './EditDepartmentModal.module.css';

export function EditDepartmentModal({ isOpen, onClose, department }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [hodId, setHodId] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const { showToast } = useToast();

  const [updateDepartment, { isLoading }] = useUpdateDepartmentMutation();
  const { data: hodsData } = useListHodsQuery(undefined, { skip: !isOpen });
  const { data: facultyData } = useListFacultyQuery(undefined, { skip: !isOpen });

  const potentialHods = [
    ...(hodsData?.data || []),
    ...(facultyData?.data || [])
  ].filter((user, index, self) => index === self.findIndex(u => u._id === user._id));

  useEffect(() => {
    if (department && isOpen) {
      setName(department.name || '');
      setCode(department.code || '');
      setDescription(department.description || '');
      setContactEmail(department.contactEmail || '');
      setContactPhone(department.contactPhone || '');
      setIsActive(department.isActive !== false);
      setHodId(department.hod?._id || '');
      setFieldErrors({});
    }
  }, [department, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!department) return;
    setFieldErrors({});

    try {
      await updateDepartment({
        id: department._id,
        name,
        code,
        description,
        contactEmail,
        contactPhone,
        isActive,
        hodId: hodId || null
      }).unwrap();

      showToast('Department updated successfully', 'success');
      onClose();
    } catch (err) {
      const errData = err?.data || {};
      const newErrors = {};

      if (errData.errors) {
        Object.keys(errData.errors).forEach((key) => {
          newErrors[key] = errData.errors[key];
        });
      } else if (errData.error && errData.error.toLowerCase().includes('already exists')) {
        newErrors.code = 'This department code is already in use in your institution.';
      } else if (errData.message && errData.message.toLowerCase().includes('duplicate')) {
        if (errData.message.includes('code')) {
          newErrors.code = 'This department code is already in use in your institution.';
        } else if (errData.message.includes('name')) {
          newErrors.name = 'This department name is already in use in your institution.';
        } else {
          showToast('A duplicate entry error occurred.', 'error');
        }
      } else {
        showToast(errData.error || errData.message || 'Failed to update department', 'error');
      }

      setFieldErrors(newErrors);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Department">
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formIntro}>
          <div className={styles.introIcon}>
            <Layers size={18} />
          </div>
          <div className={styles.introText}>
            <p className={styles.introTitle}>Configure Department</p>
            <p className={styles.introDesc}>
              Update department details, active availability status, and HOD leadership.
            </p>
          </div>
        </div>

        <div className={styles.field}>
          <label htmlFor="editDeptName" className={styles.label}>
            Department Name <span className={styles.required}>*</span>
          </label>
          <div className={styles.inputWithIcon}>
            <Building2 size={16} className={styles.inputIcon} />
            <input
              id="editDeptName"
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
          <label htmlFor="editDeptCode" className={styles.label}>
            Department Code <span className={styles.required}>*</span>
          </label>
          <div className={styles.inputWithIcon}>
            <Hash size={16} className={styles.inputIcon} />
            <input
              id="editDeptCode"
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
        </div>

        <div className={styles.field}>
          <label htmlFor="editDeptDesc" className={styles.label}>
            Description
          </label>
          <div className={styles.inputWithIcon}>
            <FileText size={16} className={styles.inputIcon} />
            <input
              id="editDeptDesc"
              className={styles.input}
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isLoading}
              placeholder="e.g. Department focused on software systems and computing"
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-3)' }}>
          <div className={styles.field}>
            <label htmlFor="editDeptEmail" className={styles.label}>
              Contact Email
            </label>
            <div className={styles.inputWithIcon}>
              <Mail size={16} className={styles.inputIcon} />
              <input
                id="editDeptEmail"
                className={styles.input}
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                disabled={isLoading}
                placeholder="dept@college.edu"
              />
            </div>
          </div>

          <div className={styles.field}>
            <label htmlFor="editDeptPhone" className={styles.label}>
              Contact Phone
            </label>
            <div className={styles.inputWithIcon}>
              <Phone size={16} className={styles.inputIcon} />
              <input
                id="editDeptPhone"
                className={styles.input}
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                disabled={isLoading}
                placeholder="+1 555 0199"
              />
            </div>
          </div>
        </div>

        <div className={styles.field}>
          <label htmlFor="editDeptHod" className={styles.label}>
            Head of Department (HOD)
          </label>
          <div className={styles.inputWithIcon}>
            <UserCheck size={16} className={styles.inputIcon} />
            <select
              id="editDeptHod"
              className={styles.input}
              value={hodId}
              onChange={(e) => setHodId(e.target.value)}
              disabled={isLoading}
              style={{ appearance: 'auto', paddingLeft: '38px' }}
            >
              <option value="">-- No HOD assigned --</option>
              {potentialHods.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Active status toggle switch */}
        <div className={styles.statusRow}>
          <div className={styles.statusLabel}>
            <p className={styles.statusTitle}>Department Status</p>
            <p className={styles.statusDesc}>
              {isActive ? 'Department is active and accepting registrations/enrollments.' : 'Department is inactive and hidden from new enrollments.'}
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
