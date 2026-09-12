import { useState, useEffect, useRef } from 'react';
import { DashboardShell } from '../components/DashboardShell';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { PageTransition } from '../components/ui/PageTransition';
import { StaggerList, StaggerItem } from '../components/ui/StaggerList';
import { FadeIn } from '../components/ui/FadeIn';
import { Skeleton } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/ToastContext';
import { useGetThemeConfigQuery, useUpdateThemeConfigMutation } from '../api/settingsApi';
import { DEFAULT_COLORS } from '../features/ui/themeSlice';
import {
  Building2,
  Palette,
  Upload,
  Trash2,
  Sparkles,
  Save,
  Check,
  Globe,
  Image as ImageIcon,
} from 'lucide-react';
import styles from './InstitutionSettings.module.css';

const PRESET_PALETTES = [
  { name: 'Indigo Modern', primary: '#4f46e5', secondary: '#06b6d4' },
  { name: 'Oceanic Blue', primary: '#0284c7', secondary: '#38bdf8' },
  { name: 'Emerald Campus', primary: '#059669', secondary: '#10b981' },
  { name: 'Royal Violet', primary: '#7c3aed', secondary: '#c084fc' },
  { name: 'Crimson Tech', primary: '#dc2626', secondary: '#f87171' },
];

// Helper to read file as Base64
const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });

