import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import styles from './DepartmentComparisonChart.module.css';

export function DepartmentComparisonChart({ data = [], isLoading = false }) {
  const [shouldAnimate, setShouldAnimate] = useState(false);

  useEffect(() => {
    // Small delay to ensure the chart has mounted before starting animations
    // and Recharts uses isAnimationActive prop on Bar
    setShouldAnimate(true);
  }, []);

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.skeletonTitle} />
        <div className={styles.skeletonChart} />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className={styles.container}>
        <h3 className={styles.title}>Department Comparison</h3>
        <div className={styles.emptyState}>No comparison data available</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Department Comparison</h3>
      <div className={styles.chartWrapper}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
            <XAxis 
              dataKey="name" 
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }}
              dy={10}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }}
            />
            <Tooltip 
              cursor={{ fill: 'var(--color-surface-elevated)', opacity: 0.4 }}
              contentStyle={{ 
                backgroundColor: 'var(--color-surface)', 
                borderColor: 'var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-text)'
              }}
              itemStyle={{ color: 'var(--color-text)' }}
            />
            <Legend wrapperStyle={{ paddingTop: '20px' }} />
            
            {/* 
              Staggered animation trick: Recharts natively animates, 
              we can use different animationBegin times or rely on default sequence.
              Default Recharts <Bar> grows from bottom.
            */}
            <Bar 
              dataKey="attendance" 
              name="Attendance (%)" 
              fill="var(--color-primary)" 
              radius={[4, 4, 0, 0]} 
              isAnimationActive={shouldAnimate}
              animationBegin={0}
              animationDuration={800}
            />
            <Bar 
              dataKey="fees" 
              name="Fees Collected (%)" 
              fill="var(--color-secondary)" 
              radius={[4, 4, 0, 0]} 
              isAnimationActive={shouldAnimate}
              animationBegin={150} // staggered
              animationDuration={800}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
