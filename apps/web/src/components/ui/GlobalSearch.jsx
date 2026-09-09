import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, User, Bell, X, AlertCircle } from 'lucide-react';
import { useGlobalSearchQuery } from '../../api/searchApi';
import { useNavigate } from 'react-router-dom';
import styles from './GlobalSearch.module.css';

// Custom hook for debouncing input
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);
  const navigate = useNavigate();
  const inputRef = useRef(null);

  const { data, isLoading, isFetching } = useGlobalSearchQuery(debouncedQuery, {
    skip: !isOpen || debouncedQuery.length < 2
  });

  const searchResults = data?.data || { users: [], notices: [] };
  const hasResults = searchResults.users.length > 0 || searchResults.notices.length > 0;
  const isSearching = isLoading || isFetching;

  // Listen for Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  const handleClose = () => setIsOpen(false);

  const navigateToResult = (type, id) => {
    handleClose();
    if (type === 'notice') {
      navigate('/student/notices'); // simplistic routing, ideally to specific notice
    } else if (type === 'user') {
      // route to user profile or directory
      navigate('/directory'); 
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            className={styles.backdrop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
          />
          <motion.div 
            className={styles.palette}
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.15 }}
          >
            <div className={styles.searchHeader}>
              <Search className={styles.searchIcon} size={20} />
              <input
                ref={inputRef}
                className={styles.searchInput}
                placeholder="Search students, notices, subjects..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button className={styles.closeBtn} onClick={handleClose}>
                <X size={16} />
              </button>
            </div>

            <div className={styles.resultsArea}>
              {query.length < 2 ? (
                <div className={styles.emptyState}>
                  <p>Type at least 2 characters to search.</p>
                  <p className={styles.hint}>Pro tip: Your search is securely scoped to your role permissions.</p>
                </div>
              ) : isSearching ? (
                <div className={styles.emptyState}>
                  <div className={styles.spinner} />
                  <p>Searching...</p>
                </div>
              ) : !hasResults ? (
                <div className={styles.emptyState}>
                  <AlertCircle size={32} className={styles.noResultsIcon} />
                  <p>No results found for "{query}"</p>
                </div>
              ) : (
                <div className={styles.resultsList}>
                  {searchResults.users.length > 0 && (
                    <div className={styles.resultGroup}>
                      <div className={styles.groupHeader}>People</div>
                      {searchResults.users.map(user => (
                        <div 
                          key={user._id} 
                          className={styles.resultItem}
                          onClick={() => navigateToResult('user', user._id)}
                        >
                          <div className={styles.itemIcon}><User size={16} /></div>
                          <div className={styles.itemContent}>
                            <div className={styles.itemTitle}>{user.name}</div>
                            <div className={styles.itemSubtitle}>{user.roles.join(', ')} • {user.email}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {searchResults.notices.length > 0 && (
                    <div className={styles.resultGroup}>
                      <div className={styles.groupHeader}>Notices</div>
                      {searchResults.notices.map(notice => (
                        <div 
                          key={notice._id} 
                          className={styles.resultItem}
                          onClick={() => navigateToResult('notice', notice._id)}
                        >
                          <div className={styles.itemIcon}><Bell size={16} /></div>
                          <div className={styles.itemContent}>
                            <div className={styles.itemTitle}>{notice.title}</div>
                            <div className={styles.itemSubtitle}>{new Date(notice.publishedAt).toLocaleDateString()}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className={styles.footer}>
              <span className={styles.shortcut}>ESC</span> to close
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
