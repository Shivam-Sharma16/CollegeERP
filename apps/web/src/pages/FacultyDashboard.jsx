import { useAuth } from '../hooks/useAuth';
import { DashboardShell } from '../components/DashboardShell';
import { SessionCard } from '../components/faculty/SessionCard';
import { StatCard } from '../components/ui/StatCard';
import { useGetTodaysSessionsQuery } from '../api/attendanceApi';
import { useGetFacultyLoadQuery } from '../api/teachingApi';
import { useGetSubjectPerformanceQuery } from '../api/resultsApi';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import styles from './FacultyDashboard.module.css';

export default function FacultyDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: loadData, isLoading: isLoadingLoad } = useGetFacultyLoadQuery(user?._id, { skip: !user?._id });
  const { data: sessionsData, isLoading: isLoadingSessions } = useGetTodaysSessionsQuery();
  const { data: performanceData, isLoading: isLoadingPerf } = useGetSubjectPerformanceQuery();

  const load = loadData?.data || { sessions: 0, subjects: [], sections: [] };
  const sessions = sessionsData?.data || [];
  const performance = performanceData?.data || [];

  const handleStartSession = (session) => {
    // Navigate to attendance taking page with the session id
    navigate(`/faculty/attendance/session/${session._id}`);
  };

  return (
    <DashboardShell
      title="Faculty Dashboard"
      subtitle="Teaching & assessment"
      icon="👨‍🏫"
    >
      <div className={styles.dashboard}>
        {/* Load Overview */}
        <div className={styles.statsGrid}>
          <StatCard 
            title="Subjects Taught" 
            value={load.subjects?.length || 0} 
            icon="BookOpen" 
            isLoading={isLoadingLoad} 
          />
          <StatCard 
            title="Weekly Sessions" 
            value={load.sessions || 0} 
            icon="Calendar" 
            isLoading={isLoadingLoad} 
          />
          <StatCard 
            title="Today's Classes" 
            value={sessions.length || 0} 
            icon="Clock" 
            isLoading={isLoadingSessions} 
          />
        </div>

        {/* Today's Classes Scrollable Row */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Today's Classes</h3>
          {isLoadingSessions ? (
            <div className={styles.loading}>Loading sessions...</div>
          ) : sessions.length === 0 ? (
            <div className={styles.emptyState}>No classes scheduled for today. Enjoy your day!</div>
          ) : (
            <div className={styles.horizontalScroll}>
              {sessions.map(session => (
                <SessionCard 
                  key={session._id} 
                  session={session} 
                  onStart={handleStartSession} 
                />
              ))}
            </div>
          )}
        </section>

        {/* Subject-wise Performance */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Subject Performance Summary</h3>
          <div className={styles.chartCard}>
            {isLoadingPerf ? (
              <div className={styles.loading}>Loading performance data...</div>
            ) : performance.length === 0 ? (
              <div className={styles.emptyState}>Not enough data to display performance summary.</div>
            ) : (
              <div className={styles.chartWrapper}>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={performance} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <XAxis dataKey="subjectName" tick={{ fill: 'var(--text-2)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'var(--text-2)' }} axisLine={false} tickLine={false} />
                    <Tooltip 
                      cursor={{ fill: 'var(--surface-2)' }} 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-md)' }}
                    />
                    <Bar dataKey="averageMarks" fill="var(--primary-500)" radius={[4, 4, 0, 0]} name="Avg Marks (%)" />
                    <Bar dataKey="highestMarks" fill="var(--success-400)" radius={[4, 4, 0, 0]} name="Highest Marks (%)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </section>

      </div>
    </DashboardShell>
  );
}
