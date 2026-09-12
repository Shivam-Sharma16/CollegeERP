import { useState, useEffect, useCallback } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useToast } from '../ui/ToastContext';
import {
  useCreateInstitutionMutation,
  useLazyCheckSubdomainAvailabilityQuery,
} from '../../api/institutionsApi';
import {
  Building,
  CheckCircle2,
  XCircle,
  Loader2,
  Lock,
  Mail,
  User,
  Eye,
  EyeOff,
  Palette,
  ExternalLink,
  Shield,
  Sparkles,
} from 'lucide-react';
import styles from './CreateInstitutionModal.module.css';

export function CreateInstitutionModal({ isOpen, onClose }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [domain, setDomain] = useState('');
  const [hasManuallyEditedSlug, setHasManuallyEditedSlug] = useState(false);

  // Initial Admin
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Optional Branding
  const [primaryColor, setPrimaryColor] = useState('#4f46e5');
  const [secondaryColor, setSecondaryColor] = useState('#06b6d4');
  const [logoUrl, setLogoUrl] = useState('');
  const [showBranding, setShowBranding] = useState(false);

  // Subdomain live check status
  // state: 'idle' | 'checking' | 'available' | 'taken' | 'invalid'
  const [subdomainStatus, setSubdomainStatus] = useState({ state: 'idle', message: '' });
  const [fieldErrors, setFieldErrors] = useState({});

  const toastContext = useToast();
  const triggerToast = useCallback(
    (msg, type = 'info') => {
      if (toastContext?.showToast) {
        toastContext.showToast(msg, type);
      } else if (toastContext?.addToast) {
        toastContext.addToast({
          type,
          title: type === 'error' ? 'Error' : 'Success',
          message: msg,
        });
      }
    },
    [toastContext]
  );

  const [createInstitution, { isLoading: isCreating }] = useCreateInstitutionMutation();
  const [triggerCheck, { isFetching: isCheckFetching }] =
    useLazyCheckSubdomainAvailabilityQuery();

  // Reset form when opened
  useEffect(() => {
    if (isOpen) {
      setName('');
      setCode('');
      setSubdomain('');
      setDomain('');
      setHasManuallyEditedSlug(false);
      setAdminName('');
      setAdminEmail('');
      setAdminPassword('');
      setShowPassword(false);
      setPrimaryColor('#4f46e5');
      setSecondaryColor('#06b6d4');
      setLogoUrl('');
      setShowBranding(false);
      setSubdomainStatus({ state: 'idle', message: '' });
      setFieldErrors({});
    }
  }, [isOpen]);

  // Handle Institution Name changes and auto-generate slug & code
  const handleNameChange = (val) => {
    setName(val);

    if (!hasManuallyEditedSlug) {
      const generatedSlug = val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      setSubdomain(generatedSlug);
    }

    if (!code || code === '') {
      const generatedCode = val
        .split(' ')
        .filter(Boolean)
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 6);
      setCode(generatedCode);
    }
  };

  const handleSubdomainChange = (val) => {
    setHasManuallyEditedSlug(true);
    const cleaned = val.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setSubdomain(cleaned);
  };

  // Live debounced availability check (~400ms)
  useEffect(() => {
    const target = subdomain.trim().toLowerCase();
    if (!target) {
      setSubdomainStatus({ state: 'idle', message: '' });
      return;
    }

    const regex = /^[a-z0-9-]+$/;
    if (!regex.test(target)) {
      setSubdomainStatus({
        state: 'invalid',
        message: 'Only lowercase letters, numbers, and hyphens allowed',
      });
      return;
    }

    if (target.length < 2) {
      setSubdomainStatus({
        state: 'invalid',
        message: 'Must be at least 2 characters',
      });
      return;
    }

    setSubdomainStatus({ state: 'checking', message: 'Checking availability…' });

    const timer = setTimeout(async () => {
      try {
        const res = await triggerCheck(target).unwrap();
        const data = res?.data ?? res;
        if (data?.available) {
          setSubdomainStatus({
            state: 'available',
            message: data.message || `"${target}" is available!`,
          });
        } else {
          setSubdomainStatus({
            state: 'taken',
            message: data?.reason || `"${target}" is already taken`,
          });
        }
      } catch (err) {
        setSubdomainStatus({
          state: 'taken',
          message: err?.data?.message || err?.message || 'Subdomain is unavailable',
        });
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [subdomain, triggerCheck]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFieldErrors({});

    const normalizedName = name.trim();
    const normalizedSubdomain = subdomain.trim().toLowerCase();
    const normalizedCode = code.trim().toUpperCase();

    if (!normalizedName) {
      setFieldErrors({ name: 'Institution name is required' });
      return;
    }

    if (!normalizedSubdomain) {
      setFieldErrors({ subdomain: 'Subdomain is required' });
      return;
    }

    if (subdomainStatus.state === 'taken' || subdomainStatus.state === 'invalid') {
      setFieldErrors({ subdomain: subdomainStatus.message });
      return;
    }

    if (!adminName.trim() || !adminEmail.trim() || !adminPassword) {
      setFieldErrors({ admin: 'All initial admin credentials are required' });
      return;
    }

    try {
      const payload = {
        name: normalizedName,
        code: normalizedCode || normalizedSubdomain.slice(0, 6).toUpperCase(),
        subdomain: normalizedSubdomain,
        slug: normalizedSubdomain,
        customDomain: domain.trim() ? domain.trim().toLowerCase() : undefined,
        branding: {
          logoUrl: logoUrl.trim() || undefined,
          primaryColor: primaryColor || '#4f46e5',
          secondaryColor: secondaryColor || '#06b6d4',
        },
        admin: {
          name: adminName.trim(),
          email: adminEmail.trim().toLowerCase(),
          password: adminPassword,
        },
      };

      const res = await createInstitution(payload).unwrap();
      const createdSubdomain =
        res?.data?.institution?.subdomain ||
        res?.data?.institution?.slug ||
        res?.institution?.subdomain ||
        normalizedSubdomain;

      triggerToast(
        `Institution "${normalizedName}" created! Whitelabel portal: /inst/${createdSubdomain}/login`,
        'success'
      );
      onClose();
    } catch (err) {
      const msg =
        err?.data?.message || err?.data?.error || err?.message || 'Failed to create institution';
      triggerToast(msg, 'error');
      setFieldErrors({ form: msg });
    }
  };

  const isSubdomainBlocked =
    subdomainStatus.state === 'taken' ||
    subdomainStatus.state === 'invalid' ||
    subdomainStatus.state === 'checking' ||
    isCheckFetching;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Institution">
      <form onSubmit={handleSubmit} className={styles.form} noValidate>
        {fieldErrors.form && <div className={styles.alertError}>{fieldErrors.form}</div>}

        {/* ── Section 1: Institution Identity ──────────────────────────────── */}
        <div className={styles.sectionHeader}>
          <div className={styles.sectionIconWrap}>
            <Building size={16} />
          </div>
          <div>
            <h3 className={styles.sectionTitle}>Institution Details</h3>
            <p className={styles.sectionSubtitle}>
              Configure the institutional identity and isolated subdomain.
            </p>
          </div>
        </div>

        <div className={styles.grid2}>
          <div className={styles.field}>
            <label htmlFor="instName" className={styles.label}>
              Institution Name <span className={styles.required}>*</span>
            </label>
            <input
              id="instName"
              className={styles.input}
              type="text"
              required
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              disabled={isCreating}
              placeholder="e.g. Apex Institute of Technology"
            />
            {fieldErrors.name && <span className={styles.fieldError}>{fieldErrors.name}</span>}
          </div>

          <div className={styles.field}>
            <label htmlFor="instCode" className={styles.label}>
              Campus Code <span className={styles.required}>*</span>
            </label>
            <input
              id="instCode"
              className={styles.input}
              type="text"
              required
              maxLength={10}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              disabled={isCreating}
              placeholder="e.g. AIT"
            />
          </div>
        </div>

        {/* Subdomain Input with Live Availability Indicator */}
        <div className={styles.field}>
          <div className={styles.labelRow}>
            <label htmlFor="instSubdomain" className={styles.label}>
              Subdomain URL <span className={styles.required}>*</span>
            </label>
            {/* Live Availability Badge */}
            {subdomainStatus.state === 'checking' && (
              <span className={`${styles.statusBadge} ${styles.badgeChecking}`}>
                <Loader2 size={12} className={styles.spinner} /> Checking…
              </span>
            )}
            {subdomainStatus.state === 'available' && (
              <span className={`${styles.statusBadge} ${styles.badgeAvailable}`}>
                <CheckCircle2 size={12} /> Available
              </span>
            )}
            {subdomainStatus.state === 'taken' && (
              <span className={`${styles.statusBadge} ${styles.badgeTaken}`}>
                <XCircle size={12} /> Taken
              </span>
            )}
            {subdomainStatus.state === 'invalid' && (
              <span className={`${styles.statusBadge} ${styles.badgeInvalid}`}>
                <XCircle size={12} /> Invalid
              </span>
            )}
          </div>

          <div
            className={`${styles.subdomainWrap} ${
              subdomainStatus.state === 'available'
                ? styles.subdomainAvailable
                : subdomainStatus.state === 'taken' || subdomainStatus.state === 'invalid'
                ? styles.subdomainTaken
                : ''
            }`}
          >
            <span className={styles.subdomainPrefix}>/inst/</span>
            <input
              id="instSubdomain"
              className={styles.subdomainInput}
              type="text"
              required
              value={subdomain}
              onChange={(e) => handleSubdomainChange(e.target.value)}
              disabled={isCreating}
              placeholder="apex-tech"
              autoComplete="off"
              spellCheck="false"
            />
            <span className={styles.subdomainSuffix}>/login</span>
          </div>

          {subdomainStatus.message && (
            <div
              className={`${styles.statusMessage} ${
                subdomainStatus.state === 'available'
                  ? styles.msgAvailable
                  : subdomainStatus.state === 'taken' || subdomainStatus.state === 'invalid'
                  ? styles.msgTaken
                  : styles.msgMuted
              }`}
            >
              {subdomainStatus.message}
            </div>
          )}
          {fieldErrors.subdomain && (
            <span className={styles.fieldError}>{fieldErrors.subdomain}</span>
          )}
        </div>

        {/* ── Section 2: Designated Admin Account ─────────────────────────── */}
        <div className={styles.sectionHeader}>
          <div className={styles.sectionIconWrap}>
            <Shield size={16} />
          </div>
          <div>
            <h3 className={styles.sectionTitle}>Initial Admin Account</h3>
            <p className={styles.sectionSubtitle}>
              Primary administrative credentials for this college tenant.
            </p>
          </div>
        </div>

        <div className={styles.grid2}>
          <div className={styles.field}>
            <label htmlFor="adminName" className={styles.label}>
              Admin Full Name <span className={styles.required}>*</span>
            </label>
            <div className={styles.inputWithIcon}>
              <User size={15} className={styles.inputIcon} />
              <input
                id="adminName"
                className={styles.input}
                type="text"
                required
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                disabled={isCreating}
                placeholder="Dr. Ronald Dean"
              />
            </div>
          </div>

          <div className={styles.field}>
            <label htmlFor="adminEmail" className={styles.label}>
              Admin Email <span className={styles.required}>*</span>
            </label>
            <div className={styles.inputWithIcon}>
              <Mail size={15} className={styles.inputIcon} />
              <input
                id="adminEmail"
                className={styles.input}
                type="email"
                required
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                disabled={isCreating}
                placeholder="admin@apex.edu"
              />
            </div>
          </div>
        </div>

        <div className={styles.field}>
          <label htmlFor="adminPassword" className={styles.label}>
            Initial Password <span className={styles.required}>*</span>
          </label>
          <div className={styles.inputWithIcon}>
            <Lock size={15} className={styles.inputIcon} />
            <input
              id="adminPassword"
              className={styles.input}
              type={showPassword ? 'text' : 'password'}
              required
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              disabled={isCreating}
              placeholder="Temporary secure password"
            />
            <button
              type="button"
              className={styles.iconActionBtn}
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          {fieldErrors.admin && <span className={styles.fieldError}>{fieldErrors.admin}</span>}
        </div>

        {/* ── Section 3: Branding & Theme (Optional) ────────────────────────── */}
        <div className={styles.brandingSection}>
          <button
            type="button"
            className={styles.brandingToggle}
            onClick={() => setShowBranding(!showBranding)}
          >
            <div className={styles.brandingToggleLeft}>
              <Palette size={16} />
              <span>Branding & Themes (Optional)</span>
            </div>
            <span className={styles.brandingToggleBadge}>
              {showBranding ? 'Hide' : 'Customize'}
            </span>
          </button>

          {showBranding && (
            <div className={styles.brandingContent}>
              <p className={styles.brandingHelp}>
                Defaults to platform indigo & cyan. Can be modified later by the institution admin.
              </p>

              <div className={styles.grid2}>
                <div className={styles.field}>
                  <label htmlFor="primaryColor" className={styles.label}>
                    Primary Brand Color
                  </label>
                  <div className={styles.colorWrap}>
                    <input
                      id="primaryColor"
                      className={styles.colorPicker}
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      disabled={isCreating}
                    />
                    <span className={styles.colorHex}>{primaryColor}</span>
                  </div>
                </div>

                <div className={styles.field}>
                  <label htmlFor="secondaryColor" className={styles.label}>
                    Accent Color
                  </label>
                  <div className={styles.colorWrap}>
                    <input
                      id="secondaryColor"
                      className={styles.colorPicker}
                      type="color"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      disabled={isCreating}
                    />
                    <span className={styles.colorHex}>{secondaryColor}</span>
                  </div>
                </div>
              </div>

              <div className={styles.field}>
                <label htmlFor="instLogoUrl" className={styles.label}>
                  Logo URL (Optional)
                </label>
                <input
                  id="instLogoUrl"
                  className={styles.input}
                  type="url"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  disabled={isCreating}
                  placeholder="https://example.com/logo.png"
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="customDomain" className={styles.label}>
                  Custom Domain (Optional)
                </label>
                <input
                  id="customDomain"
                  className={styles.input}
                  type="text"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  disabled={isCreating}
                  placeholder="e.g. portal.apex.edu"
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Live Portal Route Preview ────────────────────────────────────── */}
        <div className={styles.previewBox}>
          <div className={styles.previewHeader}>
            <Sparkles size={13} />
            <span>Dedicated Whitelabel Portal</span>
          </div>
          <div className={styles.previewUrl}>
            <code>
              {window.location.origin}/inst/{subdomain || ':subdomain'}/login
            </code>
          </div>
        </div>

        {/* ── Form Actions ─────────────────────────────────────────────────── */}
        <div className={styles.actions}>
          <Button type="button" variant="ghost" onClick={onClose} disabled={isCreating}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isCreating || isSubdomainBlocked || !name.trim() || !subdomain.trim()}
          >
            {isCreating ? (
              <>
                <Loader2 size={15} className={styles.spinner} style={{ marginRight: '6px' }} />
                Launching Institution…
              </>
            ) : (
              '🚀 Launch Institution'
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
