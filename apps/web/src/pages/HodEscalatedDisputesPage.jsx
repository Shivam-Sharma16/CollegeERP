import { DashboardShell } from '../components/DashboardShell';
import { EscalatedDisputesTab } from '../components/hod/EscalatedDisputesTab';
import { PageTransition } from '../components/ui/PageTransition';

export default function HodEscalatedDisputesPage() {
  return (
    <DashboardShell
      title="Escalated Disputes"
      subtitle="Department-wide attendance disputes escalated by Class Coordinators"
      icon="AlertTriangle"
    >
      <PageTransition>
        <EscalatedDisputesTab />
      </PageTransition>
    </DashboardShell>
  );
}
