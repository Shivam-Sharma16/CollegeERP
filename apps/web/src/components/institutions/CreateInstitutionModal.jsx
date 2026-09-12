import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useToast } from '../ui/ToastContext';
import { useCreateInstitutionMutation } from '../../api/institutionsApi';
import styles from './CreateInstitutionModal.module.css';

export function CreateInstitutionModal({ isOpen, onClose }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [slug, setSlug] = useState('');
  const [domain, setDomain] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#4f46e5');
  const [secondaryColor, setSecondaryColor] = useState('#06b6d4');
  const [logoUrl, setLogoUrl] = useState('');

  // Initial Admin
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  const [fieldErrors, setFieldErrors] = useState({});
  const toastContext = useToast();
  const triggerToast = (msg, type = 'info') => {
    if (toastContext?.showToast) {
      toastContext.showToast(msg, type);
    } else if (toastContext?.addToast) {
      toastContext.addToast({ type, title: type === 'error' ? 'Error' : 'Success', message: msg });
    }
  };

  const [createInstitution, { isLoading }] = useCreateInstitutionMutation();

  useEffect(() => {
    if (isOpen) {
      setName('');
      setCode('');
      setSlug('');
      setDomain('');
      setPrimaryColor('#4f46e5');
      setSecondaryColor('#06b6d4');
      setLogoUrl('');
      setAdminName('');
      setAdminEmail('');
      setAdminPassword('');
      setFieldErrors({});
    }
  }, [isOpen]);

  const handleNameChange = (val) => {
    setName(val);
    // Auto-generate slug and code if user hasn't typed their own
    const generatedSlug = val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    setSlug(generatedSlug);

    const generatedCode = val
      .split(' ')
      .filter(Boolean)
      .map(w => w[0])
      .join('')
      .toUpperCase();
    if (!code || code === '') {
      setCode(generatedCode);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFieldErrors({});

    if (!name || !code || !slug) {
      setFieldErrors({ name: 'Institution name, code, and slug are required' });
      return;
    }

    if (!adminName || !adminEmail || !adminPassword) {
      setFieldErrors({ admin: 'Admin name, email, and password are required' });
      return;
    }

    try {
      const payload = {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        slug: slug.trim().toLowerCase(),
        domain: domain ? domain.trim() : null,
        branding: {
          logoUrl: logoUrl.trim(),
          primaryColor,
          secondaryColor,
        },
        admin: {
          name: adminName.trim(),
          email: adminEmail.trim(),
          password: adminPassword,
        },
      };

      const res = await createInstitution(payload).unwrap();
      const createdSlug = res?.data?.institution?.slug || res?.institution?.slug || slug;
      triggerToast(`Institution created! Whitelabel Portal: /inst/${createdSlug}/login`, 'success');
      onClose();
    } catch (err) {
      const msg = err?.data?.message || err?.data?.error || err?.message || 'Failed to create institution';
      triggerToast(msg, 'error');
      setFieldErrors({ form: msg });
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Institution">
      <form onSubmit={handleSubmit} className={styles.form}>
        {fieldErrors.form && <div className={styles.alertError}>{fieldErrors.form}</div>}

        <div className={styles.sectionTitle}>🏫 Institution Information</div>
        <div className={styles.grid2}>
          <div className={styles.field}>
            <label htmlFor="instName">Institution Name *</label>
            <input
              id="instName"
              className={styles.input}
              type="text"
              required
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              disabled={isLoading}
              placeholder="e.g. Apex Institute of Technology"
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="instCode">Code *</label>
            <input
              id="instCode"
              className={styles.input}
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              disabled={isLoading}
              placeholder="e.g. AIT"
            />
          </div>
        </div>

        <div className={styles.grid2}>
          <div className={styles.field}>
            <label htmlFor="instSlug">Whitelabel URL Slug *</label>
            <div className={styles.slugInputWrap}>
              <span className={styles.slugPrefix}>/inst/</span>
              <input
                id="instSlug"
                className={styles.slugInput}
                type="text"
                required
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                disabled={isLoading}
                placeholder="apex-tech"
              />
            </div>
          </div>

          <div className={styles.field}>
            <label htmlFor="instDomain">Custom Domain (Optional)</label>
            <input
              id="instDomain"
              className={styles.input}
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              disabled={isLoading}
              placeholder="e.g. apex.edu"
            />
          </div>
        </div>

        <div className={styles.sectionTitle}>🎨 Branding & Themes</div>
        <div className={styles.grid3}>
          <div className={styles.field}>
            <label htmlFor="instPrimaryColor">Primary Theme</label>
            <div className={styles.colorWrap}>
              <input
                id="instPrimaryColor"
                className={styles.colorPicker}
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                disabled={isLoading}
              />
              <span className={styles.colorHex}>{primaryColor}</span>
            </div>
          </div>

          <div className={styles.field}>
            <label htmlFor="instSecondaryColor">Accent Theme</label>
            <div className={styles.colorWrap}>
              <input
                id="instSecondaryColor"
                className={styles.colorPicker}
                type="color"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                disabled={isLoading}
              />
              <span className={styles.colorHex}>{secondaryColor}</span>
            </div>
          </div>

          <div className={styles.field}>
            <label htmlFor="instLogoUrl">Logo URL (Optional)</label>
            <input
              id="instLogoUrl"
              className={styles.input}
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              disabled={isLoading}
              placeholder="https://.../logo.png"
            />
          </div>
        </div>

        <div className={styles.sectionTitle}>👤 Initial Institution Admin</div>
        <div className={styles.grid3}>
          <div className={styles.field}>
            <label htmlFor="adminName">Admin Name *</label>
            <input
              id="adminName"
              className={styles.input}
              type="text"
              required
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              disabled={isLoading}
              placeholder="e.g. Dr. Ronald Dean"
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="adminEmail">Admin Email *</label>
            <input
              id="adminEmail"
              className={styles.input}
              type="email"
              required
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              disabled={isLoading}
              placeholder="admin@apex.edu"
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="adminPassword">Password *</label>
            <input
              id="adminPassword"
              className={styles.input}
              type="password"
              required
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              disabled={isLoading}
              placeholder="Initial password"
            />
          </div>
        </div>

        <div className={styles.previewBox}>
          <div className={styles.previewLabel}>Generated Portal Route:</div>
          <div className={styles.previewUrl}>
            <code>{window.location.origin}/inst/{slug || ':slug'}/login</code>
          </div>
        </div>

        <div className={styles.actions}>
          <Button type="button" variant="ghost" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isLoading}>
            {isLoading ? 'Creating Institution…' : '🚀 Launch Institution'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
