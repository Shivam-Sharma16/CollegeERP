import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DashboardShell } from '../components/DashboardShell';
import { AnimatedTabs } from '../components/ui/AnimatedTabs';
import { PageTransition } from '../components/ui/PageTransition';
import { CcDisputesTab } from '../components/cc/CcDisputesTab';
import { CcNoticesTab } from '../components/cc/CcNoticesTab';

export default function CcWorkspace() {
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get('tab') === 'notices' ? 'notices' : 'disputes';

  const tabs = [
    { id: 'disputes', label: 'Attendance Disputes', content: <CcDisputesTab /> },
    { id: 'notices', label: 'Section Notices', content: <CcNoticesTab /> }
  ];

  return (
    <DashboardShell title="CC Workspace" subtitle="Disputes & Notices" icon="🛠️">
      <PageTransition>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-6)' }}>
          <AnimatedTabs tabs={tabs} defaultTabId={defaultTab} />
        </div>
      </PageTransition>
    </DashboardShell>
  );
}
