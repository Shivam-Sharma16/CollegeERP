import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import styles from './Table.module.css';

/**
 * Reusable Table component.
 * @param {Array} columns - Array of { key, label, sortable, render }
 * @param {Array} data - Array of row objects
 * @param {number} page
 * @param {number} totalPages
 * @param {function} onPageChange
 * @param {string} sortColumn
 * @param {string} sortDirection 'asc' | 'desc'
 * @param {function} onSort
 */
export function Table({
  columns = [],
  data = [],
  page = 1,
  totalPages = 1,
  onPageChange,
  sortColumn,
  sortDirection,
  onSort,
}) {
  const isEmpty = data.length === 0;

  const handleSort = (key, isSortable) => {
    if (!isSortable || !onSort) return;
    onSort(key);
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
            {!isEmpty &&
              data.map((row, i) => (
                <tr key={row.id || i}>
                  {columns.map((col) => (
                    <td key={col.key}>
                      {col.render ? col.render(row[col.key], row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {isEmpty && (
        <div className={styles.emptyState}>
          <Inbox size={48} className={styles.emptyIcon} />
          <p>No data available</p>
        </div>
      )}

      {/* Pagination Footer */}
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
