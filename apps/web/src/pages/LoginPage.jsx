import { useState } from 'react';
import { useNavigate, useLocation, useParams, Link } from 'react-router-dom';
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
      const payload = { email, password };
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
      <div className={styles.page}>
        <div className={styles.card} style={{ textAlign: 'center', padding: '3rem 1rem' }}>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p style={{ marginTop: '1rem', color: 'var(--color-text-muted)' }}>Resolving institution portal...</p>
        </div>
      </div>
    );
  }

  if (isTenantPortal && (tenantError || (!isTenantLoading && !tenant))) {
    return (
      <div className={styles.page}>
        <div className={styles.card} style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text)' }}>Institution Not Found</h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginTop: '0.5rem', marginBottom: '1.5rem' }}>
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
        <div className={styles.card}>
          <div className={styles.logoWrap}>
            {institutionLogo ? (
              <img src={institutionLogo} alt={institutionName} className={styles.institutionLogo} />
            ) : (
              <div className={styles.logo}>{isSuperAdminMode ? '🛡️' : (isTenantPortal ? '🏫' : '🎓')}</div>
            )}
            <h1 className={styles.appName}>{institutionName}</h1>
            <p className={styles.tagline}>
              {isTenantPortal
                ? `Campus Portal • ${tenant?.code || ''}`
                : isSuperAdminMode
                ? 'Central Platform Administration'
                : 'Unified academic management'}
            </p>
          </div>

          <form className={`${styles.form} ${errorMessage ? styles.shake : ''}`} onSubmit={handleSubmit}>
            <StaggerList>
              <StaggerItem>
                <div className={styles.floatingLabel}>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder=" "
                  />
                  <label htmlFor="email">Email address</label>
                </div>
              </StaggerItem>

              <StaggerItem>
                <div className={styles.floatingLabel}>
                  <input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder=" "
                  />
                  <label htmlFor="password">Password</label>
                </div>
              </StaggerItem>

              {errorMessage && (
                <StaggerItem>
                  <p className={styles.error} role="alert">{errorMessage}</p>
                </StaggerItem>
              )}

              <StaggerItem>
                <button
                  className={styles.submit}
                  type="submit"
                  disabled={isLoading}
                >
                  {isLoading ? 'Signing in…' : 'Sign in'}
                </button>
              </StaggerItem>

              <StaggerItem>
                <div style={{ marginTop: '1rem', borderTop: '1px solid var(--color-border)', paddingTop: '0.75rem', textAlign: 'center' }}>
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
                    🎓 Quick Demo Student Login
                  </button>
                </div>
              </StaggerItem>
            </StaggerList>
          </form>
        </div>
      </div>
    </PageTransition>
  );
}
