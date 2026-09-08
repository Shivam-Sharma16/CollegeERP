import { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { Clock, Users, BookOpen } from 'lucide-react';
import styles from './SessionCard.module.css';

export function SessionCard({ session, onStart }) {
  const [now, setNow] = useState(Date.now());

  // Update 'now' every second to keep countdown accurate
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const scheduledTime = new Date(session.scheduledStartTime).getTime();
  
  // Let's say the window opens exactly at the scheduled time (or maybe 5 min before)
  // For safety, let's just use scheduled time.
  const windowOpensAt = scheduledTime;
  const timeDiffMs = windowOpensAt - now;

  const isWindowOpen = timeDiffMs <= 0;

  // Format the countdown
  let countdownText = '';
  if (!isWindowOpen) {
    const diffMinutes = Math.ceil(timeDiffMs / (1000 * 60));
    if (diffMinutes > 60) {
      const hours = Math.floor(diffMinutes / 60);
      const mins = diffMinutes % 60;
      countdownText = `Starts in ${hours}h ${mins}m`;
    } else {
      countdownText = `Starts in ${diffMinutes} min`;
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div className={styles.timeSlot}>
          <Clock size={16} />
          {session.timeSlot}
        </div>
        {session.hasStarted && <span className={styles.activeBadge}>Active</span>}
      </div>

      <div className={styles.subjectInfo}>
        <h4 className={styles.subjectName}>{session.subject?.name || 'Unknown Subject'}</h4>
        <div className={styles.metaRow}>
          <div className={styles.metaItem}>
            <BookOpen size={14} />
            <span>{session.subject?.code || 'SUB-CODE'}</span>
          </div>
          <div className={styles.metaItem}>
            <Users size={14} />
            <span>Section {session.section?.name || 'A'}</span>
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        {session.hasStarted ? (
          <Button variant="primary" onClick={() => onStart(session)} className={styles.startBtn}>
            Resume Session
          </Button>
        ) : (
          <Button 
            variant="primary" 
            onClick={() => onStart(session)}
            disabled={!isWindowOpen}
            className={styles.startBtn}
          >
            {isWindowOpen ? 'Start Session' : countdownText}
          </Button>
        )}
      </div>
    </div>
  );
}
