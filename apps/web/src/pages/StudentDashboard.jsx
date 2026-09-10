import { useNavigate } from 'react-router-dom';
import { DashboardShell } from '../components/DashboardShell';
import { StatCard } from '../components/ui/StatCard';
import { StaggerList, StaggerItem } from '../components/ui/StaggerList';
import { FadeIn } from '../components/ui/FadeIn';
import { Skeleton } from '../components/ui/Skeleton';
import { useGetOwnAttendanceSummaryQuery } from '../api/attendanceApi';
import { useGetOwnGpaQuery } from '../api/resultsApi';
import { useGetOwnFeeStatusQuery } from '../api/feesApi';
import { useGetUnreadCountQuery } from '../api/notificationApi';
import { CheckCircle, AlertTriangle, XCircle, FileText, Bell, CreditCard, Award, QrCode } from 'lucide-react';
import { PageTransition } from '../components/ui/PageTransition';
import styles from './StudentDashboard.module.css';

export default function StudentDashboard() {
  const navigate = useNavigate();
  const { data: attData, isLoading: isLoadingAtt } = useGetOwnAttendanceSummaryQuery();
  const { data: gpaData, isLoading: isLoadingGpa } = useGetOwnGpaQuery();
  const { data: feeData, isLoading: isLoadingFee } = useGetOwnFeeStatusQuery();
  const { data: notifData, isLoading: isLoadingNotif } = useGetUnreadCountQuery();

  const attendancePercentage = attData?.data?.overallPercentage ?? 0;
  const gpa = gpaData?.data?.gpa ?? 0;
  const pendingFees = feeData?.data?.pendingAmount ?? 0;
  const unreadCount = notifData?.data?.count ?? 0;

  // Evaluate Attendance Color Thresholds:
  // Red < 75%, Amber 75 - 84%, Green >= 85%
  let attColor = 'var(--success-500)';
  let AttIcon = CheckCircle;
  let attStatus = 'Good standing';

  if (attendancePercentage < 75) {
    attColor = 'var(--danger-500)';
    AttIcon = XCircle;
    attStatus = 'Critical shortage';
  } else if (attendancePercentage < 85) {
    attColor = 'var(--warning-500)';
    AttIcon = AlertTriangle;
    attStatus = 'Needs attention';
  }

  return (
    <DashboardShell
      title="Student Portal"
      subtitle="Your academic overview"
      icon="🎓"
    >
      <PageTransition>
      <div className={styles.container}>
        
        <StaggerList className={styles.statsGrid}>
          {/* Attendance Card */}
          <StaggerItem>
          <div
            className={`${styles.statCard} ${styles.attendanceCard}`}
            style={{ '--att-color': attColor, cursor: 'pointer' }}
            onClick={() => navigate('/attendance')}
            title="Click to open QR Attendance Scanner"
          >
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>Overall Attendance</span>
              <AttIcon size={20} color={attColor} />
            </div>
            <FadeIn
              show={!isLoadingAtt}
              skeleton={<Skeleton height="36px" style={{ marginTop: '8px' }} />}
            >
              <>
                <div className={styles.cardValue} style={{ color: attColor }}>
                  {attendancePercentage.toFixed(1)}%
                </div>
                <div className={styles.cardFooter} style={{ color: attColor, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{attStatus}</span>
                  <span style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', opacity: 0.9 }}>
                    <QrCode size={14} /> Scan QR &rarr;
                  </span>
                </div>
              </>
            </FadeIn>
          </div>
          </StaggerItem>

          {/* Current GPA Card */}
          <StaggerItem>
          <div 
            className={`${styles.statCard} ${styles.attendanceCard}`}
            style={{ cursor: 'pointer' }}
            onClick={() => navigate('/student/transcript')}
            title="Click to view detailed transcript"
          >
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>Current GPA</span>
              <Award size={20} className={styles.iconPrimary} />
            </div>
            <FadeIn
              show={!isLoadingGpa}
              skeleton={<Skeleton height="36px" style={{ marginTop: '8px' }} />}
            >
              <>
                <div className={styles.cardValue}>
                  {gpa.toFixed(2)}
                </div>
                <div className={styles.cardFooter} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Out of 10.0</span>
                  <span style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', opacity: 0.9 }}>
                    <FileText size={14} /> View Transcript &rarr;
                  </span>
                </div>
              </>
            </FadeIn>
          </div>
          </StaggerItem>

          {/* Pending Fees Card */}
          <StaggerItem>
          <div 
            className={`${styles.statCard} ${styles.attendanceCard}`}
            style={{ cursor: 'pointer' }}
            onClick={() => navigate('/student/fees')}
            title="Click to view fee details and pay"
          >
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>Pending Fees</span>
              <CreditCard size={20} className={pendingFees > 0 ? styles.iconWarning : styles.iconSuccess} />
            </div>
            <FadeIn
              show={!isLoadingFee}
              skeleton={<Skeleton height="36px" style={{ marginTop: '8px' }} />}
            >
              <>
                <div className={styles.cardValue}>
                  ${pendingFees.toLocaleString()}
                </div>
                <div className={`${styles.cardFooter} ${pendingFees > 0 ? styles.textWarning : styles.textSuccess}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{pendingFees > 0 ? 'Payment due' : 'All clear'}</span>
                  <span style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', opacity: 0.9 }}>
                    <CreditCard size={14} /> View Fees &rarr;
                  </span>
                </div>
              </>
            </FadeIn>
          </div>
          </StaggerItem>

          {/* Unread Notices Card */}
          <StaggerItem>
          <div 
            className={`${styles.statCard} ${styles.attendanceCard}`}
            style={{ cursor: 'pointer' }}
            onClick={() => navigate('/student/notices')}
            title="Click to view all notices"
          >
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>Unread Notices</span>
              <Bell size={20} className={unreadCount > 0 ? styles.iconPrimary : styles.iconNeutral} />
            </div>
            <FadeIn
              show={!isLoadingNotif}
              skeleton={<Skeleton height="36px" style={{ marginTop: '8px' }} />}
            >
              <>
                <div className={styles.cardValue}>
                  {unreadCount}
                </div>
                <div className={styles.cardFooter} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{unreadCount === 1 ? 'New announcement' : 'New announcements'}</span>
                  <span style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', opacity: 0.9 }}>
                    <Bell size={14} /> View All &rarr;
                  </span>
                </div>
              </>
            </FadeIn>
          </div>
          </StaggerItem>
        </StaggerList>

      </div>
      </PageTransition>
    </DashboardShell>
  );
}
