import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useListFlaggedRecordsQuery, useResolveDisputeMutation } from '../../../api/attendanceApi';
import { useGetMySectionQuery } from '../../../api/academicApi';
import { Button } from '../../ui/Button';
import { useToast } from '../../ui/ToastContext';
import { Inbox, CheckCircle, XCircle } from 'lucide-react';
import styles from './CcDisputesTab.module.css';

export function CcDisputesTab() {
  const { data: sectionData } = useGetMySectionQuery();
  const sectionId = sectionData?.data?._id;

  const { data: flaggedData, isLoading } = useListFlaggedRecordsQuery(sectionId, { skip: !sectionId });
  const records = flaggedData?.data || [];

  const [resolveDispute, { isLoading: isResolving }] = useResolveDisputeMutation();
  const { showToast } = useToast();

  const handleResolve = async (recordId, resolution) => {
    try {
      await resolveDispute({ recordId, resolution }).unwrap();
      showToast(`Dispute ${resolution === 'approve' ? 'approved' : 'rejected'} successfully`, 'success');
    } catch (err) {
      showToast(err?.data?.message || 'Failed to resolve dispute', 'error');
    }
  };

  if (isLoading) {
    return <div className={styles.loading}>Loading disputes...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>Pending Attendance Disputes</h3>
        <p>Review flagged records and approve or reject them to update the student's attendance.</p>
      </div>

      <div className={styles.list}>
        <AnimatePresence>
          {records.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={styles.emptyState}
            >
              <Inbox size={48} className={styles.emptyIcon} />
              <p>No pending disputes</p>
            </motion.div>
          ) : (
            records.map((record) => (
              <motion.div
                key={record._id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -50, height: 0, margin: 0, padding: 0 }}
                transition={{ duration: 0.3 }}
                className={styles.card}
              >
                <div className={styles.cardInfo}>
                  <div className={styles.studentInfo}>
                    <h4>{record.student?.name || 'Unknown Student'}</h4>
                    <span className={styles.rollNumber}>{record.student?.rollNumber || 'No Roll #'}</span>
                  </div>
                  <div className={styles.sessionDetails}>
                    <strong>Session:</strong> {record.session?.topic || 'Untitled'} 
                    <span className={styles.date}>
                      {new Date(record.session?.date).toLocaleDateString()}
                    </span>
                  </div>
                  <div className={styles.flagReason}>
                    <strong>Reason:</strong> {record.flagReason || 'No reason provided'}
                  </div>
                </div>
                
                <div className={styles.actions}>
                  <Button 
                    variant="ghost" 
                    onClick={() => handleResolve(record._id, 'reject')}
                    disabled={isResolving}
                    className={styles.rejectBtn}
                  >
                    <XCircle size={18} />
                    Reject
                  </Button>
                  <Button 
                    variant="primary" 
                    onClick={() => handleResolve(record._id, 'approve')}
                    disabled={isResolving}
                    className={styles.approveBtn}
                  >
                    <CheckCircle size={18} />
                    Approve
                  </Button>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
