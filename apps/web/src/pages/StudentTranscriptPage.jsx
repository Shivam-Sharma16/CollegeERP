import { useState } from 'react';
import { DashboardShell } from '../components/DashboardShell';
import { useGetOwnTranscriptQuery } from '../api/resultsApi';
import { Book, ChevronDown, ChevronUp } from 'lucide-react';
import { PageTransition } from '../components/ui/PageTransition';
import { StaggerList, StaggerItem } from '../components/ui/StaggerList';
import { FadeIn } from '../components/ui/FadeIn';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import styles from './StudentTranscriptPage.module.css';

export default function StudentTranscriptPage() {
  const { data: transcriptRes, isLoading, error } = useGetOwnTranscriptQuery();
  const transcriptData = transcriptRes?.data;
  
  const subjects = transcriptData?.subjects || [];

  return (
    <DashboardShell
      title="My Transcript"
      subtitle="Detailed breakdown of your academic performance"
      icon="📄"
    >
      <PageTransition>
        <div className={styles.container}>
          <FadeIn
            show={!isLoading}
            skeleton={
              <>
                <Skeleton height="80px" style={{ marginBottom: '12px', borderRadius: '12px' }} />
                <Skeleton height="80px" style={{ marginBottom: '8px', borderRadius: '12px' }} />
                <Skeleton height="80px" style={{ marginBottom: '8px', borderRadius: '12px' }} />
                <Skeleton height="80px" style={{ borderRadius: '12px' }} />
              </>
            }
          >
            {error ? (
              <div className={styles.error}>Failed to load transcript. Please try again later.</div>
            ) : subjects.length === 0 ? (
              <EmptyState
                icon="document"
                title="No grades yet"
                description="No grades have been recorded for this semester yet."
              />
            ) : (
              <div className={styles.subjectList}>
                <div className={styles.summaryHeader}>
                  <div className={styles.gpaBadge}>
                    <span className={styles.gpaLabel}>Overall GPA</span>
                    <span className={styles.gpaValue}>{transcriptData.gpa.toFixed(2)}</span>
                  </div>
                  <div className={styles.creditsBadge}>
                    <span className={styles.creditsLabel}>Total Credits</span>
                    <span className={styles.creditsValue}>{transcriptData.totalCredits}</span>
                  </div>
                </div>

                <StaggerList>
                  {subjects.map((subject) => (
                    <StaggerItem key={subject.subjectId}>
                      <SubjectCard subject={subject} />
                    </StaggerItem>
                  ))}
                </StaggerList>
              </div>
            )}
          </FadeIn>
        </div>
      </PageTransition>
    </DashboardShell>
  );
}

function SubjectCard({ subject }) {
  const [expanded, setExpanded] = useState(false);

  // Filter out components that have 0 weightage or weren't graded yet.
  const breakdown = subject.breakdown || [];
  
  // Create color palette for the stacked bar
  const colors = ['var(--primary-500)', 'var(--warning-500)', 'var(--success-500)', 'var(--info-500)'];

  return (
    <div className={styles.subjectCard}>
      <div 
        className={styles.cardHeader} 
        onClick={() => setExpanded(!expanded)}
      >
        <div className={styles.subjectInfo}>
          <div className={styles.iconWrapper}>
            <Book size={20} className={styles.subjectIcon} />
          </div>
          <div>
            <h3 className={styles.subjectName}>{subject.subjectName}</h3>
            <p className={styles.subjectCode}>{subject.subjectCode} • {subject.credits} Credits</p>
          </div>
        </div>
        <div className={styles.gradeInfo}>
          <div className={styles.gradeValues}>
            <span className={styles.gradePercent}>{subject.gradePercent.toFixed(2)}%</span>
            <span className={styles.letterGrade}>{subject.letterGrade}</span>
          </div>
          <button className={styles.expandBtn} aria-label={expanded ? "Collapse" : "Expand"}>
            {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className={styles.cardExpanded}>
          <h4 className={styles.breakdownTitle}>Component Breakdown</h4>
          
          {breakdown.length === 0 ? (
            <p className={styles.noBreakdown}>No detailed breakdown available.</p>
          ) : (
            <>
              {/* Stacked Bar */}
              <div className={styles.stackedBarContainer}>
                {breakdown.map((item, index) => {
                  const percentage = item.weightedScore * 100;
                  if (percentage <= 0) return null;
                  
                  return (
                    <div 
                      key={index} 
                      className={styles.stackedSegment}
                      style={{ 
                        width: `${percentage}%`,
                        backgroundColor: colors[index % colors.length]
                      }}
                      title={`${item.examTypeName}: ${percentage.toFixed(2)}%`}
                    />
                  );
                })}
              </div>
              
              {/* Detailed List */}
              <div className={styles.breakdownList}>
                {breakdown.map((item, index) => (
                  <div key={index} className={styles.breakdownItem}>
                    <div className={styles.breakdownInfo}>
                      <span 
                        className={styles.legendDot} 
                        style={{ backgroundColor: colors[index % colors.length] }} 
                      />
                      <span className={styles.examName}>{item.examTypeName}</span>
                      <span className={styles.examWeight}>(Weight: {item.weightage * 100}%)</span>
                    </div>
                    <div className={styles.examScore}>
                      <span className={styles.marksObtained}>
                        {item.marksObtained} / {item.maxMarks}
                      </span>
                      <span className={styles.weightedContribution}>
                        +{(item.weightedScore * 100).toFixed(2)}%
                      </span>
                    </div>
                  </div>
                ))}
                
                <div className={styles.breakdownTotal}>
                  <span>Total Contribution</span>
                  <span className={styles.totalValue}>{subject.gradePercent.toFixed(2)}%</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
