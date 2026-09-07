import { useEffect, useState } from 'react';
import { Skeleton } from './Skeleton';
import styles from './StatCard.module.css';

function easeOutExpo(t) {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

export function StatCard({ title, value, icon, isLoading }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (isLoading || value == null) return;
    
    const target = Number(value);
    if (isNaN(target)) {
      setDisplayValue(value);
      return;
    }

    const duration = 800; // ms
    const startTime = performance.now();

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      const currentVal = Math.floor(target * easeOutExpo(progress));
      setDisplayValue(currentVal);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setDisplayValue(target);
      }
    };

    requestAnimationFrame(animate);
  }, [value, isLoading]);

  return (
    <div className={styles.card}>
      <div className={styles.content}>
        <h3 className={styles.title}>{title}</h3>
        {isLoading ? (
          <Skeleton className={styles.skeletonValue} width="80px" height="36px" />
        ) : (
          <div className={styles.value}>{displayValue}</div>
        )}
      </div>
      {icon && <div className={styles.iconWrap}>{icon}</div>}
    </div>
  );
}
