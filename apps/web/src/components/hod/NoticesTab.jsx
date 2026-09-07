import { useListMyNoticesQuery } from '../../api/noticeApi';
import { Timeline } from '../ui/Timeline';

export function NoticesTab() {
  const { data, isLoading } = useListMyNoticesQuery();
  const notices = data?.data || [];

  return (
    <div style={{ background: 'var(--color-surface)', padding: 'var(--spacing-5)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
      <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginBottom: 'var(--spacing-4)' }}>Notices & Announcements</h3>
      <div style={{ maxWidth: '800px' }}>
        <Timeline items={notices} isLoading={isLoading} />
      </div>
    </div>
  );
}
