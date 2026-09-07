import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import styles from './Accordion.module.css';

export function Accordion({ title, children, defaultExpanded = false }) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className={`${styles.accordion} ${isExpanded ? styles.expanded : ''}`}>
      <button 
        className={styles.header} 
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
      >
        <span className={styles.title}>{title}</span>
        <ChevronDown className={`${styles.icon} ${isExpanded ? styles.rotated : ''}`} />
      </button>
      <div className={styles.contentGrid}>
        <div className={styles.contentInner}>
          <div className={styles.contentPadding}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
