import { DashboardShell } from '../components/DashboardShell';

const NAV = [
  { label: 'My Timetable',  icon: '📅', to: '/faculty' },
  { label: 'Attendance',    icon: '✅', to: '/faculty/attendance' },
  { label: 'Enter Marks',   icon: '📝', to: '/faculty/marks' },
  { label: 'Notices',       icon: '📢', to: '/faculty/notices' },
  { label: 'AI Assistant',  icon: '🤖', to: '/faculty/ai' },
];

export default function FacultyDashboard() {
  return (
    <DashboardShell
      title="Faculty Dashboard"
      subtitle="Teaching & assessment"
      icon="👨‍🏫"
      navLinks={NAV}
    />
  );
}
