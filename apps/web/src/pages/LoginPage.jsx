import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLoginMutation } from '../api/authApi';
import { useAppSelector, useAppDispatch } from '../store';
import { setCredentials } from '../features/ui/authSlice';
import { selectInstitutionName, selectInstitutionLogo } from '../features/ui/themeSlice';
import usePageMeta from '../hooks/usePageMeta';
import { PageTransition } from '../components/ui/PageTransition';
import { StaggerList, StaggerItem } from '../components/ui/StaggerList';
import styles from './LoginPage.module.css';

export default function LoginPage() {
  usePageMeta({
    title: 'Login',
    description: 'Log in to the College ERP system to access your dashboard.',
    isPublic: true
  });

  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const from     = location.state?.from?.pathname ?? '/';

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');

  // Get dynamic institution data
  const institutionName = useAppSelector(selectInstitutionName);
  const institutionLogo = useAppSelector(selectInstitutionLogo);

  // RTK Query mutation — provides isLoading and error automatically.
  // authApi.login's onQueryStarted dispatches setCredentials to authSlice
  // so ProtectedRoute selectors update before we navigate.
  const [login, { isLoading, error }] = useLoginMutation();

  const errorMessage = error?.data?.message ?? error?.data?.error ?? error?.error ?? '';

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      await login({ email, password }).unwrap();
      navigate(from, { replace: true });
    } catch { /* error rendered from RTK Query's `error` state */ }
  }

  return (
    <PageTransition>
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.logoWrap}>
            {institutionLogo ? (
              <img src={institutionLogo} alt={institutionName} className={styles.institutionLogo} />
            ) : (
              <div className={styles.logo}>🎓</div>
            )}
            <h1 className={styles.appName}>{institutionName}</h1>
            <p className={styles.tagline}>Unified academic management</p>
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
                        token: 'mock-jwt-student-token',
                        user: {
                          id: '65e000000000000000000001',
                          name: 'Alex Rivera',
                          email: 'alex.rivera@college.edu',
                          roles: ['STUDENT']
                        }
                      }));
                      navigate('/attendance', { replace: true });
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
