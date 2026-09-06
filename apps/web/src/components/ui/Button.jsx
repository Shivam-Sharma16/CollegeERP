import { motion } from 'framer-motion';
import styles from './Button.module.css';

/**
 * Reusable Button component with Framer Motion animations.
 * @param {string} variant 'primary' | 'secondary' | 'ghost' | 'danger'
 * @param {boolean} disabled
 * @param {boolean} fullWidth
 * @param {React.ReactNode} children
 * @param {string} className
 */
export function Button({
  variant = 'primary',
  disabled = false,
  fullWidth = false,
  className = '',
  children,
  ...props
}) {
  const baseClass = styles.button;
  const variantClass = styles[variant] || styles.primary;
  const widthClass = fullWidth ? styles.fullWidth : '';
  const finalClass = `${baseClass} ${variantClass} ${widthClass} ${className}`.trim();

  return (
    <motion.button
      className={finalClass}
      disabled={disabled}
      whileHover={disabled ? {} : { y: -1, boxShadow: 'var(--shadow-md)' }}
      whileTap={disabled ? {} : { scale: 0.98 }}
      {...props}
    >
      {children}
    </motion.button>
  );
}
