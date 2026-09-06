import { DashboardShell } from '../components/DashboardShell';

const NAV = [
  { label: 'Department',   icon: '🏛️', to: '/hod' },
  { label: 'At-Risk Alert',icon: '⚠️',  to: '/hod/at-risk' },
  { label: 'Fee Defaulters',icon: '💰', to: '/hod/defaulters' },
  { label: 'Notices',      icon: '📢', to: '/hod/notices' },
];

export default function HodDashboard() {
  return (
    <DashboardShell
      title="HOD Dashboard"
      subtitle="Department management"
      icon="🏛️"
      navLinks={NAV}
    />
  );
}
