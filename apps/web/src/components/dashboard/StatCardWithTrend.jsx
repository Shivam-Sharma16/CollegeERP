import React from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import styles from './StatCardWithTrend.module.css';
import { AlertCircle } from 'lucide-react';

export function StatCardWithTrend({ 
  title, 
  value, 
  trendData = [], 
  trendColor = "var(--color-primary)",
  isLoading = false,
  isError = false,
  onRetry = null,
  icon: Icon
}) {
  if (isError) {
    return (
      <div className={`${styles.card} ${styles.errorCard}`}>
        <AlertCircle size={20} color="var(--color-danger)" />
        <div className={styles.errorContent}>
          <span className={styles.errorTitle}>Failed to load</span>
          {onRetry && (
            <button className={styles.retryBtn} onClick={onRetry}>
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={styles.card}>
        <div className={styles.skeletonHeader}>
          <div className={styles.skeletonTitle} />
          <div className={styles.skeletonIcon} />
        </div>
        <div className={styles.skeletonValue} />
        <div className={styles.skeletonChart} />
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.title}>{title}</span>
        {Icon && <span className={styles.iconWrapper}><Icon size={18} /></span>}
      </div>
      <div className={styles.value}>{value}</div>
      <div className={styles.chartContainer}>
        {trendData && trendData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData}>
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke={trendColor} 
                strokeWidth={2} 
                dot={false} 
                isAnimationActive={true}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <span className={styles.noData}>No trend data</span>
        )}
      </div>
    </div>
  );
}
