import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Users, TrendingUp, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { DashboardShell } from '../components/DashboardShell';
import { PageTransition } from '../components/ui/PageTransition';
import { Table } from '../components/ui/Table';
import { useListDepartmentStudentsQuery } from '../api/usersApi';
import styles from './HodStudentRoster.module.css';

// ── Demo fallback data (used when API is not yet wired) ─────────────────────
const DEMO_STUDENTS = [
  { _id: 's1',  name: 'Aarav Mehta',     rollNumber: 'CSE2201', email: 'aarav@inst.edu',     year: 1, semester: 2, section: 'A', attendance: 91, marksAvg: 82 },
  { _id: 's2',  name: 'Priya Sharma',    rollNumber: 'CSE2202', email: 'priya@inst.edu',    year: 1, semester: 2, section: 'A', attendance: 68, marksAvg: 55 },
  { _id: 's3',  name: 'Rohan Gupta',     rollNumber: 'CSE2203', email: 'rohan@inst.edu',    year: 1, semester: 2, section: 'B', attendance: 88, marksAvg: 76 },
  { _id: 's4',  name: 'Sneha Patel',     rollNumber: 'CSE2101', email: 'sneha@inst.edu',    year: 1, semester: 1, section: 'A', attendance: 79, marksAvg: 69 },
  { _id: 's5',  name: 'Karan Singh',     rollNumber: 'CSE2102', email: 'karan@inst.edu',    year: 1, semester: 1, section: 'B', attendance: 72, marksAvg: 61 },
  { _id: 's6',  name: 'Ananya Iyer',     rollNumber: 'CSE2301', email: 'ananya@inst.edu',   year: 2, semester: 3, section: 'A', attendance: 95, marksAvg: 91 },
  { _id: 's7',  name: 'Vikram Nair',     rollNumber: 'CSE2302', email: 'vikram@inst.edu',   year: 2, semester: 3, section: 'B', attendance: 62, marksAvg: 48 },
  { _id: 's8',  name: 'Divya Reddy',     rollNumber: 'CSE2303', email: 'divya@inst.edu',    year: 2, semester: 3, section: 'A', attendance: 85, marksAvg: 78 },
  { _id: 's9',  name: 'Arjun Verma',     rollNumber: 'CSE2401', email: 'arjun@inst.edu',    year: 2, semester: 4, section: 'A', attendance: 90, marksAvg: 84 },
  { _id: 's10', name: 'Pooja Das',       rollNumber: 'CSE2402', email: 'pooja@inst.edu',    year: 2, semester: 4, section: 'B', attendance: 74, marksAvg: 66 },
  { _id: 's11', name: 'Ravi Kumar',      rollNumber: 'CSE2501', email: 'ravi@inst.edu',     year: 3, semester: 5, section: 'A', attendance: 88, marksAvg: 79 },
  { _id: 's12', name: 'Meena Joshi',     rollNumber: 'CSE2502', email: 'meena@inst.edu',    year: 3, semester: 5, section: 'B', attendance: 56, marksAvg: 43 },
  { _id: 's13', name: 'Suresh Pillai',   rollNumber: 'CSE2601', email: 'suresh@inst.edu',   year: 3, semester: 6, section: 'A', attendance: 93, marksAvg: 88 },
  { _id: 's14', name: 'Kavitha Raj',     rollNumber: 'CSE2602', email: 'kavitha@inst.edu',  year: 3, semester: 6, section: 'B', attendance: 77, marksAvg: 70 },
  { _id: 's15', name: 'Aditya Bose',     rollNumber: 'CSE2701', email: 'aditya@inst.edu',   year: 4, semester: 7, section: 'A', attendance: 84, marksAvg: 80 },
  { _id: 's16', name: 'Nisha Kapoor',    rollNumber: 'CSE2702', email: 'nisha@inst.edu',    year: 4, semester: 7, section: 'B', attendance: 69, marksAvg: 57 },
  { _id: 's17', name: 'Deepak Bansal',   rollNumber: 'CSE2801', email: 'deepak@inst.edu',   year: 4, semester: 8, section: 'A', attendance: 97, marksAvg: 94 },
  { _id: 's18', name: 'Lakshmi Menon',   rollNumber: 'CSE2802', email: 'lakshmi@inst.edu',  year: 4, semester: 8, section: 'B', attendance: 81, marksAvg: 73 },
];

// ── Filter chip definition helpers ──────────────────────────────────────────
const YEAR_OPTIONS   = [1, 2, 3, 4];
const SEM_OPTIONS    = [1, 2, 3, 4, 5, 6, 7, 8];

