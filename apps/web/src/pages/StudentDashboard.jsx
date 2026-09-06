import { DashboardShell } from '../components/DashboardShell';

const NAV = [
  { label: 'Overview',    icon: '🏠', to: '/student' },
  { label: 'Attendance',  icon: '✅', to: '/student/attendance' },
  { label: 'Results',     icon: '📊', to: '/student/results' },
  { label: 'Fees',        icon: '💳', to: '/student/fees' },
  { label: 'Notices',     icon: '📢', to: '/student/notices' },
  { label: 'AI Assistant',icon: '🤖', to: '/student/ai' },
];

export default function StudentDashboard() {
  return (
    <DashboardShell
      title="Student Portal"
      subtitle="Your academic overview"
      icon="🎓"
      navLinks={NAV}
    />
  );
}
