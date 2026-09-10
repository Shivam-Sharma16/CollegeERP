import { useGetFacultyLoadQuery } from '../../api/teachingApi';
import { Button } from '../ui/Button';
import { User, BookOpen } from 'lucide-react';
import styles from './FacultyCard.module.css';

import { memo } from 'react';

export const FacultyCard = memo(function FacultyCard({ faculty, onReassign }) {
  // Lazily fetches faculty load scoped to this specific card
  const { data, isLoading } = useGetFacultyLoadQuery(faculty._id);

  const load = data?.data;
  const totalSessions = load?.sessions || 0;
  const subjectsCount = load?.subjects?.length || 0;

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.avatar}>
          <User size={24} color="var(--color-primary)" />
        </div>
        <div className={styles.info}>
          <h4 className={styles.name}>{faculty.name}</h4>
          <p className={styles.email}>{faculty.email}</p>
        </div>
      </div>

      <div className={styles.stats}>
        {isLoading ? (
          <div className={styles.skeleton}>Loading stats...</div>
        ) : (
          <>
            <div className={styles.statItem}>
              <BookOpen size={16} />
              <span>{subjectsCount} Subjects</span>
            </div>
            <div className={styles.statItem}>
              <span>{totalSessions} Sessions</span>
            </div>
          </>
        )}
      </div>

      <div className={styles.actions}>
        <Button variant="secondary" size="sm" onClick={() => onReassign(faculty)} className={styles.fullWidthBtn}>
          Assign Subject
        </Button>
      </div>
    </div>
  );
});
