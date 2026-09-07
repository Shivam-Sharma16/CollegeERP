import { useState } from 'react';
import { Check, User } from 'lucide-react';
import { MatrixAssignmentModal } from './MatrixAssignmentModal';
import styles from './TeachingMatrix.module.css';

export function TeachingMatrix({ facultyList, columns, assignments }) {
  const [selectedCell, setSelectedCell] = useState(null);

  const getAssignment = (facultyId, subjectId, sectionId) => {
    // Teaching assignments in our API map faculty -> subject. 
    // Section assignment is separate?
    // Wait, the prompt says "subject+section combinations they could teach", and "teachingApi.useCreateTeachingAssignmentMutation".
    // Let's assume the mutation payload accepts { facultyId, subjectId, sectionId } to map a faculty to a specific subject in a specific section.
    return assignments.find(
      a => a.facultyId?._id === facultyId && 
           a.subjectId?._id === subjectId &&
           a.sectionId?._id === sectionId
    );
  };

  const handleCellClick = (faculty, column) => {
    const existing = getAssignment(faculty._id, column.subjectId, column.sectionId);
    setSelectedCell({
      faculty,
      column,
      existingAssignment: existing
    });
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.tableContainer}>
        <table className={styles.matrix}>
          <thead>
            <tr>
              <th className={styles.stickyCol}>Faculty</th>
              {columns.map((col, idx) => (
                <th key={idx} className={styles.headerCell} title={col._label}>
                  <div className={styles.headerContent}>
                    <span className={styles.subjectCode}>{col.subjectCode}</span>
                    <span className={styles.sectionName}>Sec {col.sectionName}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {facultyList.map(faculty => (
              <tr key={faculty._id}>
                <td className={styles.stickyCol}>
                  <div className={styles.facultyCell}>
                    <div className={styles.avatar}>
                      <User size={16} />
                    </div>
                    <span>{faculty.name}</span>
                  </div>
                </td>
                {columns.map((col, idx) => {
                  const assignment = getAssignment(faculty._id, col.subjectId, col.sectionId);
                  const isAssigned = !!assignment;

                  return (
                    <td 
                      key={idx} 
                      className={`${styles.cell} ${isAssigned ? styles.assigned : ''}`}
                      onClick={() => handleCellClick(faculty, col)}
                    >
                      {isAssigned && <Check size={18} className={styles.checkIcon} />}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedCell && (
        <MatrixAssignmentModal
          isOpen={!!selectedCell}
          onClose={() => setSelectedCell(null)}
          cellData={selectedCell}
        />
      )}
    </div>
  );
}
