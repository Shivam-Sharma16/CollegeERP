import { motion } from 'framer-motion';
import styles from './Skeleton.module.css';

/**
 * Reusable Skeleton loader component for list/table shaped content.
 * @param {string} className
 * @param {string} width
 * @param {string} height
 * @param {string} borderRadius
 */
export function Skeleton({ className = '', width, height, borderRadius, style = {}, ...props }) {
  const customStyle = {
    ...style,
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
    ...(borderRadius ? { borderRadius } : {}),
  };

  return (
    <div
      className={`${styles.skeleton} ${className}`}
      style={customStyle}
      {...props}
    />
  );
}
