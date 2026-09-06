import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useLogoutMutation } from '../api/authApi';
import styles from '../styles/Dashboard.module.css';

/**
 * Reusable dashboard shell used as the placeholder for every role dashboard.
 * Replace the inner content as feature pages are built out in later phases.
 */
export function DashboardShell({ title, subtitle, icon, navLinks = [] }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [logout] = useLogoutMutation();

  async function handleLogout() {
    try { await logout().unwrap(); } catch { /* authSlice already cleared optimistically */ }
    navigate('/login', { replace: true });
  }

  return (
    <div className={styles.layout}>
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <span className={styles.sidebarIcon}>{icon}</span>
          <span className={styles.sidebarTitle}>{title}</span>
        </div>

        <nav className={styles.nav}>
          {navLinks.map((link) => (
            <button
              key={link.label}
              className={styles.navItem}
              onClick={() => navigate(link.to)}
            >
              <span className={styles.navIcon}>{link.icon}</span>
              {link.label}
            </button>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.userInfo}>
            <div className={styles.avatar}>
              {(user?.name ?? 'U')[0].toUpperCase()}
            </div>
            <div>
              <div className={styles.userName}>{user?.name ?? 'User'}</div>
              <div className={styles.userEmail}>{user?.email ?? ''}</div>
            </div>
          </div>
          <button className={styles.logoutBtn} onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main content area ────────────────────────────────────────────── */}
      <main className={styles.main}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.pageTitle}>{title}</h1>
            {subtitle && <p className={styles.pageSubtitle}>{subtitle}</p>}
          </div>
          <div className={styles.roleBadge}>
            {user?.roles?.join(', ') ?? ''}
          </div>
        </header>

        <div className={styles.placeholder}>
          <div className={styles.placeholderIcon}>{icon}</div>
          <h2>Coming Soon</h2>
          <p>This section will be built out in a later phase.</p>
        </div>
      </main>
    </div>
  );
}
