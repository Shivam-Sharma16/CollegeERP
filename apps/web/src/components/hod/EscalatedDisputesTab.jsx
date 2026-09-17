import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  useListEscalatedDisputesQuery,
  useResolveEscalationMutation,
} from '../../api/attendanceApi';
import { Button } from '../ui/Button';
import { useToast } from '../ui/ToastContext';
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Layers,
  UserCheck,
  Calendar,
  BookOpen,
  CheckCircle,
} from 'lucide-react';
import styles from './EscalatedDisputesTab.module.css';

export function EscalatedDisputesTab() {
  const { data: disputes = [], isLoading } = useListEscalatedDisputesQuery({
    status: 'pending',
  });

  const [resolveEscalation, { isLoading: isResolving }] = useResolveEscalationMutation();
  const { showToast } = useToast();
  const [resolvingId, setResolvingId] = useState(null);

  const handleResolve = async (disputeId, decision) => {
    setResolvingId(disputeId);
    try {
      const isApproval = decision === 'approve';
      await resolveEscalation({
        disputeId,
        newStatus: isApproval ? 'present' : 'absent',
        resolution: isApproval
          ? 'Attendance confirmed and approved by Head of Department.'
          : 'Dispute rejected upon department review by Head of Department.',
      }).unwrap();

      showToast(
        `Dispute ${isApproval ? 'approved' : 'rejected'} successfully`,
        'success'
      );
    } catch (err) {
      showToast(
        err?.data?.message || err?.data?.error || 'Failed to resolve escalation',
        'error'
      );
    } finally {
      setResolvingId(null);
    }
  };

  if (isLoading) {
    return <div className={styles.loading}>Loading department escalated disputes…</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>
          <AlertTriangle size={20} color="#f59e0b" />
          <span>Escalated Attendance Disputes</span>
        </h3>
        <p>
          Department-wide attendance disputes requiring executive resolution from the Head of Department.
        </p>
      </div>

      <div className={styles.list}>
        <AnimatePresence mode="popLayout">
          {disputes.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={styles.emptyState}
            >
              <CheckCircle size={48} className={styles.emptyIcon} />
              <h4 style={{ margin: '0.25rem 0 0', color: 'var(--color-text)' }}>
                All Escalations Resolved
              </h4>
              <p style={{ margin: 0, fontSize: '0.85rem' }}>
                There are no pending escalated attendance disputes in your department.
              </p>
            </motion.div>
          ) : (
            disputes.map((record) => {
              const studentName =
                record.student?.name || record.studentName || 'Student';
              const rollNumber =
                record.student?.rollNumber || record.rollNumber || '—';
              const sectionName = record.sectionName || record.section?.name || 'Section';
              const escalatedBy =
                record.escalation?.escalatedByName ||
                record.escalation?.escalatedBy ||
                'Class Coordinator';
              const sessionDate =
                record.lectureSessionId?.date ||
                record.sessionDate ||
                record.createdAt;
              const sessionTopic =
                record.lectureSessionId?.topic || record.sessionTopic || 'Lecture Session';
              const subjectInfo =
                record.subjectCode || record.subjectName
                  ? `${record.subjectCode ? record.subjectCode + ' — ' : ''}${record.subjectName || ''}`
                  : null;

              const isItemResolving = resolvingId === record._id || isResolving;

              return (
                <motion.div
                  key={record._id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -60, height: 0, margin: 0, padding: 0 }}
                  transition={{ duration: 0.28, ease: 'easeInOut' }}
                  className={styles.card}
                >
                  <div className={styles.cardInfo}>
                    <div className={styles.titleRow}>
                      <h4 className={styles.studentName}>{studentName}</h4>
                      <span className={styles.rollNumber}>{rollNumber}</span>

                      {/* Explicit Section Label */}
                      <span className={styles.sectionBadge}>
                        <Layers size={13} />
                        <span>Section {sectionName}</span>
                      </span>

                      {/* Explicit Escalating CC Label */}
                      <span className={styles.ccBadge}>
                        <UserCheck size={13} />
                        <span>Escalated by CC: {escalatedBy}</span>
                      </span>
                    </div>

                    <div className={styles.metaRow}>
                      {subjectInfo && (
                        <span className={styles.metaItem}>
                          <BookOpen size={13} />
                          <span>{subjectInfo}</span>
                        </span>
                      )}
                      <span className={styles.metaItem}>
                        <strong>Topic:</strong> {sessionTopic}
                      </span>
                      {sessionDate && (
                        <span className={styles.metaItem}>
                          <Calendar size={13} />
                          <span>{new Date(sessionDate).toLocaleDateString()}</span>
                        </span>
                      )}
                    </div>

                    <div className={styles.reasonsContainer}>
                      <div className={styles.flagReason}>
                        <strong>Student Claim:</strong>{' '}
                        {record.reason || record.flagReason || 'Attendance flagged by student'}
                      </div>
                      <div className={styles.escalationReason}>
                        <strong>CC Escalation Note:</strong>{' '}
                        {record.escalation?.reason || 'Escalated to HOD for executive decision.'}
                      </div>
                    </div>
                  </div>

                  <div className={styles.actions}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleResolve(record._id, 'reject')}
                      disabled={isItemResolving}
                      className={styles.rejectBtn}
                    >
                      <XCircle size={16} />
                      <span>Reject</span>
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleResolve(record._id, 'approve')}
                      disabled={isItemResolving}
                      className={styles.approveBtn}
                    >
                      <CheckCircle2 size={16} />
                      <span>Approve</span>
                    </Button>
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
