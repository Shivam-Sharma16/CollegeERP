import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import styles from './Toast.module.css';

const icons = {
  success: <CheckCircle size={20} className={styles.iconSuccess} />,
  error: <AlertCircle size={20} className={styles.iconError} />,
  info: <Info size={20} className={styles.iconInfo} />,
  warning: <AlertTriangle size={20} className={styles.iconWarning} />
};

export function Toast({ id, type = 'info', title, message, duration = 3000, onClose }) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    let startTime = Date.now();
    let animationFrame;

    const updateProgress = () => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);

      if (remaining > 0) {
        animationFrame = requestAnimationFrame(updateProgress);
      } else {
        onClose(id);
      }
    };

    animationFrame = requestAnimationFrame(updateProgress);

    return () => cancelAnimationFrame(animationFrame);
  }, [id, duration, onClose]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 50, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className={styles.toast}
    >
      <div className={styles.contentWrapper}>
        <div className={styles.icon}>{icons[type]}</div>
        <div className={styles.textWrapper}>
          {title && <h4 className={styles.title}>{title}</h4>}
          {message && <p className={styles.message}>{message}</p>}
        </div>
        <button onClick={() => onClose(id)} className={styles.closeBtn}>
          <X size={16} />
        </button>
      </div>
      <div className={styles.progressBarWrapper}>
        <div 
          className={`${styles.progressBar} ${styles[`progress-${type}`]}`} 
          style={{ width: `${progress}%` }} 
        />
      </div>
    </motion.div>
  );
}
