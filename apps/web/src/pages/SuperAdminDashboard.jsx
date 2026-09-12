import { useNavigate } from 'react-router-dom';
import { DashboardShell } from '../components/DashboardShell';
import { StatCard } from '../components/ui/StatCard';
import { StaggerList, StaggerItem } from '../components/ui/StaggerList';
import { PageTransition } from '../components/ui/PageTransition';
import { Timeline } from '../components/ui/Timeline';
import { Button } from '../components/ui/Button';
import { useListInstitutionsQuery } from '../api/institutionsApi';
import { useGetDashboardStatsQuery } from '../api/reportsApi';
import { useGetRecentActivityQuery } from '../api/auditApi';
import { Building2, Users, Layers, ShieldCheck, Plus, ArrowRight } from 'lucide-react';
import styles from './SuperAdminManagement.module.css';

export default function SuperAdminDashboard() {
  const navigate = useNavigate();

  const { data: rawInstitutions, isLoading: isLoadingInst } = useListInstitutionsQuery();
  const { data: statsData, isLoading: isLoadingStats } = useGetDashboardStatsQuery();
  const { data: auditData, isLoading: isLoadingAudit } = useGetRecentActivityQuery();

  const institutions = Array.isArray(rawInstitutions?.data)
    ? rawInstitutions.data
    : Array.isArray(rawInstitutions)
    ? rawInstitutions
    : [];

  const stats = statsData?.data || {};
  const auditLogs = auditData?.data || [];

  return (
    <DashboardShell
      title="Platform Overview"
      subtitle="Central Multi-Tenant Infrastructure Console"
      icon="🛡️"
    >
      <PageTransition>
        <div className={styles.container}>
          {/* Top Platform Metrics */}
          <StaggerList style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--spacing-4)' }}>
            <StaggerItem>
              <StatCard
                title="Active Institutions"
                value={institutions.length}
                icon="Building"
                isLoading={isLoadingInst}
              />
            </StaggerItem>
            <StaggerItem>
              <StatCard
                title="Total Departments"
                value={stats.totalDepartments ?? 0}
                icon="Layers"
                isLoading={isLoadingStats}
              />
            </StaggerItem>
            <StaggerItem>
              <StatCard
                title="Total Students"
                value={stats.totalStudents ?? 0}
                icon="Users"
                isLoading={isLoadingStats}
              />
            </StaggerItem>
            <StaggerItem>
              <StatCard
                title="Total Faculty"
                value={stats.totalFaculty ?? 0}
                icon="UserCheck"
                isLoading={isLoadingStats}
              />
            </StaggerItem>
          </StaggerList>

          {/* Quick Actions & Recent Institutions */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--spacing-6)' }}>
            <div className={styles.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-4)' }}>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text)' }}>
                  Tenant Institutions
                </h2>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => navigate('/superadmin/institutions')}
                >
                  <Plus size={14} style={{ marginRight: '4px' }} /> Manage All
                </Button>
              </div>

              {institutions.length === 0 ? (
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>No institutions registered yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)' }}>
                  {institutions.slice(0, 4).map((inst) => (
                    <div
                      key={inst._id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.75rem',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--color-surface-elevated)',
                        border: '1px solid var(--color-border)',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>{inst.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          subdomain: <code>{inst.subdomain || inst.slug}</code>
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: '12px',
                          background: inst.status === 'ACTIVE' || inst.isActive ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                          color: inst.status === 'ACTIVE' || inst.isActive ? '#10b981' : '#ef4444',
                        }}
                      >
                        {inst.status || (inst.isActive ? 'ACTIVE' : 'SUSPENDED')}
                      </span>
                    </div>
                  ))}
                  <div style={{ textAlign: 'right', marginTop: 'var(--spacing-2)' }}>
                    <button
                      onClick={() => navigate('/superadmin/institutions')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-primary)',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      View all {institutions.length} institutions <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Platform Audit Logs */}
            <div className={styles.card}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: 'var(--spacing-4)' }}>
                System Activity
              </h2>
              <Timeline items={auditLogs} isLoading={isLoadingAudit} />
            </div>
          </div>
        </div>
      </PageTransition>
    </DashboardShell>
  );
}
