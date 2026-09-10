import { motion } from 'framer-motion';

/**
 * StaggerList — wrap a list/grid container with this to automatically
 * stagger-animate its children on mount.
 *
 * Usage:
 *   <StaggerList>
 *     {items.map(item => (
 *       <StaggerItem key={item.id}><Card data={item} /></StaggerItem>
 *     ))}
 *   </StaggerList>
 */

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.04, // 40ms between each child
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.22, ease: 'easeOut' },
  },
};

export function StaggerList({ children, className = '', style }) {
  return (
    <motion.div
      className={className}
      style={style}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className = '', style }) {
  return (
    <motion.div className={className} style={style} variants={itemVariants}>
      {children}
    </motion.div>
  );
}
