import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useToast } from '../ui/ToastContext';
import { useCreateDepartmentMutation } from '../../api/departmentsApi';
import { useListHodsQuery, useListFacultyQuery } from '../../api/usersApi';
import { Building2, Hash, Layers, Mail, Phone, FileText, UserCheck } from 'lucide-react';
import styles from './CreateDepartmentModal.module.css';

export function CreateDepartmentModal({ isOpen, onClose }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [hodId, setHodId] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const { showToast } = useToast();

  const [createDepartment, { isLoading }] = useCreateDepartmentMutation();
  const { data: hodsData } = useListHodsQuery(undefined, { skip: !isOpen });
  const { data: facultyData } = useListFacultyQuery(undefined, { skip: !isOpen });

  const potentialHods = [
    ...(hodsData?.data || []),
    ...(facultyData?.data || [])
  ].filter((user, index, self) => index === self.findIndex(u => u._id === user._id));

  useEffect(() => {
    if (isOpen) {
      setName('');
      setCode('');
      setDescription('');
      setContactEmail('');
      setContactPhone('');
      setHodId('');
      setFieldErrors({});
    }
  }, [isOpen]);

  const validateForm = () => {
    const errors = {};
    const trimmedName = name.trim();
    const trimmedCode = code.trim().toUpperCase();
    const trimmedPhone = contactPhone.trim();
    const trimmedEmail = contactEmail.trim();
    const trimmedDesc = description.trim();

    // Name validation
    if (!trimmedName) {
      errors.name = 'Department name is required.';
    } else if (trimmedName.length < 2) {
      errors.name = 'Department name must be at least 2 characters.';
    } else if (trimmedName.length > 100) {
      errors.name = 'Department name cannot exceed 100 characters.';
    }

    // Code validation
    if (!trimmedCode) {
      errors.code = 'Department code is required.';
    } else if (trimmedCode.length < 2 || trimmedCode.length > 10) {
      errors.code = 'Department code must be 2 to 10 characters.';
    } else if (!/^[A-Z0-9_-]+$/.test(trimmedCode)) {
      errors.code = 'Department code can only contain uppercase letters, numbers, hyphens, and underscores.';
    }

    // Description validation
    if (trimmedDesc.length > 500) {
      errors.description = 'Description cannot exceed 500 characters.';
    }

    // Contact Email validation
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errors.contactEmail = 'Please enter a valid email address (e.g. dept@college.edu).';
    }

    // Contact Phone validation (must be exactly 10 digits if provided)
    if (trimmedPhone) {
      if (!/^\d{10}$/.test(trimmedPhone)) {
        errors.contactPhone = 'Contact phone number must be exactly 10 digits.';
      }
    }

    return errors;
  };

  const handlePhoneChange = (e) => {
    // Only allow numbers and limit strictly to at most 10 digits
    const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 10);
    setContactPhone(digitsOnly);
    if (fieldErrors.contactPhone) {
      setFieldErrors((prev) => ({ ...prev, contactPhone: null }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      return;
    }

    setFieldErrors({});

    try {
      await createDepartment({
        name: name.trim(),
        code: code.trim().toUpperCase(),
        description: description.trim(),
        contactEmail: contactEmail.trim().toLowerCase(),
        contactPhone: contactPhone.trim(),
        hodId: hodId || undefined
      }).unwrap();

      showToast('Department created successfully', 'success');
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
        showToast(errData.error || errData.message || 'Failed to create department', 'error');
      }

      setFieldErrors(newErrors);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Department">
      <form onSubmit={handleSubmit} className={styles.form} noValidate>
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
              maxLength={100}
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
          <span className={styles.helpText}>Short uppercase identifier (2-10 characters) unique within your college.</span>
        </div>

        <div className={styles.field}>
          <label htmlFor="deptDesc" className={styles.label}>
            Description
          </label>
          <div className={styles.inputWithIcon}>
            <FileText size={16} className={styles.inputIcon} />
            <input
              id="deptDesc"
              className={`${styles.input} ${fieldErrors.description ? styles.inputError : ''}`}
              type="text"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (fieldErrors.description) setFieldErrors({ ...fieldErrors, description: null });
              }}
              disabled={isLoading}
              placeholder="e.g. Department focused on software systems and computing"
              maxLength={500}
            />
          </div>
          {fieldErrors.description && <span className={styles.errorText}>{fieldErrors.description}</span>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-3)' }}>
          <div className={styles.field}>
            <label htmlFor="deptEmail" className={styles.label}>
              Contact Email
            </label>
            <div className={styles.inputWithIcon}>
              <Mail size={16} className={styles.inputIcon} />
              <input
                id="deptEmail"
                className={`${styles.input} ${fieldErrors.contactEmail ? styles.inputError : ''}`}
                type="email"
                value={contactEmail}
                onChange={(e) => {
                  setContactEmail(e.target.value);
                  if (fieldErrors.contactEmail) setFieldErrors({ ...fieldErrors, contactEmail: null });
                }}
                disabled={isLoading}
                placeholder="dept@college.edu"
              />
            </div>
            {fieldErrors.contactEmail && <span className={styles.errorText}>{fieldErrors.contactEmail}</span>}
          </div>

          <div className={styles.field}>
            <label htmlFor="deptPhone" className={styles.label}>
              Contact Phone
            </label>
            <div className={styles.inputWithIcon}>
              <Phone size={16} className={styles.inputIcon} />
              <input
                id="deptPhone"
                className={`${styles.input} ${fieldErrors.contactPhone ? styles.inputError : ''}`}
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={contactPhone}
                onChange={handlePhoneChange}
                disabled={isLoading}
                placeholder="10-digit phone (e.g. 9876543210)"
              />
            </div>
            {fieldErrors.contactPhone && <span className={styles.errorText}>{fieldErrors.contactPhone}</span>}
          </div>
        </div>

        <div className={styles.field}>
          <label htmlFor="deptHod" className={styles.label}>
            Assign Head of Department (HOD)
          </label>
          <div className={styles.inputWithIcon}>
            <UserCheck size={16} className={styles.inputIcon} />
            <select
              id="deptHod"
              className={styles.input}
              value={hodId}
              onChange={(e) => setHodId(e.target.value)}
              disabled={isLoading}
              style={{ appearance: 'auto', paddingLeft: '38px' }}
            >
              <option value="">-- No HOD assigned (assign later) --</option>
              {potentialHods.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
          </div>
          <span className={styles.helpText}>You can also appoint or reassign an HOD at any time.</span>
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

