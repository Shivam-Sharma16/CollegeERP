import { useState, useMemo } from 'react';
import { DashboardShell } from '../components/DashboardShell';
import { Table } from '../components/ui/Table';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { PageTransition } from '../components/ui/PageTransition';
import { useToast } from '../components/ui/ToastContext';
import {
  useListFeeStructuresQuery,
  useCreateFeeStructureMutation,
  useGetDefaultersQuery,
} from '../api/feesApi';
import { useListDepartmentsQuery } from '../api/departmentsApi';
import {
  Plus,
  Trash2,
  Wallet,
  Users,
  AlertTriangle,
  Layers,
  Search,
  CheckCircle2,
} from 'lucide-react';
import styles from './AdminFeePolicy.module.css';

// Supported student fee groups in the system
export const FEE_GROUPS = [
  { id: 'general', label: 'General', badgeClass: styles.badgeGeneral },
  { id: 'tfws', label: 'TFWS', badgeClass: styles.badgeTfws },
  { id: 'management', label: 'Management', badgeClass: styles.badgeManagement },
  { id: 'sc_st', label: 'SC/ST', badgeClass: styles.badgeScst },
  { id: 'obc', label: 'OBC', badgeClass: styles.badgeObc },
];

export default function AdminFeePolicy() {
  const { showToast } = useToast();

  // Active view tab: 'structures' | 'defaulters'
  const [activeTab, setActiveTab] = useState('structures');

  // Defaulters group filter toggle: 'all' | 'general' | 'tfws' | ...
  const [activeFeeGroup, setActiveFeeGroup] = useState('all');

  // FeeStructures search & filter
  const [structureSearch, setStructureSearch] = useState('');

  // Add Fee Structure Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalDeptId, setModalDeptId] = useState('');
  const [modalYear, setModalYear] = useState('1');
  const [modalSemester, setModalSemester] = useState('1');
  const [modalGroup, setModalGroup] = useState('general');
  const [modalTotalAmount, setModalTotalAmount] = useState('');
  const [modalInstallments, setModalInstallments] = useState([
    { label: 'Installment 1', amount: '', dueDate: '', isLateFeeApplicable: false },
  ]);

  // Queries & Mutations
  const { data: deptData, isLoading: isLoadingDepts } = useListDepartmentsQuery();
  const departments = deptData?.data || [];

  const {
    data: feeStructuresData,
    isLoading: isLoadingStructures,
    refetch: refetchStructures,
  } = useListFeeStructuresQuery();

  // Defaulters query: parameterized by activeFeeGroup
  const {
    data: defaultersData,
    isLoading: isLoadingDefaulters,
    isFetching: isFetchingDefaulters,
  } = useGetDefaultersQuery(
    activeFeeGroup !== 'all' ? { feeGroup: activeFeeGroup } : {}
  );

  // Query for all defaulters to compute side-by-side comparison counts
  const { data: allDefaultersData } = useGetDefaultersQuery({});

  const [createFeeStructure, { isLoading: isSubmitting }] = useCreateFeeStructureMutation();

  // Raw FeeStructures list
  const feeStructures = useMemo(() => {
    const raw = Array.isArray(feeStructuresData?.data)
      ? feeStructuresData.data
      : Array.isArray(feeStructuresData)
      ? feeStructuresData
      : [];
    return raw;
  }, [feeStructuresData]);

  // Department map for quick lookup
  const deptMap = useMemo(() => {
    const map = new Map();
    departments.forEach((d) => map.set(d._id, d.name || d.code));
    return map;
  }, [departments]);

  // Filtered FeeStructures list
  const filteredStructures = useMemo(() => {
    let list = [...feeStructures];
    if (structureSearch.trim()) {
      const q = structureSearch.toLowerCase().trim();
      list = list.filter((fs) => {
        const deptName = (deptMap.get(fs.departmentId) || '').toLowerCase();
        const grp = (fs.studentGroup || fs.feeGroup || '').toLowerCase();
        return (
          deptName.includes(q) ||
          grp.includes(q) ||
          String(fs.year).includes(q) ||
          String(fs.semester || '').includes(q)
        );
      });
    }
    return list;
  }, [feeStructures, structureSearch, deptMap]);

  // Raw Defaulters list for the active filter
  const defaulters = useMemo(() => {
    const raw = Array.isArray(defaultersData?.data)
      ? defaultersData.data
      : Array.isArray(defaultersData)
      ? defaultersData
      : [];
    return raw;
  }, [defaultersData]);

  // Side-by-side comparison counters per fee group
  const groupCounts = useMemo(() => {
    const all = Array.isArray(allDefaultersData?.data)
      ? allDefaultersData.data
      : Array.isArray(allDefaultersData)
      ? allDefaultersData
      : [];

    const counts = { all: all.length };
    FEE_GROUPS.forEach((g) => {
      counts[g.id] = all.filter((d) => (d.feeGroup || 'general').toLowerCase() === g.id).length;
    });
    return counts;
  }, [allDefaultersData]);

  // Installment calculations inside Add modal
  const parsedTotal = parseFloat(modalTotalAmount) || 0;
  const runningInstallmentTotal = useMemo(() => {
    return modalInstallments.reduce((sum, inst) => sum + (parseFloat(inst.amount) || 0), 0);
  }, [modalInstallments]);

  const isMismatch = parsedTotal > 0 && Math.abs(runningInstallmentTotal - parsedTotal) > 0.01;
  const remainingAmount = Math.max(0, parsedTotal - runningInstallmentTotal);

  const handleAddInstallment = () => {
    const count = modalInstallments.length + 1;
    setModalInstallments([
      ...modalInstallments,
      {
        label: `Installment ${count}`,
        amount: remainingAmount > 0 ? String(remainingAmount) : '',
        dueDate: '',
        isLateFeeApplicable: false,
      },
    ]);
  };

  const handleRemoveInstallment = (idx) => {
    if (modalInstallments.length === 1) return;
    setModalInstallments(modalInstallments.filter((_, i) => i !== idx));
  };

  const handleInstallmentChange = (idx, field, val) => {
    const updated = [...modalInstallments];
    updated[idx][field] = val;
    setModalInstallments(updated);
  };

  const handleCreateStructureSubmit = async (e) => {
    e.preventDefault();
    if (!modalDeptId) {
      showToast('Please select a department', 'error');
      return;
    }
    if (parsedTotal <= 0) {
      showToast('Please enter a valid total fee amount', 'error');
      return;
    }
    if (isMismatch) {
      showToast('Installment amounts must equal total fee amount', 'error');
      return;
    }

    try {
      await createFeeStructure({
        departmentId: modalDeptId,
        year: parseInt(modalYear, 10),
        semester: modalSemester ? parseInt(modalSemester, 10) : null,
        studentGroup: modalGroup,
        feeGroup: modalGroup,
        totalAmount: parsedTotal,
        installments: modalInstallments.map((inst, i) => ({
          label: inst.label || `Installment ${i + 1}`,
          amount: parseFloat(inst.amount),
          dueDate: inst.dueDate,
          isLateFeeApplicable: Boolean(inst.isLateFeeApplicable),
        })),
      }).unwrap();

      showToast('Fee structure created successfully', 'success');
      setIsModalOpen(false);
      // Reset form
      setModalDeptId('');
      setModalTotalAmount('');
      setModalInstallments([{ label: 'Installment 1', amount: '', dueDate: '', isLateFeeApplicable: false }]);
      refetchStructures();
    } catch (err) {
      showToast(err?.data?.message || err?.message || 'Failed to create fee structure', 'error');
    }
  };

  // ── Table Columns: FeeStructures (with Year × Semester × Group visible) ──
  const structureColumns = [
    {
      key: 'year',
      label: 'Year',
      sortable: true,
      render: (val) => <span style={{ fontWeight: 600 }}>Year {val}</span>,
    },
    {
      key: 'semester',
      label: 'Semester',
      sortable: true,
      render: (val, row) => (
        <span>
          {val ? `Sem ${val}` : row.year ? `Sem ${(row.year * 2) - 1} & ${row.year * 2}` : 'All Semesters'}
        </span>
      ),
    },
    {
      key: 'studentGroup',
      label: 'Group',
      sortable: true,
      render: (val) => {
        const grpKey = (val || 'general').toLowerCase();
        const info = FEE_GROUPS.find((g) => g.id === grpKey) || { label: val || 'General', badgeClass: styles.badgeGeneral };
        return <span className={`${styles.groupBadge} ${info.badgeClass}`}>{info.label}</span>;
      },
    },
    {
      key: 'departmentId',
      label: 'Department',
      sortable: true,
      render: (val) => deptMap.get(val) || 'General Academic',
    },
    {
      key: 'totalAmount',
      label: 'Total Amount',
      sortable: true,
      render: (val) => (
        <span style={{ fontWeight: 700, color: 'var(--color-primary-light)' }}>
          ₹{Number(val).toLocaleString('en-IN')}
        </span>
      ),
    },
    {
      key: 'installments',
      label: 'Installments',
      sortable: false,
      render: (val) => {
        const count = Array.isArray(val) ? val.length : 0;
        return (
          <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
            {count} {count === 1 ? 'installment' : 'installments'}
          </span>
        );
      },
    },
    {
      key: 'createdAt',
      label: 'Created Date',
      sortable: true,
      render: (val) => (val ? new Date(val).toLocaleDateString() : 'N/A'),
    },
  ];

  // ── Table Columns: Defaulters View ──
  const defaulterColumns = [
    {
      key: 'name',
      label: 'Student Name',
      sortable: true,
      render: (val, row) => (
        <div>
          <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{val || 'Student'}</span>
          {row.email && (
            <div style={{ fontSize: '0.775rem', color: 'var(--color-text-muted)' }}>
              {row.email}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'feeGroup',
      label: 'Fee Group',
      sortable: true,
      render: (val) => {
        const grpKey = (val || 'general').toLowerCase();
        const info = FEE_GROUPS.find((g) => g.id === grpKey) || { label: val || 'General', badgeClass: styles.badgeGeneral };
        return <span className={`${styles.groupBadge} ${info.badgeClass}`}>{info.label}</span>;
      },
    },
    {
      key: 'yearNumber',
      label: 'Year',
      sortable: true,
      render: (val) => `Year ${val || 1}`,
    },
    {
      key: 'overdueCount',
      label: 'Overdue Installments',
      sortable: false,
      render: (_, row) => {
        const list = row.overdueInstallments || [];
        return (
          <span style={{ color: 'var(--color-danger)', fontWeight: 600 }}>
            {list.length} {list.length === 1 ? 'installment' : 'installments'} overdue
          </span>
        );
      },
    },
    {
      key: 'overdueAmount',
      label: 'Overdue Amount',
      sortable: false,
      render: (_, row) => {
        const list = row.overdueInstallments || [];
        const total = list.reduce((sum, inst) => sum + (Number(inst.amount) || 0), 0);
        return (
          <span style={{ fontWeight: 700, color: 'var(--color-danger)' }}>
            ₹{total.toLocaleString('en-IN')}
          </span>
        );
      },
    },
  ];

  return (
    <DashboardShell
      title="Fee Management"
      subtitle="Configure fee structures, student fee groups, and inspect defaulters."
      icon="Wallet"
    >
      <PageTransition>
        <div className={styles.container}>
          {/* ── View Mode Switcher ────────────────────────────────────── */}
          <div className={styles.tabNav}>
            <button
              className={`${styles.tabBtn} ${activeTab === 'structures' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('structures')}
            >
              <Layers size={16} />
              Fee Structures ({feeStructures.length})
            </button>

            <button
              className={`${styles.tabBtn} ${activeTab === 'defaulters' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('defaulters')}
            >
              <AlertTriangle size={16} />
              Defaulters & Group Comparison ({groupCounts.all})
            </button>
          </div>

          {/* ── TAB 1: Fee Structures Table (Year × Semester × Group visible) ── */}
          {activeTab === 'structures' && (
            <div className={styles.card}>
              <div className={styles.toolbar}>
                <div className={styles.searchBox}>
                  <Search size={16} color="var(--color-text-muted)" />
                  <input
                    type="text"
                    placeholder="Search by department, year, or group..."
                    value={structureSearch}
                    onChange={(e) => setStructureSearch(e.target.value)}
                    className={styles.input}
                  />
                </div>
                <Button onClick={() => setIsModalOpen(true)} size="sm">
                  <Plus size={16} style={{ marginRight: 6 }} />
                  Add Fee Structure
                </Button>
              </div>

              {isLoadingStructures ? (
                <Skeleton height="260px" />
              ) : filteredStructures.length === 0 ? (
                <EmptyState
                  title="No Fee Structures Found"
                  description="Define institutional fee schedules categorized by Year, Semester, and Student Fee Group."
                  actionLabel="Create Fee Structure"
                  onAction={() => setIsModalOpen(true)}
                />
              ) : (
                <Table
                  columns={structureColumns}
                  data={filteredStructures}
                />
              )}
            </div>
          )}

          {/* ── TAB 2: Defaulters View (Side-by-side comparison & Group toggle) ── */}
          {activeTab === 'defaulters' && (
            <div className={styles.card}>
              {/* Side-by-side group comparison summary strip */}
              <div className={styles.comparisonStrip}>
                <div
                  className={styles.comparisonCard}
                  style={{
                    borderColor: activeFeeGroup === 'all' ? 'var(--color-primary)' : undefined,
                    cursor: 'pointer',
                  }}
                  onClick={() => setActiveFeeGroup('all')}
                >
                  <span className={styles.comparisonCount}>{groupCounts.all}</span>
                  <span className={styles.comparisonLabel}>Total Defaulters</span>
                </div>

                {FEE_GROUPS.map((grp) => {
                  const isSelected = activeFeeGroup === grp.id;
                  const count = groupCounts[grp.id] || 0;
                  return (
                    <div
                      key={grp.id}
                      className={styles.comparisonCard}
                      style={{
                        borderColor: isSelected ? 'var(--color-primary)' : undefined,
                        cursor: 'pointer',
                      }}
                      onClick={() => setActiveFeeGroup(grp.id)}
                    >
                      <span className={styles.comparisonCount}>{count}</span>
                      <span className={styles.comparisonLabel}>
                        {grp.label}: {count} defaulter{count === 1 ? '' : 's'}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Group-filter toggle pills */}
              <div className={styles.groupToggleBar}>
                <span className={styles.toggleLabel}>Filter by Group:</span>
                <button
                  className={`${styles.togglePill} ${activeFeeGroup === 'all' ? styles.togglePillActive : ''}`}
                  onClick={() => setActiveFeeGroup('all')}
                >
                  All ({groupCounts.all})
                </button>
                {FEE_GROUPS.map((grp) => (
                  <button
                    key={grp.id}
                    className={`${styles.togglePill} ${activeFeeGroup === grp.id ? styles.togglePillActive : ''}`}
                    onClick={() => setActiveFeeGroup(grp.id)}
                  >
                    {grp.label} ({groupCounts[grp.id] || 0})
                  </button>
                ))}
              </div>

              {/* Defaulters Table */}
              {isLoadingDefaulters || isFetchingDefaulters ? (
                <Skeleton height="260px" />
              ) : defaulters.length === 0 ? (
                <EmptyState
                  title="No Defaulters in this Group"
                  description={
                    activeFeeGroup !== 'all'
                      ? `Zero overdue fees recorded for the ${activeFeeGroup.toUpperCase()} student group.`
                      : 'Great news! There are currently no students with overdue fee installments.'
                  }
                />
              ) : (
                <Table
                  columns={defaulterColumns}
                  data={defaulters}
                />
              )}
            </div>
          )}

          {/* ── Modal: Add Fee Structure (including group selector) ───── */}
          {isModalOpen && (
            <Modal
              isOpen={isModalOpen}
              onClose={() => setIsModalOpen(false)}
              title="Add Fee Structure"
            >
              <form onSubmit={handleCreateStructureSubmit} className={styles.modalForm}>
                <div className={styles.grid2}>
                  <div className={styles.field}>
                    <label htmlFor="modalDepartment" className={styles.label}>Department *</label>
                    <select
                      id="modalDepartment"
                      className={styles.input}
                      value={modalDeptId}
                      onChange={(e) => setModalDeptId(e.target.value)}
                      required
                    >
                      <option value="">-- Choose Department --</option>
                      {departments.map((d) => (
                        <option key={d._id} value={d._id}>
                          {d.name} ({d.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.field}>
                    <label htmlFor="modalFeeGroup" className={styles.label}>Fee Group *</label>
                    <select
                      id="modalFeeGroup"
                      className={styles.input}
                      value={modalGroup}
                      onChange={(e) => setModalGroup(e.target.value)}
                      required
                    >
                      {FEE_GROUPS.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.label} Group
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className={styles.grid3}>
                  <div className={styles.field}>
                    <label htmlFor="modalYear" className={styles.label}>Academic Year *</label>
                    <select
                      id="modalYear"
                      className={styles.input}
                      value={modalYear}
                      onChange={(e) => setModalYear(e.target.value)}
                      required
                    >
                      <option value="1">Year 1</option>
                      <option value="2">Year 2</option>
                      <option value="3">Year 3</option>
                      <option value="4">Year 4</option>
                    </select>
                  </div>

                  <div className={styles.field}>
                    <label htmlFor="modalSemester" className={styles.label}>Semester</label>
                    <select
                      id="modalSemester"
                      className={styles.input}
                      value={modalSemester}
                      onChange={(e) => setModalSemester(e.target.value)}
                    >
                      <option value="">Annual (All Semesters)</option>
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                        <option key={s} value={s}>
                          Semester {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.field}>
                    <label htmlFor="modalTotalAmount" className={styles.label}>Total Amount (₹) *</label>
                    <input
                      id="modalTotalAmount"
                      type="number"
                      placeholder="e.g. 60000"
                      className={styles.input}
                      value={modalTotalAmount}
                      onChange={(e) => setModalTotalAmount(e.target.value)}
                      required
                      min="1"
                    />
                  </div>
                </div>

                {/* Installments Breakdown */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                  <label className={styles.label}>Installment Schedule</label>
                  <Button type="button" variant="outline" size="sm" onClick={handleAddInstallment}>
                    <Plus size={14} style={{ marginRight: 4 }} />
                    Add Installment
                  </Button>
                </div>

                <div className={styles.installmentList}>
                  {modalInstallments.map((inst, idx) => (
                    <div key={idx} className={styles.installmentRow}>
                      <input
                        type="text"
                        placeholder="Label"
                        value={inst.label}
                        onChange={(e) => handleInstallmentChange(idx, 'label', e.target.value)}
                        className={styles.input}
                        style={{ width: '130px' }}
                      />
                      <input
                        type="number"
                        placeholder="Amount (₹)"
                        value={inst.amount}
                        onChange={(e) => handleInstallmentChange(idx, 'amount', e.target.value)}
                        className={styles.input}
                        style={{ width: '140px' }}
                        required
                        min="1"
                      />
                      <input
                        type="date"
                        value={inst.dueDate}
                        onChange={(e) => handleInstallmentChange(idx, 'dueDate', e.target.value)}
                        className={styles.input}
                        style={{ flex: 1 }}
                        required
                      />
                      {modalInstallments.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveInstallment(idx)}
                          title="Remove installment"
                        >
                          <Trash2 size={16} color="var(--color-danger)" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Installment sum validation feedback */}
                {parsedTotal > 0 && (
                  <div
                    className={`${styles.statusBanner} ${
                      isMismatch ? styles.statusMismatch : styles.statusBalanced
                    }`}
                  >
                    <span>
                      Scheduled: ₹{runningInstallmentTotal.toLocaleString('en-IN')} / ₹
                      {parsedTotal.toLocaleString('en-IN')}
                    </span>
                    <span>
                      {isMismatch
                        ? `Mismatch: ₹${Math.abs(parsedTotal - runningInstallmentTotal).toLocaleString('en-IN')} remaining`
                        : 'Balanced ✓'}
                    </span>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                  <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting || !modalDeptId || parsedTotal <= 0 || isMismatch}
                  >
                    {isSubmitting ? 'Saving...' : 'Save Fee Structure'}
                  </Button>
                </div>
              </form>
            </Modal>
          )}
        </div>
      </PageTransition>
    </DashboardShell>
  );
}
