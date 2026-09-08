import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardShell } from '../components/DashboardShell';
import { UsersTable } from '../components/users/UsersTable';
import { CreateStudentModal } from '../components/users/CreateStudentModal';
import { useListStudentsQuery } from '../api/usersApi';
import { useGetMySectionQuery } from '../api/academicApi';
import { useGetSectionWeeklyAttendanceQuery, useGetPendingDisputesCountQuery } from '../api/attendanceApi';
import styles from './CcDashboard.module.css';

const studentColumns = [
  { key: 'name', header: 'Name' },
  { key: 'email', header: 'Email' }
];

export default function CcDashboard() {
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);

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

  // 3. Roster - could use sectionId but using listStudentsQuery as an example for now (or what was there originally)
  // Assuming listStudentsQuery is what original file used
  const { data: studentsData, isLoading: studentsLoading } = useListStudentsQuery();
  const studentCount = studentsData?.data?.length || 0;

  // Calculate SVG attributes for progress ring
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (weeklyAttendancePercent / 100) * circumference;

  return (
    <DashboardShell title="Class Coordinator" subtitle="Section management" icon="👨‍🏫">
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
        <div className={styles.quickLinks}>
          <div 
            className={styles.quickLinkCard} 
            onClick={() => {
              // Usually scroll to roster or navigate. 
              // The roster is down below in this page, so we could just anchor link or it's just visual for now.
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

          <div 
            className={styles.quickLinkCard}
            onClick={() => navigate('/dashboard/cc/disputes')}
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
        </div>

        {/* Existing UsersTable */}
        <div id="roster-section" style={{ marginTop: 'var(--spacing-6)' }}>
          <UsersTable
            title="Students in your Section"
            data={studentsData?.data}
            columns={studentColumns}
            isLoading={studentsLoading}
            onCreate={() => setModalOpen(true)}
            createLabel="Onboard Student"
          />
        </div>

        <CreateStudentModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
      </div>
    </DashboardShell>
  );
}
