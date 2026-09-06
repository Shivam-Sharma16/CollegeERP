import { DashboardShell } from '../components/DashboardShell';
import styles from './FacultyDashboard.module.css';

export default function FacultyDashboard() {
  return (
    <DashboardShell
      title="Faculty Dashboard"
      subtitle="Teaching & assessment"
      icon="👨‍🏫"
    />
  );
}
