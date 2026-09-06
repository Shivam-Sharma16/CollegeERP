import { DashboardShell } from '../components/DashboardShell';
import styles from './StudentDashboard.module.css';

export default function StudentDashboard() {
  return (
    <DashboardShell
      title="Student Portal"
      subtitle="Your academic overview"
      icon="🎓"
    />
  );
}
