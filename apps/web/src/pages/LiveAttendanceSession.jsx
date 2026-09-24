import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { io } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { useGetQrTokenQuery, useCloseSessionMutation, useGetSessionQuery, useGetSessionRecordsQuery, useOverrideRecordMutation } from '../api/attendanceApi';
import { DashboardShell } from '../components/DashboardShell';
import { Button } from '../components/ui/Button';
import { PageTransition } from '../components/ui/PageTransition';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../components/ui/ToastContext';
import { Wifi, WifiOff, Users, StopCircle, CheckCircle, XCircle } from 'lucide-react';
import styles from './LiveAttendanceSession.module.css';

export default function LiveAttendanceSession() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [checkIns, setCheckIns] = useState([]);
  
  // 1. Fetch Session Info
  const { data: sessionData, isLoading: sessionLoading } = useGetSessionQuery(sessionId);
  const session = sessionData?.data;

  // 2. Poll QR Token (15s interval)
  // useGetQrTokenQuery has keepUnusedDataFor: 0, so it fetches fresh.
  const { data: qrData, refetch: refetchQr } = useGetQrTokenQuery(sessionId, {
    pollingInterval: 15000,
  });
  const qrToken = qrData?.data?.token || '';
  
  // 3. Socket Connection
  useEffect(() => {
    const socketUrl = import.meta.env.VITE_ATTENDANCE_SOCKET_URL || 'http://localhost:4004';
    const newSocket = io(socketUrl, {
      transports: ['websocket'],
      query: { sessionId }
    });

    newSocket.on('connect', () => setIsConnected(true));
    newSocket.on('disconnect', () => setIsConnected(false));
    
    newSocket.on('attendance:checked_in', (data) => {
      // Expecting { studentId, studentName, timestamp, rollNumber }
      setCheckIns(prev => [data, ...prev]);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [sessionId]);

  // Animation trigger for QR pulse on token refresh
  const [qrKey, setQrKey] = useState(0);
  useEffect(() => {
    if (qrToken) {
      setQrKey(prev => prev + 1);
    }
  }, [qrToken]);

  // 4. Close Session Mutation
  const [closeSession, { isLoading: isClosing }] = useCloseSessionMutation();
  const [sessionClosed, setSessionClosed] = useState(false);

  const handleCloseSession = async () => {
    try {
      await closeSession(sessionId).unwrap();
      showToast('Session closed successfully. Students can no longer check in.', 'success');
      setSessionClosed(true);
    } catch (err) {
      showToast(err?.data?.message || 'Failed to close session', 'error');
    }
  };

  const totalExpected = session?.section?.studentCount || 0;
  const checkedInCount = checkIns.length;

  if (sessionClosed) {
    return <PostCloseSummary sessionId={sessionId} onFinish={() => navigate('/faculty/dashboard')} />;
  }

  return (
    <DashboardShell title="Live Session" subtitle={session?.topic || 'Loading...'} icon="📡">
      <PageTransition>
        <div className={styles.container}>
        
        {/* Header Status */}
        <div className={styles.header}>
          <div className={`${styles.connectionStatus} ${isConnected ? styles.connected : styles.disconnected}`}>
            {isConnected ? (
              <><Wifi size={16} /> Connected to stream</>
            ) : (
              <><WifiOff size={16} /> Reconnecting...</>
            )}
          </div>
          
          <Button 
            variant="danger" 
            onClick={handleCloseSession} 
            disabled={isClosing}
          >
            <StopCircle size={18} />
            {isClosing ? 'Closing...' : 'Close Session'}
          </Button>
        </div>

        <div className={styles.mainContent}>
          {/* QR Code Panel */}
          <div className={styles.qrPanel}>
            <h3>Scan to Check In</h3>
            <p>Code refreshes automatically every 15 seconds</p>
            
            <div className={styles.qrWrapper}>
              {qrToken ? (
                <motion.div
                  key={qrKey}
                  initial={{ scale: 0.95, opacity: 0.8 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <QRCodeSVG 
                    value={JSON.stringify({ sessionId, token: qrToken })} 
                    size={256}
                    level="H"
                    includeMargin={true}
                  />
                </motion.div>
              ) : (
                <div className={styles.qrPlaceholder}>Generating QR...</div>
              )}
            </div>
            
            <div className={styles.counterBadge}>
              <Users size={18} />
              <span>Checked in: <strong>{checkedInCount}</strong> / {totalExpected || '?'}</span>
            </div>
          </div>

          {/* Live Check-ins List */}
          <div className={styles.feedPanel}>
            <h3>Live Feed</h3>
            
            <div className={styles.feedList}>
              <AnimatePresence>
                {checkIns.length === 0 ? (
                  <motion.p 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={styles.emptyState}
                  >
                    Waiting for students to scan...
                  </motion.p>
                ) : (
                  checkIns.map((record, index) => (
                    <motion.div
                      key={record.studentId || index}
                      initial={{ opacity: 0, y: -20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={styles.feedItem}
                    >
                      <div className={styles.feedInfo}>
                        <span className={styles.studentName}>{record.studentName || 'Student'}</span>
                        <span className={styles.rollNum}>{record.rollNumber || 'Unknown'}</span>
                      </div>
                      <span className={styles.time}>
                        {record.timestamp ? new Date(record.timestamp).toLocaleTimeString() : 'Just now'}
                      </span>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
      </PageTransition>
    </DashboardShell>
  );
}


function PostCloseSummary({ sessionId, onFinish }) {
  const { data: recordsData, isLoading } = useGetSessionRecordsQuery({ sessionId });
  const [overrideRecord, { isLoading: isOverriding }] = useOverrideRecordMutation();
  const { showToast } = useToast();

  const records = recordsData?.data || [];
  const flaggedRecords = records.filter(r => r.status === 'flagged');

  const handleResolve = async (recordId, newStatus) => {
    try {
      await overrideRecord({ recordId, status: newStatus, reason: 'Resolved post-session' }).unwrap();
      showToast(`Record marked as ${newStatus}`, 'success');
    } catch (err) {
      showToast(err?.data?.message || 'Failed to update record', 'error');
    }
  };

  return (
    <DashboardShell title="Session Summary" subtitle="Review & Resolve" icon="📋">
      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Session Closed</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--text-2)' }}>
              Total Records: {records.length} | Flagged: {flaggedRecords.length}
            </p>
          </div>
          <Button variant="primary" onClick={onFinish}>Return to Dashboard</Button>
        </div>

        {isLoading ? (
          <div className={styles.emptyState}>Loading records...</div>
        ) : flaggedRecords.length > 0 ? (
          <div className={styles.feedPanel} style={{ height: 'auto', maxHeight: '600px' }}>
            <h3>Flagged Records to Resolve</h3>
            <div className={styles.feedList}>
              <AnimatePresence>
                {flaggedRecords.map(record => (
                  <motion.div
                    key={record._id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -50, height: 0, margin: 0, padding: 0 }}
                    className={styles.feedItem}
                    style={{ borderLeftColor: 'var(--warning-500)', flexWrap: 'wrap', gap: 'var(--spacing-4)' }}
                  >
                    <div className={styles.feedInfo}>
                      <span className={styles.studentName}>{record.student?.name || 'Student'}</span>
                      <span className={styles.rollNum}>{record.student?.rollNumber || 'Unknown'}</span>
                      <span style={{ fontSize: '0.875rem', color: 'var(--warning-700)', marginTop: '4px' }}>
                        Reason: {record.flagReason || 'Location mismatch'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
                      <Button 
                        variant="ghost" 
                        onClick={() => handleResolve(record._id, 'absent')}
                        disabled={isOverriding}
                        style={{ color: 'var(--danger-600)' }}
                      >
                        <XCircle size={18} /> Mark Absent
                      </Button>
                      <Button 
                        variant="primary" 
                        onClick={() => handleResolve(record._id, 'present')}
                        disabled={isOverriding}
                        style={{ background: 'var(--success-500)', borderColor: 'var(--success-500)' }}
                      >
                        <CheckCircle size={18} /> Mark Present
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        ) : (
          <div className={styles.qrPanel} style={{ padding: 'var(--spacing-12)' }}>
            <CheckCircle size={48} color="var(--success-500)" style={{ marginBottom: '16px' }} />
            <h3>All Good!</h3>
            <p>There are no flagged records requiring your attention.</p>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
