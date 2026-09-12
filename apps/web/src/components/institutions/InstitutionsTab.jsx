import { useState, useMemo } from 'react';
import { useListInstitutionsQuery } from '../../api/institutionsApi';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { Skeleton } from '../ui/Skeleton';
import { CreateInstitutionModal } from './CreateInstitutionModal';
import { 
  ExternalLink, 
  Copy, 
  Check, 
  Plus, 
  School, 
  ShieldCheck, 
  Globe, 
  User, 
  Users,
  Search 
} from 'lucide-react';
import { useToast } from '../ui/ToastContext';
import styles from './InstitutionsTab.module.css';

export function InstitutionsTab() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: rawInstitutions, isLoading, error, refetch } = useListInstitutionsQuery();
  const institutions = useMemo(() => {
    if (!rawInstitutions) return [];
    if (Array.isArray(rawInstitutions)) return rawInstitutions;
    if (Array.isArray(rawInstitutions.data)) return rawInstitutions.data;
    return [];
  }, [rawInstitutions]);

  const { showToast } = useToast();

  const handleCopyLink = (slug) => {
    const url = `${window.location.origin}/inst/${slug}/login`;
    navigator.clipboard.writeText(url);
    setCopiedSlug(slug);
    if (showToast) {
      showToast('Whitelabel Portal URL copied to clipboard!', 'info');
    }
    setTimeout(() => setCopiedSlug(null), 2500);
  };

  const filteredInstitutions = useMemo(() => {
    if (!searchQuery.trim()) return institutions;
    const query = searchQuery.toLowerCase().trim();
    return institutions.filter((inst) => {
      const nameMatch = inst.name?.toLowerCase().includes(query);
      const codeMatch = inst.code?.toLowerCase().includes(query);
      const slugMatch = inst.slug?.toLowerCase().includes(query);
      const adminMatch = inst.adminUserId?.email?.toLowerCase().includes(query) ||
                         inst.adminUserId?.name?.toLowerCase().includes(query);
      return nameMatch || codeMatch || slugMatch || adminMatch;
    });
  }, [institutions, searchQuery]);

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <Skeleton height="36px" width="40%" />
        <Skeleton height="200px" width="100%" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.errorBanner}>
          <div>
            <strong>Failed to load institutions:</strong> {error?.data?.message || error?.message || 'Server error'}
          </div>
          <Button variant="secondary" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header with Title and Action Button */}
      <div className={styles.header}>
        <div>
          <div className={styles.titleRow}>
            <h2 className={styles.title}>College Institutions</h2>
            <span className={styles.countBadge}>
              {institutions.length} {institutions.length === 1 ? 'Campus' : 'Campuses'}
            </span>
          </div>
          <p className={styles.subtitle}>
            Manage multi-tenant college institutions, dedicated admins, and white-labeled portals.
          </p>
        </div>
        <Button variant="primary" onClick={() => setIsCreateOpen(true)}>
          <Plus size={16} /> Create Institution
        </Button>
      </div>

      {/* Search and filter controls */}
      {institutions.length > 0 && (
        <div className={styles.controlsRow}>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search by name, code, slug, or admin..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      )}

      {/* Main Content Area */}
      {institutions.length === 0 ? (
        <EmptyState
          icon={<School size={48} />}
          title="No institutions created yet"
          description="Create your first college or university tenant to launch an isolated whitelabeled portal with its own admin."
          actionLabel="Create First Institution"
          onAction={() => setIsCreateOpen(true)}
        />
      ) : filteredInstitutions.length === 0 ? (
        <EmptyState
          icon={<Search size={40} />}
          title="No matching institutions"
          description={`No institutions match your search query "${searchQuery}".`}
        />
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Institution</th>
                <th>Whitelabel Portal URL</th>
                <th>Designated Admin</th>
                <th>Users</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInstitutions.map((inst) => {
                const portalPath = `/inst/${inst.slug}/login`;
                const isCopied = copiedSlug === inst.slug;
                const primaryColor = inst.branding?.primaryColor || '#4f46e5';

                return (
                  <tr key={inst._id || inst.code}>
                    {/* Institution Name & Avatar */}
                    <td>
                      <div className={styles.instCell}>
                        <div
                          className={styles.instAvatar}
                          style={{ backgroundColor: primaryColor }}
                        >
                          {inst.branding?.logoUrl ? (
                            <img
                              src={inst.branding.logoUrl}
                              alt={inst.name}
                              className={styles.instLogoImg}
                            />
                          ) : (
                            <span>{inst.code?.[0] || '🏛️'}</span>
                          )}
                        </div>
                        <div>
                          <div className={styles.instName}>{inst.name}</div>
                          <span className={styles.instCodeBadge}>{inst.code}</span>
                        </div>
                      </div>
                    </td>

                    {/* Whitelabel Portal URL */}
                    <td>
                      <div className={styles.slugCell}>
                        <code className={styles.slugCode}>{portalPath}</code>
                        <button
                          type="button"
                          className={`${styles.copyBtn} ${isCopied ? styles.copiedBtn : ''}`}
                          onClick={() => handleCopyLink(inst.slug)}
                          title="Copy Whitelabel Portal URL"
                        >
                          {isCopied ? (
                            <>
                              <Check size={13} /> Copied
                            </>
                          ) : (
                            <>
                              <Copy size={13} /> Copy
                            </>
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Designated Admin */}
                    <td>
                      <div className={styles.adminName}>
                        {inst.adminUserId?.name || 'Designated Admin'}
                      </div>
                      <div className={styles.adminEmail}>
                        {inst.adminUserId?.email || 'N/A'}
                      </div>
                    </td>

                    {/* User Count */}
                    <td>
                      <span className={styles.userCountBadge}>
                        <Users size={13} />
                        {inst.userCount ?? 1} {(inst.userCount ?? 1) === 1 ? 'user' : 'users'}
                      </span>
                    </td>

                    {/* Status */}
                    <td>
                      <span
                        className={`${styles.statusBadge} ${
                          inst.status === 'ACTIVE'
                            ? styles.statusActive
                            : styles.statusSuspended
                        }`}
                      >
                        <ShieldCheck size={13} />
                        {inst.status || 'ACTIVE'}
                      </span>
                    </td>

                    {/* Action Launch Portal */}
                    <td>
                      <a
                        href={portalPath}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.launchBtn}
                        title={`Open ${inst.name} Whitelabel Portal`}
                      >
                        Launch <ExternalLink size={13} />
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal to Create Institution */}
      <CreateInstitutionModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />
    </div>
  );
}
