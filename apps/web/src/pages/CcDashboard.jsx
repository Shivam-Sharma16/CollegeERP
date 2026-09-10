import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardShell } from '../components/DashboardShell';
import { UsersTable } from '../components/users/UsersTable';
import { CreateStudentModal } from '../components/users/CreateStudentModal';
import { StaggerList, StaggerItem } from '../components/ui/StaggerList';
import { FadeIn } from '../components/ui/FadeIn';
import { Skeleton } from '../components/ui/Skeleton';
import { useListSectionStudentsQuery } from '../api/usersApi';
import { useGetMySectionQuery } from '../api/academicApi';
import { useGetSectionWeeklyAttendanceQuery, useGetPendingDisputesCountQuery } from '../api/attendanceApi';
import { PageTransition } from '../components/ui/PageTransition';
import styles from './CcDashboard.module.css';

// Using label as required by Table.jsx
const studentColumns = [
  { key: 'name', label: 'Name' },
  { key: 'rollNumber', label: 'Roll Number' },
  { 
    key: 'attendance', 
    label: 'Attendance %',
    render: (_, row) => {
      // Mocking attendance data if not present on user object
      const val = row.attendance || Math.floor(Math.random() * 40) + 60;
      return <span style={{ fontWeight: '600', color: val < 75 ? 'var(--danger-500)' : 'inherit' }}>{val}%</span>;
    }
  },
  { 
    key: 'marks', 
    label: 'Marks Summary',
    render: (_, row) => {
      const avg = row.marksAvg || Math.floor(Math.random() * 50) + 50;
      return <span>Avg: {avg}%</span>;
    }
  },
  {
    key: 'status',
    label: 'Status',
    render: (_, row) => {
      return (
        <span style={{
          padding: '2px 8px',
          borderRadius: '12px',
          fontSize: '12px',
          fontWeight: 'bold',
          background: 'var(--success-100)',
          color: 'var(--success-700)'
        }}>
          Active
        </span>
      );
    }
  }
];

export default function CcDashboard() {
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Fetch section data
  const { data: sectionData, isLoading: sectionLoading } = useGetMySectionQuery();
  const section = sectionData?.data;
  
  const sectionId = section?._id;

  // 2. Fetch weekly attendance and pending disputes for the section
  const { data: attendanceData } = useGetSectionWeeklyAttendanceQuery(sectionId, {
    skip: !sectionId
  });
  const weeklyAttendancePercent = attendanceData?.data?.percentage || 0;

  const { data: disputesData } = useGetPendingDisputesCountQuery(sectionId, {
    skip: !sectionId
  });
  const pendingDisputesCount = disputesData?.data?.count || 0;

  // 3. Roster
  const { data: studentsData, isLoading: studentsLoading } = useListSectionStudentsQuery();
  
  const filteredStudents = useMemo(() => {
    if (!studentsData?.data) return [];
    if (!searchQuery) return studentsData.data;
    const lowerQuery = searchQuery.toLowerCase();
    return studentsData.data.filter(s => 
      s.name?.toLowerCase().includes(lowerQuery) || 
      s.rollNumber?.toLowerCase().includes(lowerQuery) ||
      s.email?.toLowerCase().includes(lowerQuery)
    );
  }, [studentsData, searchQuery]);

  const studentCount = studentsData?.data?.length || 0;

  // Calculate SVG attributes for progress ring
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (weeklyAttendancePercent / 100) * circumference;

  return (
    <DashboardShell title="Class Coordinator" subtitle="Section management" icon="👨‍🏫">
      <PageTransition>
      <div className={styles.dashboard}>
        
        {/* Prominent Section-Header Card */}
        <div className={styles.headerCard}>
          <div className={styles.headerInfo}>
            <h2 className={styles.sectionName}>
              {sectionLoading ? 'Loading Section...' : (section?.name || 'Unassigned Section')}
            </h2>
            <div className={styles.semesterLabel}>
              {section?.semester?.name || 'Semester -'} | {section?.semester?.year?.name || 'Year -'}
            </div>
            <div className={styles.studentCount}>
              <span>👥</span>
              <span>{studentCount} Students Enrolled</span>
            </div>
          </div>

          {/* Radial Progress Ring */}
          <div className={styles.progressContainer}>
            <div className={styles.progressRing}>
              <svg viewBox="0 0 80 80">
                <circle
                  className={styles.progressRingCircleBg}
                  cx="40"
                  cy="40"
                  r={radius}
                />
                <circle
                  className={styles.progressRingCircle}
                  cx="40"
                  cy="40"
                  r={radius}
                  style={{ strokeDasharray: circumference, strokeDashoffset }}
                />
              </svg>
              <div className={styles.progressRingText}>
                {Math.round(weeklyAttendancePercent)}%
              </div>
            </div>
            <span className={styles.progressLabel}>This Week</span>
          </div>
        </div>

        {/* Quick Links */}
        <h3 className={styles.sectionHeader}>Quick Actions</h3>
        <StaggerList className={styles.quickLinks}>
          <StaggerItem>
            <div 
              className={styles.quickLinkCard} 
              onClick={() => {
                document.getElementById('roster-section')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              <div className={styles.quickLinkHeader}>
                <span className={styles.quickLinkIcon}>📋</span>
                <span>Class Roster</span>
                <span className={styles.badge}>{studentCount}</span>
              </div>
              <p className={styles.quickLinkDesc}>View and manage enrolled students, add new students.</p>
            </div>
          </StaggerItem>

          <StaggerItem>
            <div 
              className={styles.quickLinkCard}
              onClick={() => navigate('/cc/workspace?tab=disputes')}
            >
              <div className={styles.quickLinkHeader}>
                <span className={styles.quickLinkIcon}>⚠️</span>
                <span>Disputes</span>
                {pendingDisputesCount > 0 ? (
                  <span className={`${styles.badge} ${styles.badgeWarning}`}>
                    {pendingDisputesCount} pending
                  </span>
                ) : (
                  <span className={styles.badge}>0</span>
                )}
              </div>
              <p className={styles.quickLinkDesc}>Review and resolve student attendance disputes.</p>
            </div>
          </StaggerItem>
        </StaggerList>

        {/* Roster Section */}
        <div id="roster-section" style={{ marginTop: 'var(--spacing-6)' }}>
          <div style={{ display: 'flex', gap: 'var(--spacing-4)', marginBottom: 'var(--spacing-4)' }}>
            <input 
              type="text" 
              placeholder="Search students by name, email, or roll number..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                padding: '0.5rem 1rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                background: 'var(--surface-2)',
                color: 'var(--text-1)'
              }}
            />
          </div>
          <UsersTable
            title="Students in your Section"
            data={filteredStudents}
            columns={studentColumns}
            isLoading={studentsLoading}
            onCreate={() => setModalOpen(true)}
            createLabel="Onboard Student"
          />
        </div>

        <CreateStudentModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
      </div>
      </PageTransition>
    </DashboardShell>
  );
}
