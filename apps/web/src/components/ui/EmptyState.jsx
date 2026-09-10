import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import styles from './EmptyState.module.css';

/* ── Built-in SVG illustrations ─────────────────────────────────────────── */
const ICONS = {
  folder: (
    <svg viewBox="0 0 80 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="18" width="72" height="42" rx="6" fill="currentColor" opacity="0.12"/>
      <rect x="4" y="18" width="72" height="42" rx="6" stroke="currentColor" strokeWidth="2" opacity="0.35"/>
      <path d="M4 26h72" stroke="currentColor" strokeWidth="2" opacity="0.3"/>
      <rect x="4" y="8" width="28" height="12" rx="4" fill="currentColor" opacity="0.2"/>
      <rect x="4" y="8" width="28" height="12" rx="4" stroke="currentColor" strokeWidth="2" opacity="0.35"/>
      <circle cx="40" cy="40" r="8" fill="currentColor" opacity="0.18"/>
      <path d="M36 40h8M40 36v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5"/>
    </svg>
  ),
  inbox: (
    <svg viewBox="0 0 80 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="12" width="64" height="44" rx="6" fill="currentColor" opacity="0.1"/>
      <rect x="8" y="12" width="64" height="44" rx="6" stroke="currentColor" strokeWidth="2" opacity="0.3"/>
      <path d="M8 38h16l6 8h20l6-8h16" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" opacity="0.4"/>
      <path d="M32 24h16M32 31h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.35"/>
    </svg>
  ),
  chart: (
    <svg viewBox="0 0 80 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="8" width="64" height="48" rx="6" fill="currentColor" opacity="0.08"/>
      <rect x="8" y="8" width="64" height="48" rx="6" stroke="currentColor" strokeWidth="2" opacity="0.25"/>
      <rect x="18" y="32" width="10" height="18" rx="2" fill="currentColor" opacity="0.3"/>
      <rect x="35" y="22" width="10" height="28" rx="2" fill="currentColor" opacity="0.4"/>
      <rect x="52" y="16" width="10" height="34" rx="2" fill="currentColor" opacity="0.35"/>
      <path d="M16 50h48" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.3"/>
    </svg>
  ),
  users: (
    <svg viewBox="0 0 80 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="30" cy="22" r="10" fill="currentColor" opacity="0.15"/>
      <circle cx="30" cy="22" r="10" stroke="currentColor" strokeWidth="2" opacity="0.3"/>
      <path d="M10 52c0-11 9-18 20-18s20 7 20 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.3"/>
      <circle cx="54" cy="24" r="8" fill="currentColor" opacity="0.1"/>
      <circle cx="54" cy="24" r="8" stroke="currentColor" strokeWidth="2" opacity="0.2"/>
      <path d="M43 52c0-9 5-15 11-15 6 0 11 6 11 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.2"/>
    </svg>
  ),
  bell: (
    <svg viewBox="0 0 80 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M40 10C28 10 20 18 20 30v12l-4 6h48l-4-6V30C60 18 52 10 40 10z" fill="currentColor" opacity="0.12"/>
      <path d="M40 10C28 10 20 18 20 30v12l-4 6h48l-4-6V30C60 18 52 10 40 10z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" opacity="0.35"/>
      <path d="M34 48c0 3.3 2.7 6 6 6s6-2.7 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.4"/>
      <path d="M40 10V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.4"/>
    </svg>
  ),
  document: (
    <svg viewBox="0 0 80 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="16" y="4" width="48" height="56" rx="6" fill="currentColor" opacity="0.1"/>
      <rect x="16" y="4" width="48" height="56" rx="6" stroke="currentColor" strokeWidth="2" opacity="0.3"/>
      <path d="M50 4v18h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.25"/>
      <path d="M26 32h28M26 40h20M26 48h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.3"/>
    </svg>
  ),
  lock: (
    <svg viewBox="0 0 80 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="16" y="28" width="48" height="30" rx="6" fill="currentColor" opacity="0.12"/>
      <rect x="16" y="28" width="48" height="30" rx="6" stroke="currentColor" strokeWidth="2" opacity="0.35"/>
      <path d="M28 28V20a12 12 0 0 1 24 0v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.4"/>
      <circle cx="40" cy="44" r="4" fill="currentColor" opacity="0.4"/>
      <path d="M40 48v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.35"/>
    </svg>
  ),
  default: (
    <svg viewBox="0 0 80 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="18" width="72" height="42" rx="6" fill="currentColor" opacity="0.12"/>
      <rect x="4" y="18" width="72" height="42" rx="6" stroke="currentColor" strokeWidth="2" opacity="0.35"/>
      <path d="M4 26h72" stroke="currentColor" strokeWidth="2" opacity="0.3"/>
      <rect x="4" y="8" width="28" height="12" rx="4" fill="currentColor" opacity="0.2"/>
      <rect x="4" y="8" width="28" height="12" rx="4" stroke="currentColor" strokeWidth="2" opacity="0.35"/>
    </svg>
  ),
};

/**
 * EmptyState — context-aware empty state with SVG illustration,
 * idle float animation, and an optional action button.
 *
 * @param {string} title         - Bold heading
 * @param {string} description   - Muted sub-text (one line recommended)
 * @param {string} actionLabel   - CTA button label
 * @param {string} actionRoute   - Router path to navigate to on CTA click
 * @param {string} icon          - Key into ICONS: 'folder'|'inbox'|'chart'|'users'|'bell'|'document'|'lock'
 */
import { memo } from 'react';

export const EmptyState = memo(function EmptyState({ title, description, actionLabel, actionRoute, icon = 'default' }) {
  const navigate = useNavigate();
  const IllustrationSvg = ICONS[icon] ?? ICONS.default;

  return (
    <div className={styles.container}>
      <motion.div
        className={styles.illustration}
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        {IllustrationSvg}
      </motion.div>
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
});
