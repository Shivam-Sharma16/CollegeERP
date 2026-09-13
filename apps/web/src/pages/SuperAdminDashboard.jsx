import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardShell } from '../components/DashboardShell';
import { StatCard } from '../components/ui/StatCard';
import { StaggerList, StaggerItem } from '../components/ui/StaggerList';
import { PageTransition } from '../components/ui/PageTransition';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/ToastContext';
import {
  useListInstitutionsQuery,
  useUpdateInstitutionMutation,
} from '../api/institutionsApi';
import { useGetDashboardStatsQuery } from '../api/reportsApi';
import { CreateInstitutionModal } from '../components/institutions/CreateInstitutionModal';
import {
  Building2,
  Users,
  ShieldCheck,
  Calendar,
  Plus,
  ExternalLink,
  Search,
  X,
  Settings,
  Globe,
  UserCheck,
  Layers,
  GraduationCap,
  Sparkles,
  ArrowUpRight,
  Filter,
} from 'lucide-react';
import styles from './SuperAdminDashboard.module.css';

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'SUSPENDED'

  const { data: rawInstitutions, isLoading: isLoadingInst } = useListInstitutionsQuery();
  const { data: statsData, isLoading: isLoadingStats } = useGetDashboardStatsQuery();
  const [updateInstitution] = useUpdateInstitutionMutation();

  const institutions = useMemo(() => {
    if (!rawInstitutions) return [];
    if (Array.isArray(rawInstitutions)) return rawInstitutions;
    if (Array.isArray(rawInstitutions.data)) return rawInstitutions.data;
    return [];
  }, [rawInstitutions]);

  const stats = statsData?.data || {};

  // ── Stat calculations ────────────────────────────────────────────────────
  const totalInstitutions = institutions.length;

  const totalStudentsPlatform = useMemo(() => {
    if (stats.totalStudents != null) return stats.totalStudents;
    return institutions.reduce((acc, inst) => acc + (inst.studentCount || 0), 0);
  }, [stats.totalStudents, institutions]);

  const totalAdmins = useMemo(() => {
    return institutions.filter((inst) => !!inst.adminUserId).length;
  }, [institutions]);

  const institutionsCreatedThisMonth = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    return institutions.filter((inst) => {
      if (!inst.createdAt) return false;
      const d = new Date(inst.createdAt);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }).length;
  }, [institutions]);

  // ── Search & Filter ──────────────────────────────────────────────────────
  const filteredInstitutions = useMemo(() => {
    let result = institutions;

    if (statusFilter === 'ACTIVE') {
      result = result.filter((inst) => (inst.isActive ?? inst.status === 'ACTIVE'));
    } else if (statusFilter === 'SUSPENDED') {
      result = result.filter((inst) => !(inst.isActive ?? inst.status === 'ACTIVE'));
    }

    if (!searchQuery.trim()) return result;
    const q = searchQuery.toLowerCase().trim();
    return result.filter((inst) => {
      const nameMatch = inst.name?.toLowerCase().includes(q);
      const codeMatch = inst.code?.toLowerCase().includes(q);
      const subdomainMatch =
        inst.subdomain?.toLowerCase().includes(q) || inst.slug?.toLowerCase().includes(q);
      const adminMatch =
        inst.adminUserId?.name?.toLowerCase().includes(q) ||
        inst.adminUserId?.email?.toLowerCase().includes(q);
      return nameMatch || codeMatch || subdomainMatch || adminMatch;
    });
  }, [institutions, statusFilter, searchQuery]);

  // ── Status toggle handler ────────────────────────────────────────────────
  const handleToggleStatus = async (inst) => {
    const currentActive = inst.isActive ?? inst.status === 'ACTIVE';
    const nextActive = !currentActive;
    const actionLabel = nextActive ? 'activated' : 'suspended';

    try {
      await updateInstitution({
        id: inst._id,
        isActive: nextActive,
        status: nextActive ? 'ACTIVE' : 'SUSPENDED',
      }).unwrap();

      showToast(`Institution "${inst.name}" ${actionLabel} successfully.`, 'success');
    } catch (err) {
      showToast(err?.data?.message || `Failed to update status for ${inst.name}`, 'error');
    }
  };

  return (
    <DashboardShell
      title="SuperAdmin Platform"
      subtitle="Central multi-tenant institution orchestration & infrastructure telemetry"
      icon="🛡️"
    >
      <PageTransition>
        <div className={styles.container}>
          {/* ── Top Bar ───────────────────────────────────────────────────── */}
          <div className={styles.topBar}>
            <div className={styles.topBarInfo}>
              <h1 className={styles.title}>System Fleet Telemetry</h1>
              <p className={styles.subtitle}>
                Real-time multi-tenant monitoring, dedicated portals, and campus orchestration
              </p>
            </div>
            <div className={styles.topActionsGroup}>
              <button
                type="button"
                className={styles.secondaryHeaderBtn}
                onClick={() => navigate('/superadmin/institutions')}
                title="Open Complete Multi-Tenant Fleet Management"
              >
                <Layers size={15} />
                <span>Fleet Management</span>
              </button>
              <button
                type="button"
                className={styles.secondaryHeaderBtn}
                onClick={() => navigate('/superadmin/settings')}
                title="Configure Platform Whitelabel & Global Settings"
              >
                <Settings size={15} />
                <span>Platform Settings</span>
              </button>
              <Button
                variant="primary"
                onClick={() => setIsCreateModalOpen(true)}
                style={{ flexShrink: 0 }}
              >
                <Plus size={16} style={{ marginRight: '6px' }} /> Create Institution
              </Button>
            </div>
          </div>

          {/* ── 4 Platform Stat Cards ─────────────────────────────────────── */}
          <StaggerList className={styles.statsGrid}>
            <StaggerItem>
              <StatCard
                title="Total Institutions"
                value={totalInstitutions}
                icon="🏛️"
                isLoading={isLoadingInst}
              />
            </StaggerItem>
            <StaggerItem>
              <StatCard
                title="Total Students platform-wide"
                value={totalStudentsPlatform}
                icon="🎓"
                isLoading={isLoadingStats && isLoadingInst}
              />
            </StaggerItem>
            <StaggerItem>
              <StatCard
                title="Total Admins"
                value={totalAdmins}
                icon="🛡️"
                isLoading={isLoadingInst}
              />
            </StaggerItem>
            <StaggerItem>
              <StatCard
                title="Institutions Created This Month"
                value={institutionsCreatedThisMonth}
                icon="📅"
                isLoading={isLoadingInst}
              />
            </StaggerItem>
          </StaggerList>

          {/* ── Section Header with Search & Filter Tabs ─────────────────── */}
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitleRow}>
              <h2 className={styles.sectionHeading}>College Campuses</h2>
              <span className={styles.countBadge}>
                {filteredInstitutions.length} of {institutions.length} {institutions.length === 1 ? 'Campus' : 'Campuses'}
              </span>
            </div>

            <div className={styles.controlsRow}>
              {/* Status Filter Pills */}
              <div className={styles.filterPills}>
                <button
                  type="button"
                  className={`${styles.filterPill} ${statusFilter === 'ALL' ? styles.filterPillActive : ''}`}
                  onClick={() => setStatusFilter('ALL')}
                >
                  All ({institutions.length})
                </button>
                <button
                  type="button"
                  className={`${styles.filterPill} ${statusFilter === 'ACTIVE' ? styles.filterPillActive : ''}`}
                  onClick={() => setStatusFilter('ACTIVE')}
                >
                  Active ({institutions.filter(i => (i.isActive ?? i.status === 'ACTIVE')).length})
                </button>
                <button
                  type="button"
                  className={`${styles.filterPill} ${statusFilter === 'SUSPENDED' ? styles.filterPillActive : ''}`}
                  onClick={() => setStatusFilter('SUSPENDED')}
                >
                  Suspended ({institutions.filter(i => !(i.isActive ?? i.status === 'ACTIVE')).length})
                </button>
              </div>

              {/* Search Bar */}
              <div className={styles.searchWrap}>
                <Search size={15} className={styles.searchIcon} />
                <input
                  type="text"
                  className={styles.searchInput}
                  placeholder="Search campuses, subdomains, admins…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    type="button"
                    className={styles.clearSearchBtn}
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── Institution Cards Responsive Grid ─────────────────────────── */}
          {isLoadingInst ? (
            <div className={styles.cardsGrid}>
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className={styles.instCard}>
                  <Skeleton height="44px" width="100%" />
                  <Skeleton height="60px" width="100%" />
                  <Skeleton height="36px" width="100%" />
                </div>
              ))}
            </div>
          ) : institutions.length === 0 ? (
            <EmptyState
              icon={<Building2 size={48} />}
              title="No Institutions registered yet"
              description="Deploy your first multi-tenant college or university to generate an isolated, whitelabeled portal."
              actionLabel="Create First Institution"
              onAction={() => setIsCreateModalOpen(true)}
            />
          ) : filteredInstitutions.length === 0 ? (
            <EmptyState
              icon={<Search size={40} />}
              title="No matching institutions"
              description={`No campuses match your filter or query "${searchQuery}".`}
            />
          ) : (
            <div className={styles.cardsGrid}>
              {filteredInstitutions.map((inst) => {
                const isActive = inst.isActive ?? inst.status === 'ACTIVE';
                const effectiveSubdomain = inst.subdomain || inst.slug || '';
                const portalUrl = `/inst/${effectiveSubdomain}/login`;
                const primaryColor = inst.branding?.primaryColor || '#4f46e5';
                const logoUrl = inst.branding?.logoUrl || inst.logoUrl;

                return (
                  <div key={inst._id || effectiveSubdomain} className={styles.instCard}>
                    {/* Top color accent stripe */}
                    <div
                      className={styles.cardAccentStripe}
                      style={{ background: primaryColor }}
                    />

                    {/* Card Header: Identity & Status Toggle */}
                    <div className={styles.cardHeader}>
                      <div className={styles.cardIdentity}>
                        <div
                          className={styles.instAvatar}
                          style={{ backgroundColor: primaryColor }}
                        >
                          {logoUrl ? (
                            <img src={logoUrl} alt={inst.name} className={styles.instLogo} />
                          ) : (
                            <span>{inst.code?.[0] || '🏛️'}</span>
                          )}
                        </div>
                        <div className={styles.cardTitleWrap}>
                          <h3 className={styles.instName}>{inst.name}</h3>
                          {inst.code && <span className={styles.instCodeBadge}>{inst.code}</span>}
                        </div>
                      </div>

                      {/* Active / Inactive Status Toggle */}
                      <div className={styles.toggleWrapper}>
                        <button
                          type="button"
                          className={`${styles.toggleBtn} ${
                            isActive ? styles.toggleActive : styles.toggleInactive
                          }`}
                          onClick={() => handleToggleStatus(inst)}
                          title={`Click to ${isActive ? 'suspend' : 'activate'} this institution`}
                        >
                          <span className={styles.toggleDot} />
                          {isActive ? 'Active' : 'Suspended'}
                        </button>
                      </div>
                    </div>

                    {/* Subdomain Clickable Link */}
                    <div className={styles.subdomainCell}>
                      <Globe size={14} style={{ color: 'var(--color-primary-light)', flexShrink: 0 }} />
                      <a
                        href={portalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.subdomainLink}
                        title={`Open Whitelabel Portal for ${inst.name}`}
                      >
                        <span className={styles.subdomainText}>
                          /inst/{effectiveSubdomain}/login
                        </span>
                        <ArrowUpRight size={13} style={{ flexShrink: 0 }} />
                      </a>
                    </div>

                    {/* Designated Admin */}
                    <div className={styles.adminRow}>
                      <UserCheck size={14} className={styles.adminIcon} />
                      <div className={styles.adminDetails}>
                        <div className={styles.adminName}>
                          {inst.adminUserId?.name || 'Designated Administrator'}
                        </div>
                        <div className={styles.adminEmail}>
                          {inst.adminUserId?.email || 'Admin account pending assignment'}
                        </div>
                      </div>
                    </div>

                    {/* Student / Faculty / Department Count Badges */}
                    <div className={styles.metricsRow}>
                      <div className={styles.metricItem}>
                        <span className={styles.metricValue}>{inst.studentCount ?? 0}</span>
                        <span className={styles.metricLabel}>Students</span>
                      </div>
                      <div className={styles.metricItem}>
                        <span className={styles.metricValue}>{inst.facultyCount ?? 0}</span>
                        <span className={styles.metricLabel}>Faculty</span>
                      </div>
                      <div className={styles.metricItem}>
                        <span className={styles.metricValue}>{inst.departmentCount ?? 0}</span>
                        <span className={styles.metricLabel}>Depts</span>
                      </div>
                    </div>

                    {/* Card Footer Actions */}
                    <div className={styles.cardFooter}>
                      <div className={styles.cardActionBtns}>
                        <button
                          type="button"
                          className={styles.settingsBtn}
                          onClick={() => navigate(`/superadmin/institutions/${inst._id}`)}
                          title="Configure Whitelabel Brand & Theme"
                        >
                          <Settings size={13} />
                          <span>Settings</span>
                        </button>
                        <button
                          type="button"
                          className={styles.settingsBtn}
                          onClick={() => navigate('/superadmin/institutions')}
                          title="Manage Campus Fleet, Departments & Admins"
                        >
                          <Layers size={13} />
                          <span>Manage</span>
                        </button>
                      </div>

                      <a
                        href={portalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.launchBtn}
                        title="Launch Whitelabel Portal"
                      >
                        <span>Portal</span>
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </PageTransition>

      {/* ── Create Institution Modal ──────────────────────────────────────── */}
      <CreateInstitutionModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </DashboardShell>
  );
}
