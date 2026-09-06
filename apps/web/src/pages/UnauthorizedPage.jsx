import { useNavigate } from 'react-router-dom';
import { useLogoutMutation } from '../api/authApi';
import styles from './UnauthorizedPage.module.css';

export default function UnauthorizedPage() {
  const navigate = useNavigate();
  const [logout] = useLogoutMutation();

  async function handleLogout() {
    try { await logout().unwrap(); } catch { /* optimistically cleared */ }
    navigate('/login', { replace: true });
  }

  return (
    <div className={styles.placeholder}>
      <div className={styles.placeholderIcon}>🚫</div>
      <h1>Access Denied</h1>
      <p>You don't have permission to view this page.</p>
      <div className={styles.actions}>
        <button className={styles.btn} onClick={() => navigate(-1)}>Go back</button>
        <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={handleLogout}>
          Log out
        </button>
      </div>
    </div>
  );
}
