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
import styles from './InstitutionSettings.module.css';

// Helper to read file as Base64
const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result);
  reader.onerror = error => reject(error);
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
  const isDirty = initialState && (
    formState.name !== initialState.name ||
    formState.primary !== initialState.primary ||
    formState.secondary !== initialState.secondary ||
    formState.logoUrl !== initialState.logoUrl ||
    formState.faviconUrl !== initialState.faviconUrl
  );

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormState(prev => ({ ...prev, [name]: value }));
  };

  const handleFileUpload = async (e, fieldName) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const base64 = await fileToBase64(file);
      setFormState(prev => ({ ...prev, [fieldName]: base64 }));
    } catch (err) {
      showToast('Failed to read image file.', 'error');
    }
  };

  const handleSave = async () => {
    try {
      // Build the expected theme.config.json structure
      // We only merge our changes onto the existing config to preserve other fields (like radius, fonts, other colors)
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
        }
      };

      await updateTheme(payload).unwrap();
      showToast('Settings saved! The app will reflect these changes on next load.', 'success');
      setInitialState(formState); // Reset dirty state
    } catch (error) {
      showToast(error?.data?.message || 'Failed to save settings.', 'error');
      // State is intentionally NOT reset here, preserving user's edits
    }
  };

  return (
    <DashboardShell title="Institution Settings" subtitle="Brand & theme customization" icon="🎨">
      <FadeIn
        show={!isFetching || !!initialState}
        skeleton={
          <div className={styles.layout}>
            <div className={styles.formCol}><Skeleton height="400px" /></div>
            <div style={{ flex: 1 }}><Skeleton height="300px" /></div>
          </div>
        }
      >
        <PageTransition>
          <div className={styles.layout}>
        {/* LEFT COLUMN - FORM */}
        <div className={styles.formCol}>
          <Card className={styles.settingsCard}>
            <h2 className={styles.sectionTitle}>Brand Details</h2>
            
            <div className={styles.field}>
              <label htmlFor="name">Institution Name</label>
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

            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label>Logo Upload</label>
                <div className={styles.uploadRow}>
                  <Button 
                    variant="secondary" 
                    onClick={() => logoInputRef.current?.click()}
                    disabled={isUpdating}
                  >
                    Choose Image
                  </Button>
                  {formState.logoUrl && <span className={styles.uploadStatus}>Logo ready</span>}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  ref={logoInputRef}
                  onChange={e => handleFileUpload(e, 'logoUrl')}
                />
              </div>

              <div className={styles.field}>
                <label>Favicon Upload</label>
                <div className={styles.uploadRow}>
                  <Button 
                    variant="secondary" 
                    onClick={() => faviconInputRef.current?.click()}
                    disabled={isUpdating}
                  >
                    Choose Icon
                  </Button>
                  {formState.faviconUrl && <span className={styles.uploadStatus}>Favicon ready</span>}
                </div>
                <input
                  type="file"
                  accept="image/x-icon,image/png,image/svg+xml"
                  hidden
                  ref={faviconInputRef}
                  onChange={e => handleFileUpload(e, 'faviconUrl')}
                />
              </div>
            </div>
            
            <hr className={styles.divider} />

            <h2 className={styles.sectionTitle}>Theme Colors</h2>
            
            <div className={styles.colorRow}>
              <div className={styles.colorGroup}>
                <label htmlFor="primary">Primary Color</label>
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
                    className={styles.input}
                    value={formState.primary}
                    onChange={handleChange}
                    disabled={isUpdating}
                  />
                </div>
              </div>

              <div className={styles.colorGroup}>
                <label htmlFor="secondary">Secondary Color</label>
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
                    className={styles.input}
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
