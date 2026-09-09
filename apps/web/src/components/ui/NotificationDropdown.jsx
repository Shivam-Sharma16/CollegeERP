import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Check, CheckCircle2 } from 'lucide-react';
import { useListNotificationsQuery, useMarkReadMutation, useMarkAllReadMutation, useGetUnreadCountQuery } from '../../api/notificationApi';
import styles from './NotificationDropdown.module.css';

export function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const { data: unreadData } = useGetUnreadCountQuery(undefined, { pollingInterval: 30000 });
  const { data: notifData, isLoading } = useListNotificationsQuery({ limit: 50 });
  const [markRead] = useMarkReadMutation();
  const [markAllRead] = useMarkAllReadMutation();

  const unreadCount = unreadData?.data?.unreadCount || 0;
  const notifications = notifData?.data || [];

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleMarkAllRead = async () => {
    try {
      await markAllRead().unwrap();
    } catch (err) {
      console.error('Failed to mark all as read', err);
    }
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.readAt) {
      try {
        await markRead(notif._id).unwrap();
      } catch (err) {
        console.error('Failed to mark read', err);
      }
    }
  };

  // Group by day
  const grouped = notifications.reduce((acc, notif) => {
    const d = new Date(notif.createdAt);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    let label = d.toLocaleDateString();
    if (d.toDateString() === today.toDateString()) label = 'Today';
    else if (d.toDateString() === yesterday.toDateString()) label = 'Yesterday';

    if (!acc[label]) acc[label] = [];
    acc[label].push(notif);
    return acc;
  }, {});

  return (
    <div className={styles.wrapper} ref={dropdownRef}>
      <button 
        className={styles.triggerBtn} 
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className={styles.badge}>{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className={styles.dropdown}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
          >
            <div className={styles.header}>
              <h3>Notifications</h3>
              {unreadCount > 0 && (
                <button className={styles.markAllBtn} onClick={handleMarkAllRead}>
                  <Check size={14} /> Mark all read
                </button>
              )}
            </div>

            <div className={styles.list}>
              {isLoading ? (
                <div className={styles.empty}>Loading...</div>
              ) : notifications.length === 0 ? (
                <div className={styles.empty}>
                  <CheckCircle2 size={32} className={styles.emptyIcon} />
                  <p>You're all caught up!</p>
                </div>
              ) : (
                Object.entries(grouped).map(([day, items]) => (
                  <div key={day} className={styles.group}>
                    <div className={styles.groupLabel}>{day}</div>
                    {items.map(notif => (
                      <div 
                        key={notif._id} 
                        className={`${styles.item} ${!notif.readAt ? styles.unread : ''}`}
                        onClick={() => handleNotificationClick(notif)}
                      >
                        <div className={styles.itemContent}>
                          <div className={styles.itemTitle}>{notif.title}</div>
                          <div className={styles.itemBody}>{notif.body}</div>
                          <div className={styles.itemTime}>
                            {new Date(notif.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        {!notif.readAt && <div className={styles.unreadDot} />}
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
