import { useState, useMemo } from 'react';
import { DashboardShell } from '../components/DashboardShell';
import { TeachingMatrix } from '../components/hod/TeachingMatrix';
import { FadeIn } from '../components/ui/FadeIn';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { useResolveDeptTreeQuery } from '../api/departmentsApi';
import { useListFacultyQuery } from '../api/usersApi';
import { useListTeachingAssignmentsQuery } from '../api/teachingApi';
import { PageTransition } from '../components/ui/PageTransition';
import styles from './HodTeachingAssignments.module.css';

export default function HodTeachingAssignments() {
  const { data: deptData, isLoading: isLoadingTree } = useResolveDeptTreeQuery();
  const { data: facultyData, isLoading: isLoadingFaculty } = useListFacultyQuery();
  const { data: assignmentsData, isLoading: isLoadingAssignments } = useListTeachingAssignmentsQuery();

  const [selectedSemesterId, setSelectedSemesterId] = useState('');

  const departmentTree = deptData?.data?.departments?.[0];
  const facultyList = facultyData?.data || [];
  const assignmentsList = assignmentsData?.data || [];

  // Extract all semesters for the filter
  const semestersList = useMemo(() => {
    const list = [];
    if (!departmentTree) return list;
    departmentTree.years?.forEach(year => {
      year.semesters?.forEach(sem => {
        list.push({ ...sem, _label: `Year ${year.year} - Sem ${sem.semester}` });
      });
    });
    return list;
  }, [departmentTree]);

  // Auto-select first semester if not set
  useMemo(() => {
    if (!selectedSemesterId && semestersList.length > 0) {
      setSelectedSemesterId(semestersList[0]._id);
    }
  }, [semestersList, selectedSemesterId]);

  // Extract columns (Subject+Section combinations) for the selected semester
  const columns = useMemo(() => {
    const cols = [];
    if (!selectedSemesterId || !semestersList.length) return cols;

    const targetSem = semestersList.find(s => s._id === selectedSemesterId);
    if (!targetSem) return cols;

    // For every subject in this semester, create a column for every section in this semester
    targetSem.subjects?.forEach(sub => {
      targetSem.sections?.forEach(sec => {
        cols.push({
          subjectId: sub._id,
          subjectName: sub.name,
          subjectCode: sub.code,
          subjectType: sub.type || 'lecture',
          sectionId: sec._id,
          sectionName: sec.name,
          _label: `${sub.code} - Sec ${sec.name}`
        });
      });
    });

    return cols;
  }, [selectedSemesterId, semestersList]);

  const isLoading = isLoadingTree || isLoadingFaculty || isLoadingAssignments;

  return (
    <DashboardShell title="Teaching Assignments" subtitle="Assign faculty to subjects and sections" icon="Link">
      <PageTransition>
      <div className={styles.container}>
        <div className={styles.filterBar}>
          <label htmlFor="semesterFilter" className={styles.filterLabel}>Semester Filter:</label>
          <select
            id="semesterFilter"
            className={styles.filterSelect}
            value={selectedSemesterId}
            onChange={(e) => setSelectedSemesterId(e.target.value)}
            disabled={isLoading}
          >
            {semestersList.map(sem => (
              <option key={sem._id} value={sem._id}>{sem._label}</option>
            ))}
          </select>
        </div>

        <FadeIn
          show={!isLoading}
          skeleton={<Skeleton height="400px" />}
        >
          {columns.length === 0 ? (
            <EmptyState
              icon="document"
              title="No subjects or sections"
              description="No subjects or sections found for the selected semester."
            />
          ) : (
            <TeachingMatrix 
              facultyList={facultyList} 
              columns={columns} 
              assignments={assignmentsList} 
            />
          )}
        </FadeIn>
      </div>
      </PageTransition>
    </DashboardShell>
  );
}
