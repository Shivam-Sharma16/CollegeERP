import { useState, useMemo } from 'react';
import { DashboardShell } from '../components/DashboardShell';
import { PageTransition } from '../components/ui/PageTransition';
import { Table } from '../components/ui/Table';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useToast } from '../components/ui/ToastContext';
import {
  useListDepartmentsQuery,
  useDeleteDepartmentMutation,
} from '../api/departmentsApi';
import { CreateDepartmentModal } from '../components/departments/CreateDepartmentModal';
import { EditDepartmentModal } from '../components/departments/EditDepartmentModal';
import { DepartmentDetailModal } from '../components/departments/DepartmentDetailModal';
import {
  Building2,
  Users,
  GraduationCap,
  UserCheck,
  AlertTriangle,
  Plus,
  Search,
  LayoutGrid,
  List as ListIcon,
  Eye,
  Edit2,
  Trash2,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import styles from './AdminDepartments.module.css';

export default function AdminDepartments() {
  const { data: deptsRes, isLoading, refetch } = useListDepartmentsQuery();
  const [deleteDepartment, { isLoading: isDeleting }] = useDeleteDepartmentMutation();
  const { showToast } = useToast();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all | active | inactive
  const [viewMode, setViewMode] = useState('table'); // table | grid

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const [selectedDept, setSelectedDept] = useState(null);
  const [deptToDelete, setDeptToDelete] = useState(null);

  const departments = deptsRes?.data || [];

  // Summary Metrics
  const metrics = useMemo(() => {
    let totalFaculty = 0;
    let totalStudents = 0;
    let unassignedHods = 0;
    let activeDepts = 0;

    departments.forEach((d) => {
      totalFaculty += d.facultyCount || 0;
      totalStudents += d.studentCount || 0;
      if (!d.hod) unassignedHods++;
      if (d.isActive !== false) activeDepts++;
    });

    return {
      total: departments.length,
      activeDepts,
      totalFaculty,
      totalStudents,
      unassignedHods,
    };
  }, [departments]);

  // Filtered & Sorted
  const filteredDepartments = useMemo(() => {
    return departments.filter((d) => {
      const matchSearch =
        !search ||
        d.name?.toLowerCase().includes(search.toLowerCase()) ||
        d.code?.toLowerCase().includes(search.toLowerCase());

      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && d.isActive !== false) ||
        (statusFilter === 'inactive' && d.isActive === false);

      return matchSearch && matchStatus;
    });
  }, [departments, search, statusFilter]);

  // Action Handlers
  const handleViewDetails = (dept) => {
    setSelectedDept(dept);
    setDetailModalOpen(true);
  };

  const handleEdit = (dept) => {
    setSelectedDept(dept);
    setEditModalOpen(true);
  };

  const handleDeleteClick = (dept) => {
    setDeptToDelete(dept);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!deptToDelete) return;
    try {
      await deleteDepartment(deptToDelete._id).unwrap();
      showToast(`Department ${deptToDelete.name} deleted successfully`, 'success');
      setDeleteConfirmOpen(false);
      setDeptToDelete(null);
    } catch (err) {
      const msg = err?.data?.error || err?.data?.message || err?.message || 'Failed to delete department';
      showToast(msg, 'error');
    }
  };

  // Table Columns
  const columns = [
    {
      key: 'name',
      label: 'Department',
      sortable: true,
      render: (_, row) => (
        <div className={styles.deptCell}>
          <div className={styles.deptIconBadge}>
            {row.code?.slice(0, 3) || 'DEP'}
          </div>
          <div className={styles.deptCellText}>
            <span className={styles.deptCellName}>{row.name}</span>
            <span className={styles.deptCellCode}>Code: {row.code}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: false,
      render: (_, row) => (
        <span
          className={`${styles.statusPill} ${
            row.isActive !== false ? styles.statusPillActive : styles.statusPillInactive
          }`}
        >
          {row.isActive !== false ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'hod',
      label: 'Head of Department',
      sortable: false,
      render: (_, row) =>
        row.hod ? (
          <div className={styles.hodCell}>
            <div className={styles.hodSmallAvatar}>
              {row.hod.name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 500 }}>{row.hod.name}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                {row.hod.email}
              </div>
            </div>
          </div>
        ) : (
          <span className={styles.unassignedBadge}>
            <AlertTriangle size={12} />
            Unassigned
          </span>
        ),
    },
    {
      key: 'facultyCount',
      label: 'Faculty',
      sortable: true,
      render: (_, row) => (
        <span style={{ fontWeight: 600 }}>{row.facultyCount || 0}</span>
      ),
    },
    {
      key: 'studentCount',
      label: 'Students',
      sortable: true,
      render: (_, row) => (
        <span style={{ fontWeight: 600 }}>{row.studentCount || 0}</span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (_, row) => (
        <div className={styles.actionButtons}>
          <Button
            variant="ghost"
            onClick={() => handleViewDetails(row)}
            title="View Department Details"
          >
            <Eye size={16} color="var(--color-primary)" />
          </Button>
          <Button
            variant="ghost"
            onClick={() => handleEdit(row)}
            title="Edit Department"
          >
            <Edit2 size={16} color="var(--color-text-muted)" />
          </Button>
          <Button
            variant="ghost"
            onClick={() => handleDeleteClick(row)}
            title="Delete Department"
          >
            <Trash2 size={16} color="var(--color-danger)" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <DashboardShell
      title="Department Management"
      subtitle="Create, configure, and monitor academic departments within your institution"
      icon="Layers"
    >
      <PageTransition>
        <div className={styles.container}>
          {/* Top KPI Metrics Strip */}
          <div className={styles.statsGrid}>
            <div className={styles.kpiCard}>
              <div className={styles.kpiContent}>
                <span className={styles.kpiTitle}>Total Departments</span>
                <span className={styles.kpiValue}>{metrics.total}</span>
              </div>
              <div
                className={styles.kpiIconBox}
                style={{
                  background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
                  color: 'var(--color-primary)',
                }}
              >
                <Building2 size={22} />
              </div>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiContent}>
                <span className={styles.kpiTitle}>Active Departments</span>
                <span className={styles.kpiValue} style={{ color: 'var(--color-success)' }}>
                  {metrics.activeDepts}
                </span>
              </div>
              <div
                className={styles.kpiIconBox}
                style={{
                  background: 'color-mix(in srgb, var(--color-success) 12%, transparent)',
                  color: 'var(--color-success)',
                }}
              >
                <CheckCircle2 size={22} />
              </div>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiContent}>
                <span className={styles.kpiTitle}>Total Faculty Members</span>
                <span className={styles.kpiValue}>{metrics.totalFaculty}</span>
              </div>
              <div
                className={styles.kpiIconBox}
                style={{
                  background: 'color-mix(in srgb, #3b82f6 12%, transparent)',
                  color: '#3b82f6',
                }}
              >
                <Users size={22} />
              </div>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiContent}>
                <span className={styles.kpiTitle}>Enrolled Students</span>
                <span className={styles.kpiValue}>{metrics.totalStudents}</span>
              </div>
              <div
                className={styles.kpiIconBox}
                style={{
                  background: 'color-mix(in srgb, #8b5cf6 12%, transparent)',
                  color: '#8b5cf6',
                }}
              >
                <GraduationCap size={22} />
              </div>
            </div>

            {metrics.unassignedHods > 0 && (
              <div className={styles.kpiCard}>
                <div className={styles.kpiContent}>
                  <span className={styles.kpiTitle}>Unassigned HODs</span>
                  <span className={styles.kpiValue} style={{ color: 'var(--color-warning)' }}>
                    {metrics.unassignedHods}
                  </span>
                </div>
                <div
                  className={styles.kpiIconBox}
                  style={{
                    background: 'color-mix(in srgb, var(--color-warning) 12%, transparent)',
                    color: 'var(--color-warning)',
                  }}
                >
                  <AlertTriangle size={22} />
                </div>
              </div>
            )}
          </div>

          {/* Controls & Toolbar */}
          <div className={styles.toolbar}>
            <div className={styles.filtersGroup}>
              <div className={styles.searchBox}>
                <Search size={16} className={styles.searchIcon} />
                <input
                  type="text"
                  placeholder="Search by name or code..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={styles.searchInput}
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={styles.selectInput}
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>
            </div>

            <div className={styles.actionsGroup}>
              <div className={styles.viewToggle}>
                <button
                  className={`${styles.toggleBtn} ${viewMode === 'table' ? styles.toggleBtnActive : ''}`}
                  onClick={() => setViewMode('table')}
                  title="Table View"
                >
                  <ListIcon size={16} />
                </button>
                <button
                  className={`${styles.toggleBtn} ${viewMode === 'grid' ? styles.toggleBtnActive : ''}`}
                  onClick={() => setViewMode('grid')}
                  title="Card View"
                >
                  <LayoutGrid size={16} />
                </button>
              </div>

              <Button
                variant="primary"
                onClick={() => setCreateModalOpen(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus size={16} />
                Create Department
              </Button>
            </div>
          </div>

          {/* Content Area */}
          {!isLoading && filteredDepartments.length === 0 ? (
            <EmptyState
              title={search || statusFilter !== 'all' ? 'No matching departments' : 'No departments yet'}
              description={
                search || statusFilter !== 'all'
                  ? 'Try adjusting your search criteria or filter options.'
                  : 'Get started by creating the first academic department for your institution.'
              }
              actionLabel="Add Department"
              actionRoute=""
            >
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
                <Button onClick={() => setCreateModalOpen(true)}>Create Department</Button>
              </div>
            </EmptyState>
          ) : viewMode === 'table' ? (
            <Table
              columns={columns}
              data={filteredDepartments}
              isLoading={isLoading}
            />
          ) : (
            /* Card Grid View */
            <div className={styles.cardsGrid}>
              {filteredDepartments.map((dept) => (
                <div key={dept._id} className={styles.deptCard}>
                  <div className={styles.cardTop}>
                    <div className={styles.cardTitleGroup}>
                      <h3 className={styles.cardName}>{dept.name}</h3>
                      <span className={styles.cardCodeBadge}>{dept.code}</span>
                    </div>
                    <span
                      className={`${styles.statusPill} ${
                        dept.isActive !== false
                          ? styles.statusPillActive
                          : styles.statusPillInactive
                      }`}
                    >
                      {dept.isActive !== false ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  {dept.description && (
                    <p className={styles.cardDesc}>{dept.description}</p>
                  )}

                  <div className={styles.cardHodStrip}>
                    {dept.hod ? (
                      <>
                        <div className={styles.cardHodAvatar}>
                          {dept.hod.name?.charAt(0).toUpperCase()}
                        </div>
                        <span className={styles.cardHodText}>
                          HOD: {dept.hod.name}
                        </span>
                      </>
                    ) : (
                      <span
                        style={{
                          color: 'var(--color-warning)',
                          fontSize: '0.75rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <AlertTriangle size={14} />
                        No HOD Assigned
                      </span>
                    )}
                  </div>

                  <div className={styles.cardMetricsRow}>
                    <div className={styles.cardMetric}>
                      <span className={styles.cardMetricVal}>
                        {dept.facultyCount || 0}
                      </span>
                      <span className={styles.cardMetricLabel}>Faculty</span>
                    </div>
                    <div className={styles.cardMetric}>
                      <span className={styles.cardMetricVal}>
                        {dept.studentCount || 0}
                      </span>
                      <span className={styles.cardMetricLabel}>Students</span>
                    </div>
                  </div>

                  <div className={styles.cardFooter}>
                    <Button
                      variant="ghost"
                      onClick={() => handleViewDetails(dept)}
                      title="View Details"
                    >
                      <Eye size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => handleEdit(dept)}
                      title="Edit Department"
                    >
                      <Edit2 size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => handleDeleteClick(dept)}
                      title="Delete Department"
                    >
                      <Trash2 size={16} color="var(--color-danger)" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Modals */}
          <CreateDepartmentModal
            isOpen={createModalOpen}
            onClose={() => setCreateModalOpen(false)}
          />

          <EditDepartmentModal
            isOpen={editModalOpen}
            onClose={() => {
              setEditModalOpen(false);
              setSelectedDept(null);
            }}
            department={selectedDept}
          />

          <DepartmentDetailModal
            isOpen={detailModalOpen}
            onClose={() => {
              setDetailModalOpen(false);
              setSelectedDept(null);
            }}
            departmentId={selectedDept?._id}
            onEdit={(dept) => {
              setSelectedDept(dept);
              setEditModalOpen(true);
            }}
          />

          <ConfirmDialog
            isOpen={deleteConfirmOpen}
            onClose={() => {
              setDeleteConfirmOpen(false);
              setDeptToDelete(null);
            }}
            onConfirm={confirmDelete}
            title="Delete Department"
            warningText={`Are you sure you want to delete ${deptToDelete?.name} (${deptToDelete?.code})? This action cannot be undone if the department has no active records.`}
            confirmLabel="Delete Department"
            isDestructive={true}
            isLoading={isDeleting}
          />
        </div>
      </PageTransition>
    </DashboardShell>
  );
}
