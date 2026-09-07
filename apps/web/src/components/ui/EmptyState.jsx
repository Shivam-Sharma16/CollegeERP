import { useNavigate } from 'react-router-dom';
import styles from './EmptyState.module.css';

export function EmptyState({ title, description, actionLabel, actionRoute }) {
  const navigate = useNavigate();

  return (
    <div className={styles.container}>
      <div className={styles.illustration}>📁</div>
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.description}>{description}</p>
      {actionLabel && actionRoute && (
        <button 
          className={styles.actionButton}
          onClick={() => navigate(actionRoute)}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
