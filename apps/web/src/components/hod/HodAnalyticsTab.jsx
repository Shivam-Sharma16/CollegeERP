import { useGetSubjectAveragesQuery } from '../../api/resultsApi';
import { useGetSectionComparisonQuery } from '../../api/attendanceApi';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import styles from './HodAnalyticsTab.module.css';

export function HodAnalyticsTab() {
  const { data: marksData, isLoading: isLoadingMarks } = useGetSubjectAveragesQuery();
  const { data: attendanceData, isLoading: isLoadingAttendance } = useGetSectionComparisonQuery();

  const chartAverages = marksData?.data || [];
  const chartAttendance = attendanceData?.data || [];

  return (
    <div className={styles.container}>
      <div className={styles.chartCard}>
        <h3 className={styles.chartTitle}>Subject-wise Average Marks</h3>
        <p className={styles.chartSubtitle}>Comparing overall average marks across all subjects in the department.</p>
        
        {isLoadingMarks ? (
          <div className={styles.skeleton}>Loading marks data...</div>
        ) : chartAverages.length === 0 ? (
          <div className={styles.empty}>No marks data available for this department.</div>
        ) : (
          <div className={styles.chartWrapper}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartAverages} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="subjectName" stroke="var(--color-text-muted)" fontSize={12} tickLine={false} />
                <YAxis stroke="var(--color-text-muted)" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                <Tooltip 
                  cursor={{ fill: 'color-mix(in srgb, var(--color-primary) 10%, transparent)' }}
                  contentStyle={{ borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}
                />
                <Bar dataKey="averageMarks" fill="var(--color-primary)" radius={[4, 4, 0, 0]} name="Avg Marks (%)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className={styles.chartCard}>
        <h3 className={styles.chartTitle}>Section-wise Attendance Comparison</h3>
        <p className={styles.chartSubtitle}>Comparing aggregate attendance percentages across sections.</p>
        
        {isLoadingAttendance ? (
          <div className={styles.skeleton}>Loading attendance data...</div>
        ) : chartAttendance.length === 0 ? (
          <div className={styles.empty}>No attendance data available for this department.</div>
        ) : (
          <div className={styles.chartWrapper}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartAttendance} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="sectionName" stroke="var(--color-text-muted)" fontSize={12} tickLine={false} />
                <YAxis stroke="var(--color-text-muted)" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                <Tooltip 
                  cursor={{ fill: 'color-mix(in srgb, var(--color-secondary) 10%, transparent)' }}
                  contentStyle={{ borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}
                />
                <Bar dataKey="attendancePercentage" fill="var(--color-secondary)" radius={[4, 4, 0, 0]} name="Attendance (%)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
