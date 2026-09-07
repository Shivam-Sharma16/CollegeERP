import { useMemo } from 'react';
import { useResolveDeptTreeQuery } from '../../api/departmentsApi';
import { Table } from '../ui/Table';

const columns = [
  { key: 'code', label: 'Subject Code', sortable: true },
  { key: 'name', label: 'Subject Name', sortable: true },
  { key: 'credits', label: 'Credits', sortable: true },
  { key: 'type', label: 'Type', sortable: true }
];

export function SubjectsTab() {
  const { data, isLoading } = useResolveDeptTreeQuery();

  const subjects = useMemo(() => {
    const list = [];
    if (!data?.data?.departments) return list;

    // Traverse the tree to extract all subjects within this HOD's department
    data.data.departments.forEach(dept => {
      dept.years?.forEach(year => {
        year.semesters?.forEach(sem => {
          sem.subjects?.forEach(sub => {
            list.push({
              ...sub,
              // Keep references if needed later
              _deptName: dept.name,
              _yearVal: year.year,
              _semVal: sem.semester
            });
          });
        });
      });
    });

    // Deduplicate by ID just in case
    const unique = Array.from(new Map(list.map(s => [s._id, s])).values());
    return unique;
  }, [data]);

  return (
    <div style={{ background: 'var(--color-surface)', padding: 'var(--spacing-5)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
      <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginBottom: 'var(--spacing-4)' }}>Department Subjects</h3>
      <Table 
        columns={columns} 
        data={subjects} 
        isLoading={isLoading} 
      />
    </div>
  );
}