export default function InstitutionSettings() {
  const { data: configData, isLoading: isFetching } = useGetThemeConfigQuery();
  const [updateTheme, { isLoading: isUpdating }] = useUpdateThemeConfigMutation();
  const { showToast } = useToast();

  const [formState, setFormState] = useState({
    name: '',
    primary: DEFAULT_COLORS.primary,
    secondary: DEFAULT_COLORS.secondary,
    logoUrl: '',
    faviconUrl: '',
  });

  const [initialState, setInitialState] = useState(null);
  const logoInputRef = useRef(null);
  const faviconInputRef = useRef(null);

  // Sync loaded config to local state
  useEffect(() => {
    if (configData) {
      const state = {
        name: configData.institution?.name || '',
        primary: configData.colors?.primary || DEFAULT_COLORS.primary,
        secondary: configData.colors?.secondary || DEFAULT_COLORS.secondary,
        logoUrl: configData.institution?.logoUrl || '',
        faviconUrl: configData.institution?.faviconUrl || '',
      };
      setFormState(state);
      setInitialState(state);
    }
  }, [configData]);

  // Determine if form is dirty
  const isDirty =
    initialState &&
    (formState.name !== initialState.name ||
      formState.primary !== initialState.primary ||
      formState.secondary !== initialState.secondary ||
      formState.logoUrl !== initialState.logoUrl ||
      formState.faviconUrl !== initialState.faviconUrl);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const applyPalette = (primary, secondary) => {
    setFormState((prev) => ({ ...prev, primary, secondary }));
  };

  const handleFileUpload = async (e, fieldName) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const base64 = await fileToBase64(file);
      setFormState((prev) => ({ ...prev, [fieldName]: base64 }));
    } catch (err) {
      showToast('Failed to read image file.', 'error');
    }
  };

  const handleRemoveMedia = (fieldName) => {
    setFormState((prev) => ({ ...prev, [fieldName]: '' }));
  };

  const handleSave = async () => {
    try {
      const existingConfig = configData || {};
      const payload = {
        ...existingConfig,
        institution: {
          ...existingConfig.institution,
          name: formState.name,
          logoUrl: formState.logoUrl,
          faviconUrl: formState.faviconUrl,
        },
        colors: {
          ...existingConfig.colors,
          primary: formState.primary,
          secondary: formState.secondary,
        },
      };

      await updateTheme(payload).unwrap();
      showToast('Settings saved! The app will reflect these changes on next load.', 'success');
      setInitialState(formState); // Reset dirty state
    } catch (error) {
      showToast(error?.data?.message || 'Failed to save settings.', 'error');
    }
  };

  return (
    <DashboardShell
      title="Institution Settings"
      subtitle="Brand identity & theme whitelabel customization"
      icon="🎨"
    >
      <FadeIn
        show={!isFetching || !!initialState}
        skeleton={
          <div className={styles.layout}>
            <div className={styles.formCol}>
              <Skeleton height="400px" />
            </div>
            <div style={{ flex: 1 }}>
              <Skeleton height="300px" />
            </div>
          </div>
        }
      >
        <PageTransition>
          <div className={styles.layout}>
            {/* LEFT COLUMN - FORM */}
            <div className={styles.formCol}>
              <Card className={styles.settingsCard}>
                {/* Brand Details */}
                <div className={styles.sectionHeaderRow}>
                  <div className={styles.sectionIconWrap}>
                    <Building2 size={18} />
                  </div>
                  <div>
                    <h2 className={styles.sectionTitle}>Brand Identity</h2>
                    <p className={styles.sectionSubtitle}>
                      Configure public identity, visual emblems, and portal metadata
                    </p>
                  </div>
                </div>

                <div className={styles.field}>
                  <label htmlFor="name" className={styles.label}>
                    Institution Display Name
                  </label>
                  <div className={styles.inputWithIcon}>
                    <Building2 size={16} className={styles.inputIcon} />
                    <input
                      id="name"
                      name="name"
                      className={styles.input}
                      value={formState.name}
                      onChange={handleChange}
                      placeholder="e.g. Global Tech University"
                      disabled={isUpdating}
                    />
                  </div>
                </div>

                <div className={styles.fieldRow}>
                  {/* Logo Upload Card */}
                  <div className={styles.mediaField}>
                    <label className={styles.label}>Official Logo</label>
                    <div className={styles.mediaCard}>
                      <div className={styles.mediaPreview}>
                        {formState.logoUrl ? (
                          <img
                            src={formState.logoUrl}
                            alt="Logo preview"
                            className={styles.mediaImg}
                          />
                        ) : (
                          <div className={styles.mediaPlaceholder}>
                            <ImageIcon size={20} />
                          </div>
                        )}
                      </div>
                      <div className={styles.mediaControls}>
                        <Button
                          variant="secondary"
                          onClick={() => logoInputRef.current?.click()}
                          disabled={isUpdating}
                          style={{ fontSize: '0.8125rem', padding: '6px 12px' }}
                        >
                          <Upload size={13} style={{ marginRight: '6px' }} />
                          {formState.logoUrl ? 'Change' : 'Upload'}
                        </Button>
                        {formState.logoUrl && (
                          <button
                            type="button"
                            className={styles.removeMediaBtn}
                            onClick={() => handleRemoveMedia('logoUrl')}
                            title="Remove logo"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      ref={logoInputRef}
                      onChange={(e) => handleFileUpload(e, 'logoUrl')}
                    />
                  </div>

                  {/* Favicon Upload Card */}
                  <div className={styles.mediaField}>
                    <label className={styles.label}>Browser Favicon</label>
                    <div className={styles.mediaCard}>
                      <div className={styles.mediaPreview}>
                        {formState.faviconUrl ? (
                          <img
                            src={formState.faviconUrl}
                            alt="Favicon preview"
                            className={styles.mediaImgFavicon}
                          />
                        ) : (
                          <div className={styles.mediaPlaceholder}>
                            <Globe size={18} />
                          </div>
                        )}
                      </div>
                      <div className={styles.mediaControls}>
                        <Button
                          variant="secondary"
                          onClick={() => faviconInputRef.current?.click()}
                          disabled={isUpdating}
                          style={{ fontSize: '0.8125rem', padding: '6px 12px' }}
                        >
                          <Upload size={13} style={{ marginRight: '6px' }} />
                          {formState.faviconUrl ? 'Change' : 'Upload'}
                        </Button>
                        {formState.faviconUrl && (
                          <button
                            type="button"
                            className={styles.removeMediaBtn}
                            onClick={() => handleRemoveMedia('faviconUrl')}
                            title="Remove favicon"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                    <input
                      type="file"
                      accept="image/x-icon,image/png,image/svg+xml"
                      hidden
                      ref={faviconInputRef}
                      onChange={(e) => handleFileUpload(e, 'faviconUrl')}
                    />
                  </div>
                </div>

                <hr className={styles.divider} />

                {/* Theme Colors */}
                <div className={styles.sectionHeaderRow}>
                  <div className={styles.sectionIconWrap}>
                    <Palette size={18} />
                  </div>
                  <div>
                    <h2 className={styles.sectionTitle}>Theme & Colors</h2>
                    <p className={styles.sectionSubtitle}>
                      Custom accents applied across navigation, highlights, and portal badges
                    </p>
                  </div>
                </div>

                {/* Palette Quick Presets */}
                <div className={styles.presetsWrap}>
                  <span className={styles.presetsLabel}>
                    <Sparkles size={13} /> Quick Presets:
                  </span>
                  <div className={styles.presetsList}>
                    {PRESET_PALETTES.map((preset) => {
                      const isSelected =
                        formState.primary === preset.primary &&
                        formState.secondary === preset.secondary;
                      return (
                        <button
                          key={preset.name}
                          type="button"
                          className={`${styles.presetBtn} ${isSelected ? styles.presetBtnActive : ''}`}
                          onClick={() => applyPalette(preset.primary, preset.secondary)}
                          title={`Apply ${preset.name}`}
                        >
                          <span
                            className={styles.presetColorDot}
                            style={{ backgroundColor: preset.primary }}
                          />
                          <span>{preset.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className={styles.colorRow}>
                  <div className={styles.colorGroup}>
                    <label htmlFor="primary" className={styles.label}>
                      Primary Brand Color
                    </label>
                    <div className={styles.colorInputs}>
                      <input
                        type="color"
                        id="primarySwatch"
                        name="primary"
                        className={styles.colorSwatch}
                        value={formState.primary}
                        onChange={handleChange}
                        disabled={isUpdating}
                      />
                      <input
                        type="text"
                        id="primary"
                        name="primary"
                        className={`${styles.input} ${styles.colorTextInput}`}
                        value={formState.primary}
                        onChange={handleChange}
                        disabled={isUpdating}
                      />
                    </div>
                  </div>

                  <div className={styles.colorGroup}>
                    <label htmlFor="secondary" className={styles.label}>
                      Secondary Accent Color
                    </label>
                    <div className={styles.colorInputs}>
                      <input
                        type="color"
                        id="secondarySwatch"
                        name="secondary"
                        className={styles.colorSwatch}
                        value={formState.secondary}
                        onChange={handleChange}
                        disabled={isUpdating}
                      />
                      <input
                        type="text"
                        id="secondary"
                        name="secondary"
                        className={`${styles.input} ${styles.colorTextInput}`}
                        value={formState.secondary}
                        onChange={handleChange}
                        disabled={isUpdating}
                      />
                    </div>
                  </div>
                </div>

                <div className={styles.actions}>
                  <Button
                    variant="primary"
                    onClick={handleSave}
                    disabled={!isDirty || isUpdating}
                  >
                    <Save size={15} style={{ marginRight: '6px' }} />
                    {isUpdating ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </Card>
            </div>

            {/* RIGHT COLUMN - PREVIEW */}
        <div className={styles.previewCol}>
          <h3 className={styles.previewHeader}>Live Preview</h3>
          
          <div className={styles.previewContainer}>
            {/* Mock Sidebar */}
            <div className={styles.mockSidebar}>
              <div className={styles.mockLogoArea}>
                {formState.logoUrl ? (
                  <img src={formState.logoUrl} alt="Logo" className={styles.mockLogoImg} />
                ) : (
                  <div className={styles.mockLogoPlaceholder} />
                )}
                <span className={styles.mockInstName}>{formState.name || 'Institution Name'}</span>
              </div>
              
              <div className={styles.mockNav}>
                <div className={styles.mockNavItem}>
                  <div className={styles.mockIcon} />
                  <span>Dashboard</span>
                </div>
                <div 
                  className={styles.mockNavItemActive}
                  style={{ 
                    backgroundColor: `color-mix(in srgb, ${formState.primary} 15%, transparent)`,
                    color: formState.primary 
                  }}
                >
                  <div 
                    className={styles.mockActiveIndicator} 
                    style={{ backgroundColor: formState.primary }} 
                  />
                  <div className={styles.mockIcon} style={{ backgroundColor: formState.primary }} />
                  <span style={{ fontWeight: 600 }}>Settings</span>
                </div>
                <div className={styles.mockNavItem}>
                  <div className={styles.mockIcon} />
                  <span>Users</span>
                </div>
              </div>
            </div>

            {/* Mock Main Area */}
            <div className={styles.mockMain}>
              <div className={styles.mockHeader}>
                <div className={styles.mockTitle}>Settings</div>
                <button 
                  className={styles.mockPrimaryBtn}
                  style={{ backgroundColor: formState.primary }}
                >
                  Save Changes
                </button>
              </div>
              
              <div className={styles.mockCard}>
                <div className={styles.mockSkeleton} />
                <div className={styles.mockSkeleton} style={{ width: '80%' }} />
                <div className={styles.mockSkeleton} style={{ width: '60%' }} />
                
                <div className={styles.mockSecondaryArea}>
                  <span 
                    className={styles.mockSecondaryBadge}
                    style={{ 
                      backgroundColor: `color-mix(in srgb, ${formState.secondary} 15%, transparent)`,
                      color: formState.secondary,
                      border: `1px solid color-mix(in srgb, ${formState.secondary} 30%, transparent)`
                    }}
                  >
                    Secondary Accent
                  </span>
                </div>
              </div>
            </div>
          </div>
          <p className={styles.previewNote}>
            Note: This is a client-side preview. Save changes and reload the app to apply globally.
          </p>
        </div>
        </div>
        </PageTransition>
      </FadeIn>
    </DashboardShell>
  );
}
