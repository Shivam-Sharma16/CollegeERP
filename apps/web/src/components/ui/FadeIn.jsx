import { AnimatePresence, motion } from 'framer-motion';

/**
 * FadeIn — smoothly cross-fades a skeleton placeholder → real content.
 * When `show` is false the `skeleton` slot renders; once `show` is true
 * the skeleton exits and `children` enter via a short cross-fade.
 *
 * Usage:
 *   <FadeIn show={!isLoading} skeleton={<SkeletonRows />}>
 *     <RealContent />
 *   </FadeIn>
 */
export function FadeIn({ show, skeleton = null, children }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      {!show ? (
        <motion.div
          key="skeleton"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {skeleton}
        </motion.div>
      ) : (
        <motion.div
          key="content"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
