import { useState, useCallback } from 'react';
import { useListFacultyQuery } from '../../api/usersApi';
import { Button } from '../ui/Button';
import { CreateFacultyModal } from '../users/CreateFacultyModal';
import { FacultyCard } from './FacultyCard';
import { TeachingAssignmentModal } from './TeachingAssignmentModal';
import styles from './FacultyManagementTab.module.css';

export function FacultyManagementTab() {
  const { data, isLoading, isError } = useListFacultyQuery();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedFaculty, setSelectedFaculty] = useState(null);

  const handleReassign = useCallback((faculty) => {
    setSelectedFaculty(faculty);
    setAssignModalOpen(true);
  }, []);

  if (isLoading) return <div>Loading faculty...</div>;
  if (isError) return <div className={styles.error}>Failed to load faculty.</div>;

  const facultyList = data?.data || [];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Department Faculty</h3>
        <Button variant="primary" onClick={() => setIsCreateOpen(true)}>
          Create Faculty
        </Button>
      </div>

      {facultyList.length === 0 ? (
        <div className={styles.empty}>No faculty members found in this department.</div>
      ) : (
        <div className={styles.grid}>
          {facultyList.map(faculty => (
            <FacultyCard 
              key={faculty._id} 
              faculty={faculty} 
              onReassign={handleReassign} 
            />
          ))}
        </div>
      )}

      <CreateFacultyModal 
        isOpen={isCreateOpen} 
        onClose={() => setIsCreateOpen(false)} 
      />
      
      {selectedFaculty && (
        <TeachingAssignmentModal
          isOpen={assignModalOpen}
          onClose={() => {
            setAssignModalOpen(false);
            setSelectedFaculty(null);
          }}
          faculty={selectedFaculty}
        />
      )}
    </div>
  );
}
