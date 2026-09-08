import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { DashboardShell } from '../components/DashboardShell';
import { useGetFacultyLoadQuery } from '../api/teachingApi';
import { useGetGradeDistributionQuery } from '../api/resultsApi';
import { useGetSubjectTrendQuery } from '../api/attendanceApi';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { BarChart2, TrendingUp, AlertCircle } from 'lucide-react';
import styles from './FacultySubjectAnalyticsPage.module.css';

export default function FacultySubjectAnalyticsPage() {
  const { user } = useAuth();
  
  // 1. Get faculty load to populate dropdowns
  const { data: loadData } = useGetFacultyLoadQuery(user?._id, { skip: !user?._id });
  const facultyLoad = loadData?.data || { subjects: [], sections: [] };

  const [subjectId, setSubjectId] = useState('');
  const [sectionId, setSectionId] = useState(''); // "" implies all sections combined

  // 2. Fetch Analytics Data natively bounded to subjectId/sectionId
  const { data: gradeDataObj, isFetching: isLoadingGrades } = useGetGradeDistributionQuery(
    { subjectId, sectionId }, 
    { skip: !subjectId }
  );
  
  const { data: trendDataObj, isFetching: isLoadingTrend } = useGetSubjectTrendQuery(
    { subjectId, sectionId }, 
    { skip: !subjectId }
  );

  const gradeData = gradeDataObj?.data || [];
  const trendData = trendDataObj?.data || [];

  return (
    <DashboardShell title="Subject Analytics" subtitle="Performance & Attendance Trends" icon="📊">
      <div className={styles.container}>
        
        {/* Filter Controls */}
        <div className={styles.filterCard}>
          <div className={styles.field}>
            <label>Subject</label>
            <select value={subjectId} onChange={e => setSubjectId(e.target.value)}>
              <option value="">-- Select Subject --</option>
              {facultyLoad.subjects.map(s => (
                <option key={s._id || s} value={s._id || s}>
                  {s.name || s.code || `Subject ${s}`}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label>Section Filter</label>
            <select value={sectionId} onChange={e => setSectionId(e.target.value)}>
              <option value="">All My Sections Combined</option>
              {facultyLoad.sections.map(s => (
                <option key={s._id || s} value={s._id || s}>
                  {s.name || `Section ${s}`}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Charts Panel */}
        {!subjectId ? (
          <div className={styles.emptyState}>
            <BarChart2 size={48} className={styles.emptyIcon} />
            <h2>Select a Subject</h2>
            <p>Please select a subject from the dropdown above to view its analytics.</p>
          </div>
        ) : (
          <div className={styles.chartsGrid}>
            
            {/* Grade Distribution */}
            <div className={styles.chartCard}>
              <div className={styles.chartHeader}>
                <h3><BarChart2 size={20} /> Grade Distribution</h3>
                {(isLoadingGrades) && <span className={styles.loadingSpinner}>Updating...</span>}
              </div>
              
              <div className={styles.chartBody}>
                {gradeData.length === 0 && !isLoadingGrades ? (
                  <div className={styles.noData}>
                    <AlertCircle size={24} />
                    <p>No grade data available for this selection.</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={gradeData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                      <XAxis dataKey="grade" tick={{ fill: 'var(--text-2)' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: 'var(--text-2)' }} axisLine={false} tickLine={false} />
                      <Tooltip 
                        cursor={{ fill: 'var(--surface-2)' }} 
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-md)', background: 'var(--surface-1)' }}
                      />
                      <Bar dataKey="studentCount" name="Students" fill="var(--primary-500)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Attendance Trend */}
            <div className={styles.chartCard}>
              <div className={styles.chartHeader}>
                <h3><TrendingUp size={20} /> Attendance Trend</h3>
                {(isLoadingTrend) && <span className={styles.loadingSpinner}>Updating...</span>}
              </div>
              
              <div className={styles.chartBody}>
                {trendData.length === 0 && !isLoadingTrend ? (
                  <div className={styles.noData}>
                    <AlertCircle size={24} />
                    <p>No attendance data available for this selection.</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={trendData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                      <XAxis dataKey="date" tick={{ fill: 'var(--text-2)' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: 'var(--text-2)' }} axisLine={false} tickLine={false} domain={[0, 100]} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-md)', background: 'var(--surface-1)' }}
                      />
                      <Legend verticalAlign="top" height={36} />
                      <Line type="monotone" dataKey="attendancePercentage" name="Avg Attendance %" stroke="var(--success-500)" strokeWidth={3} dot={{ r: 4, fill: 'var(--success-500)' }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

          </div>
        )}

      </div>
    </DashboardShell>
  );
}
