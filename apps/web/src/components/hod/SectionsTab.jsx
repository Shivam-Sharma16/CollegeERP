import { useMemo } from 'react';
import { useResolveDeptTreeQuery } from '../../api/departmentsApi';
import { Table } from '../ui/Table';

const columns = [
  { key: 'name', label: 'Section Name', sortable: true },
  { key: 'year', label: 'Year', sortable: true },
  { key: 'semester', label: 'Semester', sortable: true },
  { key: 'capacity', label: 'Capacity', sortable: true }
];

export function SectionsTab() {
  const { data, isLoading } = useResolveDeptTreeQuery();

  const sections = useMemo(() => {
    const list = [];
    if (!data?.data?.departments) return list;

    // Traverse the tree to extract all sections within this HOD's department
    data.data.departments.forEach(dept => {
      dept.years?.forEach(year => {
        year.semesters?.forEach(sem => {
          sem.sections?.forEach(sec => {
            list.push({
              ...sec,
              year: `Year ${year.year}`,
              semester: `Sem ${sem.semester}`,
            });
          });
        });
      });
    });

    return list;
  }, [data]);

  return (
    <div style={{ background: 'var(--color-surface)', padding: 'var(--spacing-5)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
      <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginBottom: 'var(--spacing-4)' }}>Department Sections</h3>
      <Table 
        columns={columns} 
        data={sections} 
        isLoading={isLoading} 
      />
    </div>
  );
}
