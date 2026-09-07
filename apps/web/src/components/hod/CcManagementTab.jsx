import { useState, useMemo } from 'react';
import { useListCcQuery } from '../../api/usersApi';
import { useListSectionAssignmentsQuery } from '../../api/teachingApi';
import { Button } from '../ui/Button';
import { Table } from '../ui/Table';
import { CreateCcModal } from '../users/CreateCcModal';
import { SectionAssignmentModal } from './SectionAssignmentModal';
import { UserPlus } from 'lucide-react';
import styles from './CcManagementTab.module.css';

export function CcManagementTab() {
  const { data: usersData, isLoading: isLoadingUsers } = useListCcQuery();
  const { data: assignmentsData, isLoading: isLoadingAssignments } = useListSectionAssignmentsQuery();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedCc, setSelectedCc] = useState(null);

  const users = usersData?.data || [];
  const assignments = assignmentsData?.data || [];

  const tableData = useMemo(() => {
    return users.map(user => {
      // Find the active assignment for this CC
      const assignment = assignments.find(a => a.facultyId?._id === user._id);
      return {
        _id: user._id,
        name: user.name,
        email: user.email,
        assignedSection: assignment?.sectionId?.name || 'Unassigned',
        semester: assignment?.sectionId?.semester ? `Sem ${assignment.sectionId.semester}` : '-',
        validFrom: assignment?.validFrom ? new Date(assignment.validFrom).toLocaleDateString() : '-'
      };
    });
  }, [users, assignments]);

  const columns = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'email', label: 'Email' },
    { key: 'assignedSection', label: 'Assigned Section', sortable: true },
    { key: 'semester', label: 'Semester' },
    { key: 'validFrom', label: 'Valid From' },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setSelectedCc({ _id: row._id, name: row.name })}
        >
          <UserPlus size={16} style={{ marginRight: '6px' }} /> Assign to Section
        </Button>
      )
    }
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Class Coordinators</h3>
        <Button variant="primary" onClick={() => setIsCreateOpen(true)}>
          Create CC
        </Button>
      </div>

      <Table 
        columns={columns} 
        data={tableData} 
        isLoading={isLoadingUsers || isLoadingAssignments} 
      />

      <CreateCcModal 
        isOpen={isCreateOpen} 
        onClose={() => setIsCreateOpen(false)} 
      />

      {selectedCc && (
        <SectionAssignmentModal
          isOpen={!!selectedCc}
          onClose={() => setSelectedCc(null)}
          cc={selectedCc}
        />
      )}
    </div>
  );
}
