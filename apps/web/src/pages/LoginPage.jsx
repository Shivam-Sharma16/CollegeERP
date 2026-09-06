import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLoginMutation } from '../api/authApi';
import { useAppSelector } from '../store';
import { selectInstitutionName, selectInstitutionLogo } from '../features/ui/themeSlice';
import styles from '../styles/Login.module.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
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

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@college.edu"
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {errorMessage && (
            <p className={styles.error} role="alert">{errorMessage}</p>
          )}

          <button
            className={styles.submit}
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
