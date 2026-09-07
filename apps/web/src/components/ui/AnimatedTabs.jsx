import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './AnimatedTabs.module.css';

export function AnimatedTabs({ tabs, defaultTabId }) {
  const [activeTabId, setActiveTabId] = useState(defaultTabId || tabs[0]?.id);

  const activeTab = tabs.find(t => t.id === activeTabId);

  return (
    <div className={styles.container}>
      <div className={styles.tabList}>
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <button
              key={tab.id}
              className={`${styles.tabButton} ${isActive ? styles.active : ''}`}
              onClick={() => setActiveTabId(tab.id)}
            >
              {tab.label}
              {isActive && (
                <motion.div
                  layoutId="activeTabIndicator"
                  className={styles.indicator}
                  initial={false}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className={styles.contentArea}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTabId}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.2 }}
            className={styles.tabContent}
          >
            {activeTab?.content}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
