import { useNavigate } from 'react-router-dom';
import { DashboardShell } from '../components/DashboardShell';
import { StatCard } from '../components/ui/StatCard';
import { useGetOwnAttendanceSummaryQuery } from '../api/attendanceApi';
import { useGetOwnGpaQuery } from '../api/resultsApi';
import { useGetOwnFeeStatusQuery } from '../api/feesApi';
import { useGetUnreadCountQuery } from '../api/notificationApi';
import { CheckCircle, AlertTriangle, XCircle, FileText, Bell, CreditCard, Award, QrCode } from 'lucide-react';
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
      <div className={styles.container}>
        
        <div className={styles.statsGrid}>
          {/* Attendance Card */}
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
            {isLoadingAtt ? (
              <div className={styles.loading}>Loading...</div>
            ) : (
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
            )}
          </div>

          {/* Current GPA Card */}
          <div className={styles.statCard}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>Current GPA</span>
              <Award size={20} className={styles.iconPrimary} />
            </div>
            {isLoadingGpa ? (
              <div className={styles.loading}>Loading...</div>
            ) : (
              <>
                <div className={styles.cardValue}>
                  {gpa.toFixed(2)}
                </div>
                <div className={styles.cardFooter}>
                  Out of 10.0
                </div>
              </>
            )}
          </div>

          {/* Pending Fees Card */}
          <div className={styles.statCard}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>Pending Fees</span>
              <CreditCard size={20} className={pendingFees > 0 ? styles.iconWarning : styles.iconSuccess} />
            </div>
            {isLoadingFee ? (
              <div className={styles.loading}>Loading...</div>
            ) : (
              <>
                <div className={styles.cardValue}>
                  ${pendingFees.toLocaleString()}
                </div>
                <div className={`${styles.cardFooter} ${pendingFees > 0 ? styles.textWarning : styles.textSuccess}`}>
                  {pendingFees > 0 ? 'Payment due' : 'All clear'}
                </div>
              </>
            )}
          </div>

          {/* Unread Notices Card */}
          <div className={styles.statCard}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>Unread Notices</span>
              <Bell size={20} className={unreadCount > 0 ? styles.iconPrimary : styles.iconNeutral} />
            </div>
            {isLoadingNotif ? (
              <div className={styles.loading}>Loading...</div>
            ) : (
              <>
                <div className={styles.cardValue}>
                  {unreadCount}
                </div>
                <div className={styles.cardFooter}>
                  {unreadCount > 0 ? 'New announcements' : 'Caught up'}
                </div>
              </>
            )}
          </div>
        </div>

      </div>
    </DashboardShell>
  );
}
