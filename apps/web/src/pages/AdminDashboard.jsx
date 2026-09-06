import { DashboardShell } from '../components/DashboardShell';

const NAV = [
  { label: 'Overview',    icon: '🏠', to: '/admin' },
  { label: 'Users',       icon: '👥', to: '/admin/users' },
  { label: 'Departments', icon: '🏛️', to: '/admin/departments' },
  { label: 'Fees',        icon: '💰', to: '/admin/fees' },
  { label: 'Notices',     icon: '📢', to: '/admin/notices' },
  { label: 'AI Queries',  icon: '🤖', to: '/admin/ai' },
];

export default function AdminDashboard() {
  return (
    <DashboardShell
      title="Admin Dashboard"
      subtitle="System-wide management"
      icon="⚙️"
      navLinks={NAV}
    />
  );
}
