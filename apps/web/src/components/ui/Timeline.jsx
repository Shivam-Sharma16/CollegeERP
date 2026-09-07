import styles from './Timeline.module.css';

export function Timeline({ items = [], isLoading }) {
  if (isLoading) {
    return (
      <div className={styles.timeline}>
        {[1, 2, 3].map(i => (
          <div key={i} className={styles.item}>
            <div className={styles.dot} />
            <div className={styles.content}>
              <div className={`${styles.skeleton} ${styles.skeletonTime}`} />
              <div className={`${styles.skeleton} ${styles.skeletonDesc}`} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return <p className={styles.empty}>No recent activity.</p>;
  }

  return (
    <div className={styles.timeline}>
      {items.map((item, index) => (
        <div key={item.id || index} className={styles.item}>
          <div className={styles.dot} />
          <div className={styles.content}>
            <div className={styles.time}>{new Date(item.timestamp).toLocaleString()}</div>
            <div className={styles.desc}>{item.action} by {item.user}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
