import { useState, useMemo } from 'react';
import { DashboardShell } from '../components/DashboardShell';
import { useListMyNoticesQuery } from '../api/noticeApi';
import { Bell, Filter, Calendar, Building, Users, Globe } from 'lucide-react';
import styles from './StudentNoticesPage.module.css';

export default function StudentNoticesPage() {
  const { data: noticesData, isLoading, error } = useListMyNoticesQuery();
  const [filter, setFilter] = useState('All'); // All, Institution, Department, Section

  const notices = noticesData?.data || [];

  const filteredNotices = useMemo(() => {
    return notices.filter(notice => {
      if (filter === 'All') return true;
      
      const hasDept = notice.targeting?.departments?.length > 0;
      const hasSec = notice.targeting?.sections?.length > 0;
      const isInst = !hasDept && !hasSec;

      if (filter === 'Institution') return isInst;
      if (filter === 'Department') return hasDept;
      if (filter === 'Section') return hasSec;
      
      return true;
    });
  }, [notices, filter]);

  const getNoticeScope = (notice) => {
    const hasDept = notice.targeting?.departments?.length > 0;
    const hasSec = notice.targeting?.sections?.length > 0;
    if (hasSec) return { label: 'Section', icon: Users, color: 'var(--info-600)', bg: 'var(--info-50)' };
    if (hasDept) return { label: 'Department', icon: Building, color: 'var(--warning-600)', bg: 'var(--warning-50)' };
    return { label: 'Institution-wide', icon: Globe, color: 'var(--primary-600)', bg: 'var(--primary-50)' };
  };

  return (
    <DashboardShell
      title="Notices & Announcements"
      subtitle="Stay updated with important information"
      icon="📢"
    >
      <div className={styles.container}>
        <div className={styles.filterSection}>
          <div className={styles.filterLabel}>
            <Filter size={16} /> Filter by scope:
          </div>
          <div className={styles.filterTabs}>
            {['All', 'Institution', 'Department', 'Section'].map(f => (
              <button
                key={f}
                className={`${styles.filterBtn} ${filter === f ? styles.activeFilter : ''}`}
                onClick={() => setFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className={styles.loading}>Loading notices...</div>
        ) : error ? (
          <div className={styles.error}>Failed to load notices. Please try again later.</div>
        ) : filteredNotices.length === 0 ? (
          <div className={styles.empty}>
            <Bell size={48} className={styles.emptyIcon} />
            <p>No notices found for the selected filter.</p>
          </div>
        ) : (
          <div className={styles.feed}>
            {filteredNotices.map(notice => {
              const scope = getNoticeScope(notice);
              const ScopeIcon = scope.icon;
              
              return (
                <div key={notice._id} className={styles.noticeCard}>
                  <div className={styles.noticeHeader}>
                    <h3 className={styles.noticeTitle}>{notice.title}</h3>
                    <div 
                      className={styles.scopeBadge} 
                      style={{ color: scope.color, backgroundColor: scope.bg }}
                    >
                      <ScopeIcon size={14} />
                      {scope.label}
                    </div>
                  </div>
                  
                  <div className={styles.noticeMeta}>
                    <Calendar size={14} />
                    {new Date(notice.publishedAt || notice.createdAt).toLocaleDateString(undefined, {
                      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </div>
                  
                  <div className={styles.noticeBody}>
                    {notice.body}
                  </div>
                  
                  {notice.attachments && notice.attachments.length > 0 && (
                    <div className={styles.attachments}>
                      <span className={styles.attachmentsLabel}>Attachments:</span>
                      {notice.attachments.map((att, i) => (
                        <a key={i} href={att.url} target="_blank" rel="noreferrer" className={styles.attachmentLink}>
                          {att.name || `Attachment ${i + 1}`}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
