import { useState, useEffect } from 'react';
import { DashboardShell } from '../components/DashboardShell';
import { useGetOwnFeeStructureQuery, useInitiatePaymentMutation, feesApi } from '../api/feesApi';
import { CreditCard, CheckCircle, Clock, AlertTriangle, Download, DollarSign } from 'lucide-react';
import { PageTransition } from '../components/ui/PageTransition';
import { StaggerList, StaggerItem } from '../components/ui/StaggerList';
import { FadeIn } from '../components/ui/FadeIn';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import styles from './StudentFeesPage.module.css';
import { useToast } from '../components/ui/ToastContext';

export default function StudentFeesPage() {
  const [isPaying, setIsPaying] = useState(false);
  const { data: feeData, isLoading, error, refetch } = useGetOwnFeeStructureQuery(undefined, {
    pollingInterval: isPaying ? 1000 : 0,
  });
  
  const [initiatePayment] = useInitiatePaymentMutation();
  const [getReceipt] = feesApi.useLazyGetReceiptQuery();
  const toast = useToast();

  const data = feeData?.data;
  const installments = data?.installments || [];

  // Stop polling when no installments are pending in our local tracking of the one we just paid
  // A robust way: we can just check if any status changed, but simplified: 
  // we set isPaying to the specific installment index.
  const [payingIndex, setPayingIndex] = useState(null);

  useEffect(() => {
    if (payingIndex !== null) {
      const targetInst = installments.find(i => i.index === payingIndex);
      if (targetInst && targetInst.status === 'paid') {
        setIsPaying(false);
        setPayingIndex(null);
        toast.success('Payment successful!');
      }
    }
  }, [installments, payingIndex, toast]);

  const handlePayNow = async (installment) => {
    try {
      setIsPaying(true);
      setPayingIndex(installment.index);
      
      const res = await initiatePayment({
        feeStructureId: data.feeStructureId,
        installmentIndex: installment.index,
        amount: installment.amount
      }).unwrap();
      
      toast.info('Redirecting to secure gateway...');
      // In a real app, we would redirect to res.data.redirectUrl
      // Here we wait for the webhook to update the status in the background
    } catch (err) {
      toast.error(err.data?.message || 'Failed to initiate payment');
      setIsPaying(false);
      setPayingIndex(null);
    }
  };

  const handleDownloadReceipt = async (paymentId) => {
    if (!paymentId) return;
    try {
      toast.info('Downloading receipt...');
      const response = await getReceipt(paymentId).unwrap();
      
      // Create a blob URL and download
      const url = window.URL.createObjectURL(new Blob([response]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `receipt-${paymentId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (err) {
      toast.error('Failed to download receipt');
    }
  };

  return (
    <DashboardShell title="Fee Payments" subtitle="Manage and track your tuition fees" icon="💰">
      <PageTransition>
        <div className={styles.container}>
          <FadeIn
            show={!isLoading || isPaying}
            skeleton={
              <>
                <Skeleton height="80px" style={{ marginBottom: '16px', borderRadius: '12px' }} />
                <Skeleton height="100px" style={{ marginBottom: '8px', borderRadius: '12px' }} />
                <Skeleton height="100px" style={{ marginBottom: '8px', borderRadius: '12px' }} />
                <Skeleton height="100px" style={{ borderRadius: '12px' }} />
              </>
            }
          >
            {error ? (
              <div className={styles.error}>Failed to load fees. Please try again later.</div>
            ) : installments.length === 0 ? (
              <EmptyState
                icon="document"
                title="No fee structure yet"
                description="No fee structure has been assigned to your account yet."
              />
            ) : (
              <>
                <div className={styles.summaryCard}>
                  <div className={styles.summaryItem}>
                    <span className={styles.summaryLabel}>Total Fees</span>
                    <span className={styles.summaryValue}>${data.totalAmount.toLocaleString()}</span>
                  </div>
                  <div className={styles.summaryItem}>
                    <span className={styles.summaryLabel}>Pending Amount</span>
                    <span className={`${styles.summaryValue} ${data.pendingAmount > 0 ? styles.textWarning : styles.textSuccess}`}>
                      ${data.pendingAmount.toLocaleString()}
                    </span>
                  </div>
                </div>

                <h3 className={styles.sectionTitle}>Installments</h3>
                <StaggerList className={styles.installmentList}>
                  {installments.map((inst) => (
                    <StaggerItem key={inst.index}>
                      <div className={styles.installmentCard}>
                        <div className={styles.instHeader}>
                          <div className={styles.instInfo}>
                            <DollarSign size={20} className={styles.instIcon} />
                            <div>
                              <h4 className={styles.instTitle}>Installment {inst.index + 1}</h4>
                              <p className={styles.instDate}>
                                Due: {new Date(inst.dueDate).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className={styles.instAmount}>${inst.amount.toLocaleString()}</div>
                        </div>

                        <div className={styles.instFooter}>
                          <StatusBadge status={inst.status} />
                          <div className={styles.actions}>
                            {inst.status === 'paid' ? (
                              <button
                                className={styles.btnSecondary}
                                onClick={() => handleDownloadReceipt(inst.paymentId)}
                              >
                                <Download size={16} /> Receipt
                              </button>
                            ) : (
                              <button
                                className={styles.btnPrimary}
                                onClick={() => handlePayNow(inst)}
                                disabled={isPaying}
                              >
                                <CreditCard size={16} /> Pay Now
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </StaggerItem>
                  ))}
                </StaggerList>
              </>
            )}
          </FadeIn>

          {isPaying && (
            <div className={styles.overlay}>
              <div className={styles.overlayContent}>
                <div className={styles.spinner}></div>
                <h3>Processing Payment</h3>
                <p>Please do not refresh or close this page.</p>
                <p className={styles.subtext}>Waiting for secure gateway confirmation...</p>
              </div>
            </div>
          )}
        </div>
      </PageTransition>
    </DashboardShell>
  );
}

function StatusBadge({ status }) {
  switch (status) {
    case 'paid':
      return (
        <span className={`${styles.badge} ${styles.badgeSuccess}`}>
          <CheckCircle size={14} /> Paid
        </span>
      );
    case 'overdue':
      return (
        <span className={`${styles.badge} ${styles.badgeDanger}`}>
          <AlertTriangle size={14} /> Overdue
        </span>
      );
    default:
      return (
        <span className={`${styles.badge} ${styles.badgeWarning}`}>
          <Clock size={14} /> Pending
        </span>
      );
  }
}
