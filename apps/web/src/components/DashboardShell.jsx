import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useLogoutMutation } from '../api/authApi';
import styles from '../styles/Dashboard.module.css';

// Import newly created UI components
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Table } from './ui/Table';
import { Modal } from './ui/Modal';
import { Skeleton } from './ui/Skeleton';
import { useToast } from './ui/ToastContext';

/**
 * Reusable dashboard shell used as the placeholder for every role dashboard.
 * Replace the inner content as feature pages are built out in later phases.
 */
export function DashboardShell({ title, subtitle, icon, navLinks = [] }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [logout] = useLogoutMutation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // UI Demo state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { addToast } = useToast();
  const [sortCol, setSortCol] = useState('name');
  const [sortDir, setSortDir] = useState('asc');

  async function handleLogout() {
    try { await logout().unwrap(); } catch { /* authSlice already cleared optimistically */ }
    navigate('/login', { replace: true });
  }

  const demoColumns = [
    { key: 'id', label: 'ID', sortable: true },
    { key: 'name', label: 'Name', sortable: true },
    { key: 'status', label: 'Status', sortable: false },
  ];

  const demoData = [
    { id: 1, name: 'Alice', status: 'Active' },
    { id: 2, name: 'Bob', status: 'Pending' },
    { id: 3, name: 'Charlie', status: 'Active' },
  ];

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  return (
    <div className={styles.layout}>
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className={`${styles.sidebar} ${mobileMenuOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.sidebarHeader}>
          <button 
            className={styles.menuBtn} 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            ☰
          </button>
          <span className={styles.sidebarIcon}>{icon}</span>
          <span className={styles.sidebarTitle}>{title}</span>
        </div>

        <nav className={styles.nav}>
          {navLinks.map((link) => (
            <button
              key={link.label}
              className={styles.navItem}
              onClick={() => {
                setMobileMenuOpen(false);
                navigate(link.to);
              }}
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

        <div className={styles.placeholder} style={{ textAlign: 'left', alignItems: 'flex-start' }}>
          <h2>Component Library Showcase</h2>
          <p style={{ marginBottom: '20px' }}>Testing the new Phase 26 base UI components.</p>
          
          <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
            <Button variant="primary" onClick={() => setIsModalOpen(true)}>Open Modal</Button>
            <Button variant="secondary" onClick={() => addToast({ type: 'success', title: 'Success', message: 'Action completed successfully.' })}>Toast Success</Button>
            <Button variant="ghost" onClick={() => addToast({ type: 'info', title: 'Info', message: 'Here is some information.' })}>Toast Info</Button>
            <Button variant="danger" onClick={() => addToast({ type: 'error', title: 'Error', message: 'Something went wrong!' })}>Toast Error</Button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', width: '100%', marginBottom: '24px' }}>
            <Card interactive>
              <h3 style={{ marginBottom: '8px' }}>Interactive Card</h3>
              <p>Hover me to see the lift animation and shadow effect.</p>
            </Card>
            <Card>
              <h3 style={{ marginBottom: '16px' }}>Skeleton Loaders</h3>
              <Skeleton height="20px" style={{ marginBottom: '8px' }} />
              <Skeleton height="20px" width="80%" style={{ marginBottom: '8px' }} />
              <Skeleton height="20px" width="60%" />
            </Card>
          </div>

          <Card style={{ width: '100%' }}>
            <h3 style={{ marginBottom: '16px' }}>Data Table</h3>
            <Table 
              columns={demoColumns} 
              data={demoData} 
              sortColumn={sortCol}
              sortDirection={sortDir}
              onSort={handleSort}
            />
          </Card>
        </div>
      </main>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Example Modal">
        <p style={{ marginBottom: '16px' }}>This modal uses Framer Motion for entrance and exit animations.</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
          <Button variant="primary" onClick={() => setIsModalOpen(false)}>Confirm</Button>
        </div>
      </Modal>
    </div>
  );
}
