import { DashboardShell } from '../components/DashboardShell';
import { AcademicTree } from '../components/hod/AcademicTree';
import { SubjectsTable } from '../components/hod/SubjectsTable';
import { FadeIn } from '../components/ui/FadeIn';
import { Skeleton } from '../components/ui/Skeleton';
import { useResolveDeptTreeQuery } from '../api/departmentsApi';
import { PageTransition } from '../components/ui/PageTransition';
import styles from './HodAcademicStructure.module.css';

export default function HodAcademicStructure() {
  const { data, isLoading, isError } = useResolveDeptTreeQuery();

  // The backend resolves a global tree, but since the user is an HOD,
  // we assume the tree returned only contains their department,
  // OR we pick the first one if it's an array.
  const departmentTree = data?.data?.departments?.[0];

  return (
    <DashboardShell title="Academic Structure" subtitle="Manage Years, Semesters, Sections, and Subjects" icon="Layers">
      <PageTransition>
      <FadeIn
        show={!isLoading}
        skeleton={
          <div className={styles.splitPanel}>
            <div className={styles.leftPanel}><Skeleton height="300px" /></div>
            <div className={styles.rightPanel}><Skeleton height="300px" /></div>
          </div>
        }
      >
        {isError ? (
          <div className={styles.error}>Failed to load academic structure.</div>
        ) : (
          <div className={styles.splitPanel}>
            <div className={styles.leftPanel}>
              <h3 className={styles.panelTitle}>Academic Hierarchy</h3>
              <AcademicTree department={departmentTree} />
            </div>
            
            <div className={styles.rightPanel}>
              <h3 className={styles.panelTitle}>Department Subjects</h3>
              <SubjectsTable department={departmentTree} />
            </div>
          </div>
        )}
      </FadeIn>
      </PageTransition>
    </DashboardShell>
  );
}