// ── Table columns ────────────────────────────────────────────────────────────
const COLUMNS = [
  { key: 'name',       label: 'Student Name', sortable: true },
  { key: 'rollNumber', label: 'Roll No',       sortable: true },
  { key: 'section',    label: 'Section',       sortable: true,
    render: (val, row) => `Y${row.year} · S${row.semester} · ${val}`,
  },
  {
    key: 'attendance',
    label: 'Attendance %',
    sortable: true,
    render: (val) => {
      const pct = val ?? 0;
      const below = pct < 75;
      return (
        <span className={below ? styles.attendanceDanger : styles.attendanceOk}>
          {pct}%
        </span>
      );
    },
  },
  {
    key: 'marksAvg',
    label: 'Marks Summary',
    sortable: true,
    render: (val) => {
      const avg = val ?? 0;
      return <span>Avg: {avg}%</span>;
    },
  },
  {
    key: 'status',
    label: 'Status',
    render: (_, row) => {
      const below = (row.attendance ?? 100) < 75;
      return (
        <span className={below ? styles.statusChipDanger : styles.statusChipOk}>
          {below ? 'Below 75%' : 'Active'}
        </span>
      );
    },
  },
];

const ITEMS_PER_PAGE = 15;

export default function HodStudentRoster() {
  // ── Filters ──────────────────────────────────────────────────────────────
  const [search, setSearch]         = useState('');
  const [yearFilter, setYearFilter] = useState(null);   // number | null
  const [semFilter,  setSemFilter]  = useState(null);   // number | null
  const [secFilter,  setSecFilter]  = useState('');     // string

  // ── Sorting & pagination ─────────────────────────────────────────────────
  const [sortCol, setSortCol] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage]       = useState(1);

  // ── API ── send only truthy filter params ─────────────────────────────────
  const apiParams = useMemo(() => {
    const p = {};
    if (yearFilter) p.year = yearFilter;
    if (semFilter)  p.semester = semFilter;
    if (secFilter)  p.section  = secFilter;
    return p;
  }, [yearFilter, semFilter, secFilter]);

  const { data: apiData, isLoading, isError } = useListDepartmentStudentsQuery(apiParams);

  // Resolve data: prefer API response, fall back to demo
  const rawStudents = useMemo(() => {
    if (Array.isArray(apiData)) return apiData;
    if (Array.isArray(apiData?.data)) return apiData.data;
    // API not yet wired — use filtered demo data so chips work client-side
    let demo = DEMO_STUDENTS;
    if (yearFilter) demo = demo.filter(s => s.year === yearFilter);
    if (semFilter)  demo = demo.filter(s => s.semester === semFilter);
    if (secFilter)  demo = demo.filter(s => s.section.toLowerCase() === secFilter.toLowerCase());
    return demo;
  }, [apiData, yearFilter, semFilter, secFilter]);

  // ── Client-side search ────────────────────────────────────────────────────
  const searched = useMemo(() => {
    if (!search.trim()) return rawStudents;
    const q = search.toLowerCase();
    return rawStudents.filter(s =>
      s.name?.toLowerCase().includes(q) ||
      s.rollNumber?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q)
    );
  }, [rawStudents, search]);

  // ── Sort ──────────────────────────────────────────────────────────────────
  const sorted = useMemo(() => {
    return [...searched].sort((a, b) => {
      let av = a[sortCol] ?? '';
      let bv = b[sortCol] ?? '';
      if (typeof av === 'string') { av = av.toLowerCase(); bv = (bv + '').toLowerCase(); }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ?  1 : -1;
      return 0;
    });
  }, [searched, sortCol, sortDir]);

  // ── KPI derivations ───────────────────────────────────────────────────────
  const totalStudents   = sorted.length;
  const avgAttendance   = totalStudents
    ? Math.round(sorted.reduce((acc, s) => acc + (s.attendance ?? 0), 0) / totalStudents)
    : 0;
  const belowThreshold  = sorted.filter(s => (s.attendance ?? 100) < 75).length;

  // ── Pagination ────────────────────────────────────────────────────────────
  const totalPages  = Math.max(1, Math.ceil(sorted.length / ITEMS_PER_PAGE));
  const safePage    = Math.min(page, totalPages);
  const paginated   = useMemo(() => {
    const start = (safePage - 1) * ITEMS_PER_PAGE;
    return sorted.slice(start, start + ITEMS_PER_PAGE);
  }, [sorted, safePage]);

  const handleSort = useCallback((col) => {
    setSortCol(prev => {
      if (prev === col) { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); return prev; }
      setSortDir('asc');
      return col;
    });
    setPage(1);
  }, []);

  const clearChip = useCallback((type) => {
    if (type === 'year') setYearFilter(null);
    if (type === 'sem')  setSemFilter(null);
    if (type === 'sec')  setSecFilter('');
    setPage(1);
  }, []);

  const toggleYear = (y) => { setYearFilter(prev => prev === y ? null : y); setPage(1); };
  const toggleSem  = (s) => { setSemFilter(prev => prev === s ? null : s); setPage(1); };

  // Derive available sections from current data for quick-select chips
  const availableSections = useMemo(() =>
    [...new Set(rawStudents.map(s => s.section).filter(Boolean))].sort(),
  [rawStudents]);

  return (
    <DashboardShell
      title="Student Roster"
      subtitle="Department-wide student directory with attendance & marks overview"
      icon="📋"
    >
      <PageTransition>
        <div className={styles.container}>

          {/* ── KPI Bar ── */}
          <div className={styles.kpiGrid}>
            <div className={styles.kpiCard} style={{ '--accent': 'var(--color-primary)' }}>
              <div className={styles.kpiIcon}><Users size={22} /></div>
              <div className={styles.kpiBody}>
                <span className={styles.kpiValue}>{totalStudents}</span>
                <span className={styles.kpiLabel}>Total Students</span>
              </div>
            </div>

            <div className={styles.kpiCard} style={{ '--accent': 'var(--color-secondary)' }}>
              <div className={styles.kpiIcon}><TrendingUp size={22} /></div>
              <div className={styles.kpiBody}>
                <span className={styles.kpiValue}>{avgAttendance}%</span>
                <span className={styles.kpiLabel}>Avg Attendance</span>
              </div>
            </div>

            <div
              className={styles.kpiCard}
              style={{ '--accent': belowThreshold > 0 ? 'var(--color-danger)' : 'var(--color-text-muted)' }}
            >
              <div className={styles.kpiIcon}><AlertTriangle size={22} /></div>
              <div className={styles.kpiBody}>
                <span className={styles.kpiValue} style={{ color: belowThreshold > 0 ? 'var(--color-danger)' : undefined }}>
                  {belowThreshold}
                </span>
                <span className={styles.kpiLabel}>Below 75%</span>
              </div>
            </div>
          </div>

          {/* ── Search + Filters ── */}
          <div className={styles.filterArea}>
            {/* Search bar */}
            <div className={styles.searchWrap}>
              <Search size={16} className={styles.searchIcon} />
              <input
                id="hod-roster-search"
                type="text"
                placeholder="Search by name, roll no, or email…"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className={styles.searchInput}
              />
              {search && (
                <button className={styles.clearBtn} onClick={() => { setSearch(''); setPage(1); }}>
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Year chips */}
            <div className={styles.chipGroup}>
              <span className={styles.chipGroupLabel}>Year</span>
              {YEAR_OPTIONS.map(y => (
                <motion.button
                  key={y}
                  id={`chip-year-${y}`}
                  className={`${styles.chip} ${yearFilter === y ? styles.chipActive : ''}`}
                  onClick={() => toggleYear(y)}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {yearFilter === y && <X size={11} style={{ marginRight: 3 }} />}
                  Y{y}
                </motion.button>
              ))}
            </div>

            {/* Semester chips */}
            <div className={styles.chipGroup}>
              <span className={styles.chipGroupLabel}>Sem</span>
              {SEM_OPTIONS.map(s => (
                <motion.button
                  key={s}
                  id={`chip-sem-${s}`}
                  className={`${styles.chip} ${semFilter === s ? styles.chipActive : ''}`}
                  onClick={() => toggleSem(s)}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {semFilter === s && <X size={11} style={{ marginRight: 3 }} />}
                  S{s}
                </motion.button>
              ))}
            </div>

            {/* Section chips (dynamic from data) */}
            {availableSections.length > 0 && (
              <div className={styles.chipGroup}>
                <span className={styles.chipGroupLabel}>Section</span>
                {availableSections.map(sec => (
                  <motion.button
                    key={sec}
                    id={`chip-sec-${sec}`}
                    className={`${styles.chip} ${secFilter === sec ? styles.chipActive : ''}`}
                    onClick={() => { setSecFilter(prev => prev === sec ? '' : sec); setPage(1); }}
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {secFilter === sec && <X size={11} style={{ marginRight: 3 }} />}
                    {sec}
                  </motion.button>
                ))}
              </div>
            )}

            {/* Active filter summary */}
            <AnimatePresence>
              {(yearFilter || semFilter || secFilter) && (
                <motion.button
                  className={styles.clearAllBtn}
                  onClick={() => { setYearFilter(null); setSemFilter(null); setSecFilter(''); setPage(1); }}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                >
                  <X size={13} /> Clear all filters
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          {/* ── Table ── */}
          <div className={styles.tableCard}>
            <div className={styles.tableHeader}>
              <div>
                <h3 className={styles.tableTitle}>Department Students</h3>
                <p className={styles.tableSub}>
                  {isLoading ? 'Loading…' : `${totalStudents} student${totalStudents !== 1 ? 's' : ''}${search ? ' matched' : ''}`}
                </p>
              </div>
            </div>

            <Table
              columns={COLUMNS}
              data={paginated}
              isLoading={isLoading}
              skeletonRows={8}
              sortColumn={sortCol}
              sortDirection={sortDir}
              onSort={handleSort}
              emptyIcon="users"
            />

            {/* Pagination footer */}
            {!isLoading && totalPages > 1 && (
              <div className={styles.pagination}>
                <button
                  className={styles.pageBtn}
                  disabled={safePage <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  <ChevronLeft size={16} />
                </button>
                <span className={styles.pageInfo}>
                  Page {safePage} of {totalPages}
                  <span className={styles.pageMeta}> · {sorted.length} students</span>
                </span>
                <button
                  className={styles.pageBtn}
                  disabled={safePage >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}

            {isError && (
              <p className={styles.errorMsg}>Failed to load students. Showing demo data.</p>
            )}
          </div>

        </div>
      </PageTransition>
    </DashboardShell>
  );
}
