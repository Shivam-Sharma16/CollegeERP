import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useToast } from '../ui/ToastContext';
import { useUpdateInstitutionMutation } from '../../api/institutionsApi';
import {
  Building,
  Palette,
  ShieldCheck,
  ShieldAlert,
  Save,
  Globe,
  Tag,
  Image as ImageIcon,
} from 'lucide-react';
import styles from './CreateInstitutionModal.module.css';

export function EditInstitutionModal({ isOpen, onClose, institution }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [primaryColor, setPrimaryColor] = useState('#4f46e5');
  const [secondaryColor, setSecondaryColor] = useState('#06b6d4');
  const [logoUrl, setLogoUrl] = useState('');
  const [showBranding, setShowBranding] = useState(true);

  const { showToast } = useToast();
  const [updateInstitution, { isLoading }] = useUpdateInstitutionMutation();

  useEffect(() => {
    if (isOpen && institution) {
      setName(institution.name || '');
      setCode(institution.code || '');
      setSubdomain(institution.subdomain || institution.slug || '');
      setStatus(institution.status || (institution.isActive === false ? 'SUSPENDED' : 'ACTIVE'));
      setPrimaryColor(institution.branding?.primaryColor || '#4f46e5');
      setSecondaryColor(institution.branding?.secondaryColor || '#06b6d4');
      setLogoUrl(institution.branding?.logoUrl || institution.logoUrl || '');
    }
  }, [isOpen, institution]);

  if (!isOpen || !institution) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Institution name is required', 'error');
      return;
    }

    try {
      await updateInstitution({
        id: institution._id,
        name: name.trim(),
        code: code.trim().toUpperCase(),
        subdomain: subdomain.trim().toLowerCase(),
        slug: subdomain.trim().toLowerCase(),
        status,
        isActive: status === 'ACTIVE',
        branding: {
          primaryColor,
          secondaryColor,
          logoUrl: logoUrl.trim() || undefined,
        },
      }).unwrap();

      showToast(`Institution "${name}" updated successfully.`, 'success');
      onClose();
    } catch (err) {
      showToast(err?.data?.message || 'Failed to update institution', 'error');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Edit ${institution.name || 'Institution'}`}>
      <form onSubmit={handleSubmit} className={styles.form}>
        {/* Section 1: Institution Details */}
        <div className={styles.sectionHeader}>
          <div className={styles.sectionIconWrap}>
            <Building size={16} />
          </div>
          <div>
            <h3 className={styles.sectionTitle}>Institutional Identity</h3>
            <p className={styles.sectionSubtitle}>
              Update campus name, reference code, portal subdomain, and operational status.
            </p>
          </div>
        </div>

        <div className={styles.grid2}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="edit-inst-name">
              Institution Name <span className={styles.required}>*</span>
            </label>
            <input
              id="edit-inst-name"
              type="text"
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Stanford University"
              required
              disabled={isLoading}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="edit-inst-code">
              Campus Code <span className={styles.required}>*</span>
            </label>
            <div className={styles.inputWithIcon}>
              <Tag size={15} className={styles.inputIcon} />
              <input
                id="edit-inst-code"
                type="text"
                className={`${styles.input} ${styles.hasIcon}`}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. STAN"
                maxLength={10}
                required
                disabled={isLoading}
              />
            </div>
          </div>
        </div>

        <div className={styles.grid2}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="edit-inst-subdomain">
              Whitelabel Subdomain / Slug
            </label>
            <div className={styles.inputWithIcon}>
              <Globe size={15} className={styles.inputIcon} />
              <input
                id="edit-inst-subdomain"
                type="text"
                className={`${styles.input} ${styles.hasIcon}`}
                value={subdomain}
                onChange={(e) =>
                  setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                }
                placeholder="e.g. stanford"
                required
                disabled={isLoading}
              />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="edit-inst-status">
              Operational Status
            </label>
            <select
              id="edit-inst-status"
              className={styles.input}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              disabled={isLoading}
            >
              <option value="ACTIVE">Active (Accessible)</option>
              <option value="SUSPENDED">Suspended (Locked)</option>
            </select>
          </div>
        </div>

        {/* Section 2: Branding & Appearance */}
        <div className={styles.sectionHeader}>
          <div className={styles.sectionIconWrap}>
            <Palette size={16} />
          </div>
          <div>
            <h3 className={styles.sectionTitle}>Whitelabel Branding</h3>
            <p className={styles.sectionSubtitle}>
              Customize tenant color palette and official university emblem / logo.
            </p>
          </div>
        </div>

        <div className={styles.grid2}>
          <div className={styles.field}>
            <label className={styles.label}>Primary Color</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                  cursor: 'pointer',
                  padding: 2,
                  background: 'none',
                }}
                disabled={isLoading}
              />
              <input
                type="text"
                className={styles.input}
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                placeholder="#4f46e5"
                disabled={isLoading}
              />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Secondary Color</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="color"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                  cursor: 'pointer',
                  padding: 2,
                  background: 'none',
                }}
                disabled={isLoading}
              />
              <input
                type="text"
                className={styles.input}
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                placeholder="#06b6d4"
                disabled={isLoading}
              />
            </div>
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="edit-inst-logo">
            Logo URL (ImageKit CDN / Web URL)
          </label>
          <div className={styles.inputWithIcon}>
            <ImageIcon size={15} className={styles.inputIcon} />
            <input
              id="edit-inst-logo"
              type="url"
              className={`${styles.input} ${styles.hasIcon}`}
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://ik.imagekit.io/..."
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Modal Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isLoading}>
            <Save size={15} />
            {isLoading ? 'Saving Changes...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
