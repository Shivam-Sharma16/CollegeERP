import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  ShieldCheck, 
  KeyRound, 
  User, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  AlertCircle, 
  Sparkles, 
  CheckCircle2, 
  Server, 
  Database, 
  Globe2, 
  Building2 
} from 'lucide-react';
import { useSuperadminSignupMutation } from '../api/authApi';
import { useAppSelector } from '../store';
import { selectInstitutionName, selectInstitutionLogo } from '../features/ui/themeSlice';
import { PageTransition } from '../components/ui/PageTransition';
import { StaggerList, StaggerItem } from '../components/ui/StaggerList';
import usePageMeta from '../hooks/usePageMeta';
import styles from './SuperadminSignupPage.module.css';

export default function SuperadminSignupPage() {
  usePageMeta({
    title: 'Super Admin Setup | Platform Console',
    description: 'Setup the initial central super admin account for the College ERP platform.',
    isPublic: true
  });

  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [setupKey, setSetupKey] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const institutionName = useAppSelector(selectInstitutionName);
  const institutionLogo = useAppSelector(selectInstitutionLogo);

  const [signup, { isLoading, error }] = useSuperadminSignupMutation();

  const errorMessage = error?.data?.message ?? error?.data?.error ?? error?.error ?? '';
  const isAlreadySetup = errorMessage.toLowerCase().includes('already');

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      await signup({ 
        name: name.trim(), 
        email: email.trim().toLowerCase(), 
        password, 
        setupKey: setupKey.trim() 
      }).unwrap();
      navigate('/login', { replace: true });
    } catch { /* error handled by UI */ }
  }

  if (isAlreadySetup) {
    return (
      <PageTransition>
        <div className={styles.page}>
          <div className={styles.formPanel} style={{ maxWidth: '520px', margin: 'auto' }}>
            <div className={styles.setupCompleteCard}>
              <div className={styles.completeIconWrap} style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
                <Lock size={36} />
              </div>
              <span className={styles.badgeSetup} style={{ borderColor: 'rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
                Registration Locked
              </span>
              <h1 className={styles.appName} style={{ textAlign: 'center', marginTop: '0.75rem' }}>Platform Already Initialized</h1>
              <p style={{ marginTop: '0.75rem', marginBottom: '1.5rem', color: 'var(--color-text-muted)', fontSize: '0.9rem', lineHeight: 1.6, textAlign: 'center' }}>
                A root SuperAdmin account already exists in this system. For platform security, bootstrap registration is permanently locked. 
                <strong style={{ display: 'block', marginTop: '0.5rem', color: '#f87171' }}>
                  No new SuperAdmin was created.
                </strong>
              </p>
              <Link to="/login" className={styles.submit} style={{ textDecoration: 'none', justifyContent: 'center' }}>
                <span>Log in with Existing SuperAdmin</span>
                <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className={styles.page}>

        {/* ── Left: SuperAdmin Campus Hero Panel ── */}
        <div className={styles.imagePanelWrap}>
          <div className={styles.imagePanel} />
          <div className={styles.imagePanelOverlay}>
            <div className={styles.imageHeaderBadge}>
              <Sparkles size={16} className={styles.badgeIcon} />
              <span>Platform Bootstrap & Governance</span>
            </div>

            <div className={styles.imageContent}>
              <h2 className={styles.imageTagline}>
                Centralized Governance,{' '}
                <span className={styles.imageTaglineAccent}>Limitless Scale.</span>
              </h2>
              <p className={styles.imageSubtext}>
                Initialize the central SuperAdmin platform console to govern multiple university institutions, manage global tenancy, and orchestrate academic systems.
              </p>

              <div className={styles.featurePills}>
                <span className={styles.pill}><Globe2 size={14} /> Multi-Tenant Architecture</span>
                <span className={styles.pill}><Server size={14} /> Microservices Control</span>
                <span className={styles.pill}><ShieldCheck size={14} /> Role-Based Access</span>
                <span className={styles.pill}><Database size={14} /> Isolated Tenant Data</span>
              </div>
            </div>

            <div className={styles.imageFooterQuote}>
              <p>"One unified platform overseeing autonomous digital institutions."</p>
            </div>
          </div>
        </div>

        {/* ── Right: Form Panel ── */}
        <div className={styles.formPanel}>
          <div className={styles.formPanelInner}>

            {/* Logo / Header */}
            <div className={styles.logoWrap}>
              {institutionLogo ? (
                <img src={institutionLogo} alt={institutionName} className={styles.institutionLogo} />
              ) : (
                <div className={styles.logoMark} aria-hidden="true">
                  <ShieldCheck size={28} color="#ffffff" />
                </div>
              )}
              <span className={styles.badgeSetup}>Platform Provisioning</span>
              <h1 className={styles.appName}>SuperAdmin Setup</h1>
              <p className={styles.tagline}>Create the primary platform authority account</p>
            </div>

            {/* Setup Form */}
            <form 
              className={`${styles.form} ${errorMessage ? styles.shake : ''}`} 
              onSubmit={handleSubmit}
            >
              <StaggerList>
                
                {/* Setup Key */}
                <StaggerItem>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel} htmlFor="setupKey">
                      Platform Setup Key
                    </label>
                    <div className={styles.fieldWrap}>
                      <span className={styles.fieldIcon}>
                        <KeyRound size={18} />
                      </span>
                      <input 
                        id="setupKey" 
                        type="text" 
                        required 
                        value={setupKey}
                        onChange={(e) => setSetupKey(e.target.value)} 
                        placeholder="Enter master setup authorization key" 
                      />
                    </div>
                  </div>
                </StaggerItem>

                {/* Administrator Full Name */}
                <StaggerItem>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel} htmlFor="name">
                      Administrator Name
                    </label>
                    <div className={styles.fieldWrap}>
                      <span className={styles.fieldIcon}>
                        <User size={18} />
                      </span>
                      <input 
                        id="name" 
                        type="text" 
                        required 
                        value={name}
                        onChange={(e) => setName(e.target.value)} 
                        placeholder="e.g. Chief Administrator" 
                      />
                    </div>
                  </div>
                </StaggerItem>

                {/* Email address */}
                <StaggerItem>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel} htmlFor="email">
                      SuperAdmin Email
                    </label>
                    <div className={styles.fieldWrap}>
                      <span className={styles.fieldIcon}>
                        <Mail size={18} />
                      </span>
                      <input 
                        id="email" 
                        type="email" 
                        autoComplete="email" 
                        required 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)} 
                        placeholder="admin@collegeerp.com" 
                      />
                    </div>
                  </div>
                </StaggerItem>

                {/* Password */}
                <StaggerItem>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel} htmlFor="password">
                      Secure Password
                    </label>
                    <div className={styles.fieldWrap}>
                      <span className={styles.fieldIcon}>
                        <Lock size={18} />
                      </span>
                      <input 
                        id="password" 
                        type={showPassword ? 'text' : 'password'} 
                        autoComplete="new-password" 
                        required 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)} 
                        placeholder="Min. 8 characters" 
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className={styles.passwordToggle}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                </StaggerItem>

                {/* Error Banner */}
                {errorMessage && (
                  <StaggerItem>
                    <div className={styles.error} role="alert">
                      <AlertCircle size={18} className={styles.errorIcon} />
                      <span>{errorMessage}</span>
                    </div>
                  </StaggerItem>
                )}

                {/* Submit Action */}
                <StaggerItem>
                  <button className={styles.submit} type="submit" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <span className={styles.btnSpinner} />
                        <span>Initializing SuperAdmin…</span>
                      </>
                    ) : (
                      <>
                        <span>Complete Platform Setup</span>
                        <ArrowRight size={18} className={styles.submitArrow} />
                      </>
                    )}
                  </button>
                </StaggerItem>

                {/* Already initialized shortcut */}
                <StaggerItem>
                  <div className={styles.divider}>
                    <span>Already configured?</span>
                  </div>
                  <Link to="/login" className={styles.loginLinkBtn}>
                    <span>Back to Portal Login</span>
                    <ArrowRight size={16} />
                  </Link>
                </StaggerItem>

              </StaggerList>
            </form>

            <div className={styles.footerNote}>
              <ShieldCheck size={14} className={styles.securityIcon} />
              <span>Protected platform console · Enterprise security protocol</span>
            </div>

          </div>
        </div>

      </div>
    </PageTransition>
  );
}

