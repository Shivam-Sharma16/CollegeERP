import { useAuth } from '../hooks/useAuth';
import { DashboardShell } from '../components/DashboardShell';
import { SessionCard } from '../components/faculty/SessionCard';
import { StatCard } from '../components/ui/StatCard';
import { StaggerList, StaggerItem } from '../components/ui/StaggerList';
import { FadeIn } from '../components/ui/FadeIn';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { useGetTodaysSessionsQuery } from '../api/attendanceApi';
import { useGetFacultyLoadQuery } from '../api/teachingApi';
import { useGetSubjectPerformanceQuery } from '../api/resultsApi';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { PageTransition } from '../components/ui/PageTransition';
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
      <PageTransition>
      <div className={styles.dashboard}>
        {/* Load Overview */}
        <StaggerList className={styles.statsGrid}>
          <StaggerItem>
            <StatCard 
              title="Subjects Taught" 
              value={load.subjects?.length || 0} 
              icon="BookOpen" 
              isLoading={isLoadingLoad} 
            />
          </StaggerItem>
          <StaggerItem>
            <StatCard 
              title="Weekly Sessions" 
              value={load.sessions || 0} 
              icon="Calendar" 
              isLoading={isLoadingLoad} 
            />
          </StaggerItem>
          <StaggerItem>
            <StatCard 
              title="Today's Classes" 
              value={sessions.length || 0} 
              icon="Clock" 
              isLoading={isLoadingSessions} 
            />
          </StaggerItem>
        </StaggerList>

        {/* Today's Classes Scrollable Row */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Today's Classes</h3>
          <FadeIn
            show={!isLoadingSessions}
            skeleton={<div className={styles.loading}><Skeleton height="120px" /></div>}
          >
            {sessions.length === 0 ? (
              <EmptyState
                icon="inbox"
                title="No classes today"
                description="No classes scheduled for today. Enjoy your day!"
              />
            ) : (
              <StaggerList className={styles.horizontalScroll}>
                {sessions.map(session => (
                  <StaggerItem key={session._id}>
                    <SessionCard 
                      session={session} 
                      onStart={handleStartSession} 
                    />
                  </StaggerItem>
                ))}
              </StaggerList>
            )}
          </FadeIn>
        </section>

        {/* Subject-wise Performance */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Subject Performance Summary</h3>
          <div className={styles.chartCard}>
            <FadeIn
              show={!isLoadingPerf}
              skeleton={<Skeleton height="300px" />}
            >
              {performance.length === 0 ? (
                <EmptyState
                  icon="chart"
                  title="No performance data yet"
                  description="Performance data will appear once marks are entered."
                />
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
            </FadeIn>
          </div>
        </section>

      </div>
      </PageTransition>
    </DashboardShell>
  );
}
