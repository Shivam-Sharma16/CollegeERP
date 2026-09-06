import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useSuperadminSignupMutation } from '../api/authApi';
import { useAppSelector } from '../store';
import { selectInstitutionName, selectInstitutionLogo } from '../features/ui/themeSlice';
import styles from './SuperadminSignupPage.module.css';

export default function SuperadminSignupPage() {
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [setupKey, setSetupKey] = useState('');

  const institutionName = useAppSelector(selectInstitutionName);
  const institutionLogo = useAppSelector(selectInstitutionLogo);

  const [signup, { isLoading, error }] = useSuperadminSignupMutation();

  const errorMessage = error?.data?.message ?? error?.data?.error ?? error?.error ?? '';
  const isAlreadySetup = errorMessage.toLowerCase().includes('already') || error?.status === 403 || error?.status === 409;

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      await signup({ name, email, password, setupKey }).unwrap();
      navigate('/login', { replace: true });
    } catch { /* error handled by UI */ }
  }

  if (isAlreadySetup) {
    return (
      <div className={styles.page}>
        <div className={styles.card} style={{ textAlign: 'center' }}>
          <div className={styles.logoWrap}>
            <div className={styles.logo}>🛡️</div>
            <h1 className={styles.appName}>Setup Complete</h1>
          </div>
          <p style={{ marginBottom: '24px', color: 'var(--color-text-muted)' }}>
            This institution has already been initialized with a Superadmin account.
          </p>
          <Link to="/login" className={styles.submit} style={{ display: 'inline-block', textDecoration: 'none' }}>
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logoWrap}>
          {institutionLogo ? (
            <img src={institutionLogo} alt={institutionName} className={styles.institutionLogo} />
          ) : (
            <div className={styles.logo}>🛡️</div>
          )}
          <h1 className={styles.appName}>Institution Setup</h1>
          <p className={styles.tagline}>Create the initial Superadmin account</p>
        </div>

        <form className={`${styles.form} ${errorMessage ? styles.shake : ''}`} onSubmit={handleSubmit}>
          <div className={styles.floatingLabel}>
            <input
              id="setupKey"
              type="text"
              required
              value={setupKey}
              onChange={(e) => setSetupKey(e.target.value)}
              placeholder=" "
            />
            <label htmlFor="setupKey">Setup Key</label>
          </div>
          
          <div className={styles.floatingLabel}>
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder=" "
            />
            <label htmlFor="name">Full Name</label>
          </div>

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

          <div className={styles.floatingLabel}>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder=" "
            />
            <label htmlFor="password">Password</label>
          </div>

          {errorMessage && (
            <p className={styles.error} role="alert">{errorMessage}</p>
          )}

          <button
            className={styles.submit}
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? 'Creating account…' : 'Complete Setup'}
          </button>
        </form>
      </div>
    </div>
  );
}
