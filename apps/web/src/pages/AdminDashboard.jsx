import { DashboardShell } from '../components/DashboardShell';
import styles from './AdminDashboard.module.css';

export default function AdminDashboard() {
  return (
    <DashboardShell
      title="Admin Dashboard"
      subtitle="System-wide management"
      icon="⚙️"
    />
  );
}
