import { useState } from 'react';
import { useNavigate, useLocation, useParams, Link } from 'react-router-dom';
import { 
  GraduationCap, 
  ShieldCheck, 
  School, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  AlertCircle, 
  BookOpen, 
  CalendarCheck2, 
  BarChart3, 
  Building2,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { useLoginMutation } from '../api/authApi';
import { useAppSelector, useAppDispatch } from '../store';
import { setCredentials } from '../features/ui/authSlice';
import { selectInstitutionName, selectInstitutionLogo } from '../features/ui/themeSlice';
import { useTenant } from '../context/TenantContext';
import usePageMeta from '../hooks/usePageMeta';
import { PageTransition } from '../components/ui/PageTransition';
import { StaggerList, StaggerItem } from '../components/ui/StaggerList';
import styles from './LoginPage.module.css';

export default function LoginPage({ isSuperAdminMode = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const { slug } = useParams();
  const { tenant, isTenantPortal, isLoading: isTenantLoading, error: tenantError } = useTenant();

  const title = isTenantPortal
    ? `${tenant?.name || 'Institution'} Portal Login`
    : isSuperAdminMode
    ? 'SuperAdmin Platform Console'
    : 'Portal Login';

  usePageMeta({
    title,
    description: 'Log in to the College ERP system to access your dashboard.',
    isPublic: true
  });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Fallback institution data from config/themeSlice
  const defaultInstitutionName = useAppSelector(selectInstitutionName);
  const defaultInstitutionLogo = useAppSelector(selectInstitutionLogo);

  const institutionName = isTenantPortal
    ? (tenant?.name || defaultInstitutionName || 'Institution Portal')
    : (isSuperAdminMode ? 'SuperAdmin Console' : defaultInstitutionName);
  const institutionLogo = isTenantPortal
    ? (tenant?.logoUrl || tenant?.branding?.logoUrl || defaultInstitutionLogo || null)
    : defaultInstitutionLogo;

  const [login, { isLoading, error }] = useLoginMutation();

  const errorMessage = error?.data?.message ?? error?.data?.error ?? error?.error ?? '';

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const payload = { 
        email: email.trim().toLowerCase(), 
        password 
      };
      if (isTenantPortal && slug) {
        payload.institutionSlug = slug;
      }

      const res = await login(payload).unwrap();
      const token = res?.data?.token || res?.token || res?.accessToken;
      const user = res?.data?.user || res?.user || {
        id: res?.userId || res?.data?.userId,
        roles: res?.roles || res?.data?.roles || []
      };
      if (token) {
        dispatch(setCredentials({ token, user }));
      }

      // Determine redirect path
      const roles = user.roles || [];
      if (isTenantPortal && slug) {
        if (roles.includes('ADMIN')) {
          navigate(`/inst/${slug}/admin/dashboard`, { replace: true });
        } else if (roles.includes('HOD')) {
          navigate(`/inst/${slug}/hod/dashboard`, { replace: true });
        } else if (roles.includes('FACULTY')) {
          navigate(`/inst/${slug}/faculty/dashboard`, { replace: true });
        } else if (roles.includes('CC')) {
          navigate(`/inst/${slug}/cc/dashboard`, { replace: true });
        } else {
          navigate(`/inst/${slug}/student/dashboard`, { replace: true });
        }
      } else if (roles.includes('SUPERADMIN')) {
        navigate('/superadmin/dashboard', { replace: true });
      } else {
        const from = location.state?.from?.pathname;
        if (from && from !== '/' && from !== '/login' && from !== '/unauthorized') {
          navigate(from, { replace: true });
        } else {
          if (roles.includes('ADMIN')) {
            navigate('/admin/dashboard', { replace: true });
          } else if (roles.includes('HOD')) {
            navigate('/hod/dashboard', { replace: true });
          } else if (roles.includes('FACULTY')) {
            navigate('/faculty/dashboard', { replace: true });
          } else if (roles.includes('CC')) {
            navigate('/cc/dashboard', { replace: true });
          } else {
            navigate('/student/dashboard', { replace: true });
          }
        }
      }
    } catch { /* error handled by RTK error state */ }
  }

  if (isTenantPortal && isTenantLoading) {
    return (
      <div className={styles.stateWrap}>
        <div className={styles.stateCard}>
          <div className={styles.spinner}></div>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>Resolving institution portal…</p>
        </div>
      </div>
    );
  }

  if (isTenantPortal && (tenantError || (!isTenantLoading && !tenant))) {
    return (
      <div className={styles.stateWrap}>
        <div className={styles.stateCard}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.5rem' }}>
            Institution Not Found
          </h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            The institution portal <code>/inst/{slug}</code> does not exist or has been suspended.
          </p>
          <Link
            to="/login"
            style={{
              display: 'inline-block',
              padding: '0.625rem 1.25rem',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--color-primary)',
              color: '#fff',
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '0.875rem'
            }}
          >
            Go to Platform Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <PageTransition>
      <div className={styles.page}>

        {/* ── Left: College campus hero panel ── */}
        <div className={styles.imagePanelWrap}>
          <div className={styles.imagePanel} />
          <div className={styles.imagePanelOverlay}>
            <div className={styles.imageHeaderBadge}>
              <Sparkles size={16} className={styles.badgeIcon} />
              <span>Next-Generation Academic ERP</span>
            </div>

            <div className={styles.imageContent}>
              <h2 className={styles.imageTagline}>
                Empowering Education,{' '}
                <span className={styles.imageTaglineAccent}>Streamlining Success.</span>
              </h2>
              <p className={styles.imageSubtext}>
                An integrated, intelligent campus management platform designed for students, faculty, and administrators.
              </p>

              <div className={styles.featurePills}>
                <span className={styles.pill}><BookOpen size={14} /> Academics & LMS</span>
                <span className={styles.pill}><CalendarCheck2 size={14} /> Smart Attendance</span>
                <span className={styles.pill}><BarChart3 size={14} /> Real-time Analytics</span>
                <span className={styles.pill}><Building2 size={14} /> Multi-Department</span>
              </div>
            </div>

            <div className={styles.imageFooterQuote}>
              <p>"Transforming campus workflow into an effortless digital experience."</p>
            </div>
          </div>
        </div>

        {/* ── Right: Login form panel ── */}
        <div className={styles.formPanel}>
          <div className={styles.formPanelInner}>

            {/* Logo / header */}
            <div className={styles.logoWrap}>
              {institutionLogo ? (
                <img src={institutionLogo} alt={institutionName} className={styles.institutionLogo} />
              ) : (
                <div className={styles.logoMark} aria-hidden="true">
                  {isSuperAdminMode ? (
                    <ShieldCheck size={28} color="#ffffff" />
                  ) : isTenantPortal ? (
                    <School size={28} color="#ffffff" />
                  ) : (
                    <GraduationCap size={28} color="#ffffff" />
                  )}
                </div>
              )}
              <span className={styles.welcomeBack}>Welcome back</span>
              <h1 className={styles.appName}>{institutionName}</h1>
              <p className={styles.tagline}>
                {isTenantPortal
                  ? `Campus Portal • ${tenant?.code || 'Sign in to your portal'}`
                  : isSuperAdminMode
                  ? 'Central SuperAdmin Control Center'
                  : 'Enter your credentials to access your portal'}
              </p>
            </div>

            {/* Form */}
            <form
              className={`${styles.form} ${errorMessage ? styles.shake : ''}`}
              onSubmit={handleSubmit}
            >
              <StaggerList>

                {/* Email field */}
                <StaggerItem>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel} htmlFor="email">Email address</label>
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
                        placeholder="you@institution.edu"
                      />
                    </div>
                  </div>
                </StaggerItem>

                {/* Password field */}
                <StaggerItem>
                  <div className={styles.fieldGroup}>
                    <div className={styles.fieldRow}>
                      <label className={styles.fieldLabel} htmlFor="password">Password</label>
                      <a href="#forgot" onClick={(e) => e.preventDefault()} className={styles.forgotLink}>
                        Forgot password?
                      </a>
                    </div>
                    <div className={styles.fieldWrap}>
                      <span className={styles.fieldIcon}>
                        <Lock size={18} />
                      </span>
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
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

                {/* Error message */}
                {errorMessage && (
                  <StaggerItem>
                    <div className={styles.error} role="alert">
                      <AlertCircle size={18} className={styles.errorIcon} />
                      <span>{errorMessage}</span>
                    </div>
                  </StaggerItem>
                )}

                {/* Submit button */}
                <StaggerItem>
                  <button
                    className={styles.submit}
                    type="submit"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <span className={styles.btnSpinner} />
                        <span>Signing in…</span>
                      </>
                    ) : (
                      <>
                        <span>Sign in</span>
                        <ArrowRight size={18} className={styles.submitArrow} />
                      </>
                    )}
                  </button>
                </StaggerItem>

                {/* Divider + Demo student button */}
                <StaggerItem>
                  <div className={styles.divider}>
                    <span>Quick Access Demo</span>
                  </div>
                  <button
                    id="btn-demo-student-login"
                    type="button"
                    onClick={() => {
                      dispatch(setCredentials({
                        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2YWE0ZjM3ZGQ0YjZiZTExM2IwNzVjMjciLCJpZCI6IjZhYTRmMzdkZDRiNmJlMTEzYjA3NWMyNyIsImVtYWlsIjoiYWxleC5yaXZlcmFAYXBleC5lZHUiLCJyb2xlcyI6WyJTVFVERU5UIl0sImluc3RpdHV0aW9uSWQiOiI2YWE0ZjM3Y2Q0YjZiZTExM2IwNzVjMjUiLCJpYXQiOjE3ODkyMjM4MTUsImV4cCI6MTgyMDc1OTgxNX0.CicI_GAS6q2f_WKCMGnqaJ8Hj4MbbZQIHbLr-TMyEeo',
                        user: {
                          id: '6aa4f37dd4b6be113b075c27',
                          name: 'Alex Rivera',
                          email: 'alex.rivera@apex.edu',
                          roles: ['STUDENT'],
                          institutionId: '6aa4f37cd4b6be113b075c25'
                        }
                      }));
                      navigate('/student/dashboard', { replace: true });
                    }}
                    className={styles.demoBtn}
                  >
                    <GraduationCap size={18} />
                    <span>Demo Student Login (Alex Rivera)</span>
                    <ChevronRight size={16} className={styles.demoBtnArrow} />
                  </button>
                </StaggerItem>

              </StaggerList>
            </form>

            <div className={styles.footerNote}>
              <ShieldCheck size={14} className={styles.securityIcon} />
              <span>Enterprise-grade encryption & security · © {new Date().getFullYear()} CollegeERP</span>
            </div>
          </div>
        </div>

      </div>
    </PageTransition>
  );
}
