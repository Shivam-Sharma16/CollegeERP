import React from 'react';
import styles from './ChartCard.module.css';
import { AlertCircle } from 'lucide-react';

export function ChartCard({ 
  title, 
  isLoading = false, 
  isError = false, 
  isEmpty = false, 
  children 
}) {
  return (
    <div className={styles.card}>
      <h3 className={styles.title}>{title}</h3>
      
      <div className={styles.content}>
        {isLoading ? (
          <div className={styles.skeletonContainer}>
            <div className={styles.skeletonChart} />
            <div className={styles.skeletonAxisX} />
            <div className={styles.skeletonAxisY} />
          </div>
        ) : isError ? (
          <div className={styles.errorState}>
            <AlertCircle size={24} color="var(--color-danger)" />
            <p>Failed to load data.</p>
          </div>
        ) : isEmpty ? (
          <div className={styles.emptyState}>
            No data for this filter combination
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
