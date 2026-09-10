import { motion } from 'framer-motion';

/**
 * PageTransition — wraps any page's root element to produce a
 * 200ms fade + slight vertical-shift entrance on every route load.
 *
 * Usage:
 *   <PageTransition>
 *     <div className={styles.container}>…</div>
 *   </PageTransition>
 */
export function PageTransition({ children, className = '' }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}
