import styles from './DepartmentTree.module.css';

export function DepartmentTree({ department }) {
  if (!department?.years?.length) {
    return <p className={styles.empty}>No academic structure defined yet.</p>;
  }

  return (
    <div className={styles.tree}>
      {department.years.map(year => (
        <div key={year.year} className={styles.yearNode}>
          <div className={styles.nodeHeader}>Year {year.year}</div>
          <div className={styles.children}>
            {year.semesters?.map(sem => (
              <div key={sem.semester} className={styles.semNode}>
                <div className={styles.nodeHeader}>Semester {sem.semester}</div>
                <div className={styles.children}>
                  {sem.sections?.length > 0 ? (
                    <div className={styles.sectionsList}>
                      {sem.sections.map(sec => (
                        <span key={sec._id} className={styles.sectionBadge}>
                          {sec.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className={styles.empty}>No sections</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
