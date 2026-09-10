import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import { Skeleton } from './Skeleton';
import { EmptyState } from './EmptyState';
import styles from './Table.module.css';

/**
 * Reusable Table component — with staggered row entrance animations
 * and skeleton-row loading state.
 *
 * @param {Array}    columns      - Array of { key, label, sortable, render }
 * @param {Array}    data         - Array of row objects
 * @param {boolean}  isLoading    - Show skeleton rows while true
 * @param {number}   skeletonRows - Number of skeleton rows to show (default 5)
 * @param {number}   page
 * @param {number}   totalPages
 * @param {function} onPageChange
 * @param {string}   sortColumn
 * @param {string}   sortDirection 'asc' | 'desc'
 * @param {function} onSort
 * @param {string}   emptyIcon    - EmptyState illustration key
 */
export function Table({
  columns = [],
  data = [],
  isLoading = false,
  skeletonRows = 5,
  page = 1,
  totalPages = 1,
  onPageChange,
  sortColumn,
  sortDirection,
  onSort,
  emptyIcon = 'inbox',
}) {
  const isEmpty = !isLoading && data.length === 0;

  const handleSort = (key, isSortable) => {
    if (!isSortable || !onSort) return;
    onSort(key);
  };

  const rowVariants = {
    hidden: { opacity: 0, y: 6 },
    visible: (i) => ({
      opacity: 1,
      y: 0,
      transition: { duration: 0.18, delay: i * 0.04, ease: 'easeOut' },
    }),
  };

  return (
    <div className={styles.container}>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              {columns.map((col) => {
                const isActive = sortColumn === col.key;
                const isAsc = sortDirection === 'asc';

                return (
                  <th
                    key={col.key}
                    className={`${col.sortable ? styles.sortable : ''} ${isActive ? styles.activeSort : ''}`}
                    onClick={() => handleSort(col.key, col.sortable)}
                  >
                    <div className={styles.headerContent}>
                      {col.label}
                      {col.sortable && (
                        <span className={styles.sortIcon}>
                          <AnimatePresence mode="wait">
                            {isActive ? (
                              <motion.div
                                key={isAsc ? 'asc' : 'desc'}
                                initial={{ rotate: isAsc ? -180 : 180, opacity: 0 }}
                                animate={{ rotate: 0, opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                              >
                                {isAsc ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </motion.div>
                            ) : (
                              <ChevronDown size={16} className={styles.inactiveIcon} />
                            )}
                          </AnimatePresence>
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {/* ── Skeleton rows while loading ─────────────────────────── */}
            {isLoading &&
              Array.from({ length: skeletonRows }).map((_, i) => (
                <tr key={`skel-${i}`} className={styles.skeletonRow}>
                  {columns.map((col) => (
                    <td key={col.key}>
                      <Skeleton height="16px" width={i % 2 === 0 ? '80%' : '60%'} />
                    </td>
                  ))}
                </tr>
              ))}

            {/* ── Real data rows with stagger ─────────────────────────── */}
            {!isLoading &&
              data.map((row, i) => (
                <motion.tr
                  key={row.id || row._id || i}
                  custom={i}
                  variants={rowVariants}
                  initial="hidden"
                  animate="visible"
                >
                  {columns.map((col) => (
                    <td key={col.key}>
                      {col.render ? col.render(row[col.key], row) : row[col.key]}
                    </td>
                  ))}
                </motion.tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* ── Empty state ─────────────────────────────────────────────────── */}
      {isEmpty && (
        <EmptyState
          icon={emptyIcon}
          title="Nothing here yet"
          description="No data available to display."
        />
      )}

      {/* ── Pagination Footer ────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            className={styles.pageBtn}
            disabled={page <= 1}
            onClick={() => onPageChange && onPageChange(page - 1)}
          >
            <ChevronLeft size={16} />
          </button>
          <span className={styles.pageInfo}>
            Page {page} of {totalPages}
          </span>
          <button
            className={styles.pageBtn}
            disabled={page >= totalPages}
            onClick={() => onPageChange && onPageChange(page + 1)}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
