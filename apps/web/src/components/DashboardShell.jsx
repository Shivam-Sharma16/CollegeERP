import { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import * as LucideIcons from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useLogoutMutation } from '../api/authApi';
import { selectSidebarCollapsed, toggleSidebar } from '../features/ui/sidebarSlice';
import { NAV_ITEMS } from '../config/navigation';
import styles from './DashboardShell.module.css';

// Import UI components
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Table } from './ui/Table';
import { Modal } from './ui/Modal';
import { Skeleton } from './ui/Skeleton';
import { useToast } from './ui/ToastContext';

// Safe icon renderer
function Icon({ name }) {
  const LucideIcon = LucideIcons[name] || LucideIcons.Circle;
  return <LucideIcon size={18} />;
}

export function DashboardShell({ title, subtitle, icon, children }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const [logout] = useLogoutMutation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const collapsed = useSelector(selectSidebarCollapsed);
  
  // UI Demo state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { addToast } = useToast();
  const [sortCol, setSortCol] = useState('name');
  const [sortDir, setSortDir] = useState('asc');

  async function handleLogout() {
    try { await logout().unwrap(); } catch { /* authSlice already cleared optimistically */ }
    navigate('/login', { replace: true });
  }

  // --- Dynamic Navigation Logic ---
  const userRoles = useMemo(() => {
    return user?.roles?.map(r => r.toLowerCase()) || [];
  }, [user]);

  const accessibleNavItems = useMemo(() => {
    return NAV_ITEMS.filter(item => 
      item.roles.some(role => userRoles.includes(role))
    );
  }, [userRoles]);

  const personalItems = accessibleNavItems.filter(item => item.key === 'dashboard' || item.key === 'profile');
  const roleItems = accessibleNavItems.filter(item => item.key !== 'dashboard' && item.key !== 'profile');

  const hasMultipleRoles = userRoles.length > 1;

  // Attempt to match the current path. Fallback to exact match or prefix match.
  const activeKey = useMemo(() => {
    const current = NAV_ITEMS.find(item => location.pathname.startsWith(item.path));
    return current ? current.key : null;
  }, [location.pathname]);

  const renderNavItem = (item) => {
    const isActive = activeKey === item.key;
    return (
      <button
        key={item.key}
        className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
        onClick={() => {
          setMobileMenuOpen(false);
          navigate(item.path);
        }}
        title={collapsed ? item.label : undefined}
      >
        {isActive && (
          <motion.div
            layoutId="activeNav"
            className={styles.activeIndicator}
            initial={false}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          />
        )}
        <div className={styles.navItemContent}>
          <span className={styles.navIcon}><Icon name={item.icon} /></span>
          {!collapsed && <span>{item.label}</span>}
        </div>
      </button>
    );
  };

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
      <aside 
        className={`${styles.sidebar} ${mobileMenuOpen ? styles.sidebarOpen : ''}`} 
        style={{ width: collapsed ? '72px' : '240px' }}
      >
        <div className={styles.sidebarHeader} style={{ justifyContent: collapsed ? 'center' : 'flex-start' }}>
          <button 
            className={styles.menuBtn} 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            <LucideIcons.Menu size={20} />
          </button>
          {!collapsed && <span className={styles.sidebarIcon}>{icon}</span>}
          {!collapsed && <span className={styles.sidebarTitle}>{title}</span>}
          
          <button 
            onClick={() => dispatch(toggleSidebar())} 
            style={{ marginLeft: collapsed ? '0' : 'auto', background: 'transparent', color: 'var(--color-text-muted)', border: 'none', cursor: 'pointer' }}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <LucideIcons.ChevronRight size={18} /> : <LucideIcons.ChevronLeft size={18} />}
          </button>
        </div>

        {hasMultipleRoles && !collapsed && (
          <div className={styles.roleSwitcher}>
            <span>Active Roles: {userRoles.length}</span>
            <LucideIcons.ChevronDown size={14} />
          </div>
        )}

        <nav className={styles.nav}>
          <AnimatePresence>
            {personalItems.length > 0 && personalItems.map(renderNavItem)}
            
            {roleItems.length > 0 && personalItems.length > 0 && (
              <div className={styles.navDivider} />
            )}
            
            {roleItems.length > 0 && roleItems.map(renderNavItem)}
          </AnimatePresence>
        </nav>

        <div className={styles.sidebarFooter} style={{ padding: collapsed ? 'var(--spacing-4) 0' : 'var(--spacing-4)', alignItems: collapsed ? 'center' : 'stretch' }}>
          {!collapsed && (
            <div className={styles.userInfo}>
              <div className={styles.avatar}>
                {(user?.name ?? 'U')[0].toUpperCase()}
              </div>
              <div>
                <div className={styles.userName}>{user?.name ?? 'User'}</div>
                <div className={styles.userEmail}>{user?.email ?? ''}</div>
              </div>
            </div>
          )}
          {collapsed && (
            <div className={styles.avatar} style={{ marginBottom: '16px' }} title={user?.name ?? 'User'}>
              {(user?.name ?? 'U')[0].toUpperCase()}
            </div>
          )}
          <button className={styles.logoutBtn} onClick={handleLogout} title={collapsed ? "Sign out" : undefined}>
            {collapsed ? <LucideIcons.LogOut size={16} style={{ margin: '0 auto' }} /> : 'Sign out'}
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

        {children ? (
          <div className={styles.contentWrapper}>
            {children}
          </div>
        ) : (
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
        )}
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
