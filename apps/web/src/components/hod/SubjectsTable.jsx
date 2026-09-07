import { useState, useMemo } from 'react';
import { Table } from '../ui/Table';
import { Button } from '../ui/Button';
import { CreateSubjectModal } from './CreateSubjectModal';
import { Plus } from 'lucide-react';

export function SubjectsTable({ department }) {
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);

  // Flatten the tree to extract subjects
  const subjects = useMemo(() => {
    const list = [];
    if (!department) return list;

    department.years?.forEach(year => {
      year.semesters?.forEach(sem => {
        sem.subjects?.forEach(sub => {
          list.push({
            ...sub,
            year: `Year ${year.year}`,
            semester: `Sem ${sem.semester}`,
          });
        });
      });
    });

    // Deduplicate by ID
    return Array.from(new Map(list.map(s => [s._id, s])).values());
  }, [department]);

  const columns = [
    { key: 'code', label: 'Code', sortable: true },
    { key: 'name', label: 'Name', sortable: true },
    { key: 'credits', label: 'Credits', sortable: true },
    { key: 'type', label: 'Type' },
    { key: 'semester', label: 'Semester', sortable: true }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="secondary" onClick={() => setIsSubjectModalOpen(true)}>
          <Plus size={16} /> Add Subject
        </Button>
      </div>

      <Table columns={columns} data={subjects} />

      <CreateSubjectModal
        isOpen={isSubjectModalOpen}
        onClose={() => setIsSubjectModalOpen(false)}
        departmentId={department?._id}
        department={department} // Pass the whole tree if needed to build year/sem dropdowns
      />
    </div>
  );
}
