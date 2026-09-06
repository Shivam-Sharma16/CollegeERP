import { motion } from 'framer-motion';
import styles from './Card.module.css';

/**
 * Reusable Card component.
 * @param {boolean} interactive Apply hover lift if true
 * @param {string} className
 * @param {React.ReactNode} children
 */
export function Card({ interactive = false, className = '', children, ...props }) {
  const Component = interactive ? motion.div : 'div';
  const baseClass = styles.card;
  const finalClass = `${baseClass} ${className}`.trim();

  const animationProps = interactive
    ? {
        whileHover: { y: -2, boxShadow: 'var(--shadow-md)' },
        transition: { type: 'spring', stiffness: 300, damping: 20 },
      }
    : {};

  return (
    <Component className={finalClass} {...animationProps} {...props}>
      {children}
    </Component>
  );
}
