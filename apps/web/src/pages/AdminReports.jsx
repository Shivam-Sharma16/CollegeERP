import { useState, useMemo } from 'react';
import { DashboardShell } from '../components/DashboardShell';
import { FilterBar } from '../components/reports/FilterBar';
import { ChartCard } from '../components/reports/ChartCard';
import { AttendanceTrendChart } from '../components/reports/AttendanceTrendChart';
import { StudentFacultyCountChart } from '../components/reports/StudentFacultyCountChart';
import { AcademicPerformanceChart } from '../components/reports/AcademicPerformanceChart';
import { FacultyWorkloadChart } from '../components/reports/FacultyWorkloadChart';
import { PageTransition } from '../components/ui/PageTransition';
import { StaggerList, StaggerItem } from '../components/ui/StaggerList';
import { useListDepartmentsQuery } from '../api/departmentsApi';
import {
  useGetOverviewQuery,
  useGetAttendanceTrendQuery,
  useGetAcademicPerformanceQuery,
  useGetFacultyWorkloadQuery,
} from '../api/reportsApi';
import { Users, GraduationCap, Building2, Briefcase } from 'lucide-react';
import styles from './AdminReports.module.css';

export default function AdminReports() {
  const [filters, setFilters] = useState({
    departmentId: 'all',
    startDate: '',
    endDate: ''
  });

  const { data: deptData, isLoading: isLoadingDepts } = useListDepartmentsQuery();
  const departments = deptData?.data || [];

  // Query parameter derived from departmentId filter.
  // Passing this to all 4 queries ensures that switching the department filter
  // refetches all 4 analytics cards simultaneously and synchronously.
  const queryParam = useMemo(() => ({
    departmentId: filters.departmentId === 'all' ? undefined : filters.departmentId,
  }), [filters.departmentId]);

  // 1. Student / Faculty counts overview
  const {
    data: overviewData,
    isFetching: isOverviewFetching,
    isError: isOverviewError,
  } = useGetOverviewQuery(queryParam);

  // 2. Attendance trend time-series
  const {
    data: attendanceData,
    isFetching: isAttFetching,
    isError: isAttError,
  } = useGetAttendanceTrendQuery(queryParam);

  // 3. Academic performance & passing rates
  const {
    data: academicData,
    isFetching: isAcademicFetching,
    isError: isAcademicError,
  } = useGetAcademicPerformanceQuery(queryParam);

  // 4. Faculty workload & overload distribution
  const {
    data: workloadData,
    isFetching: isWorkloadFetching,
    isError: isWorkloadError,
  } = useGetFacultyWorkloadQuery(queryParam);

  // Data unwrapping
  const overview = overviewData?.data || overviewData || {};
  const overviewDepartments = overview.departments || [];
  const attList = attendanceData?.data?.trend || attendanceData?.trend || (Array.isArray(attendanceData?.data) ? attendanceData.data : []);
  const academicList = academicData?.data?.trend || academicData?.trend || (Array.isArray(academicData?.data) ? academicData.data : []);
  const workloadList = workloadData?.data?.facultyWorkload || workloadData?.facultyWorkload || (Array.isArray(workloadData?.data) ? workloadData.data : []);

  // Summary stats computation
  const totalStudents = useMemo(() => {
    if (filters.departmentId !== 'all') {
      const d = overviewDepartments.find(dep => (dep.departmentId?._id || dep.departmentId) === filters.departmentId);
      return d ? d.totalStudents : 0;
    }
    return overview.overall?.totalStudents ?? overviewDepartments.reduce((acc, d) => acc + (d.totalStudents || 0), 0);
  }, [filters.departmentId, overviewDepartments, overview]);

  const totalFaculty = useMemo(() => {
    if (filters.departmentId !== 'all') {
      const d = overviewDepartments.find(dep => (dep.departmentId?._id || dep.departmentId) === filters.departmentId);
      return d ? d.totalFaculty : 0;
    }
    return overview.overall?.totalFaculty ?? overviewDepartments.reduce((acc, d) => acc + (d.totalFaculty || 0), 0);
  }, [filters.departmentId, overviewDepartments, overview]);

  return (
    <DashboardShell title="Reports & Analytics" subtitle="Institution-wide metrics & performance insights" icon="BarChart">
      <PageTransition>
        <div className={styles.container}>
          {/* Department Filter Bar */}
          <FilterBar
            filters={filters}
            onFilterChange={setFilters}
            departments={departments}
            isLoadingDepartments={isLoadingDepts}
          />

          {/* Quick Metrics Strip */}
          <div className={styles.overviewStats}>
            <div className={styles.statCard}>
              <div className={styles.statIcon}>
                <GraduationCap size={20} />
              </div>
              <div className={styles.statContent}>
                <span className={styles.statValue}>{totalStudents}</span>
                <span className={styles.statLabel}>Enrolled Students</span>
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ background: 'rgba(34, 211, 238, 0.12)', color: 'var(--color-secondary)' }}>
                <Users size={20} />
              </div>
              <div className={styles.statContent}>
                <span className={styles.statValue}>{totalFaculty}</span>
                <span className={styles.statLabel}>Academic Faculty</span>
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ background: 'rgba(168, 85, 247, 0.12)', color: '#c084fc' }}>
                <Building2 size={20} />
              </div>
              <div className={styles.statContent}>
                <span className={styles.statValue}>
                  {filters.departmentId !== 'all' ? 1 : (overview.overall?.totalDepartments || departments.length)}
                </span>
                <span className={styles.statLabel}>Departments Scoped</span>
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#fbbf24' }}>
                <Briefcase size={20} />
              </div>
              <div className={styles.statContent}>
                <span className={styles.statValue}>{workloadList.length}</span>
                <span className={styles.statLabel}>Active Teaching Staff</span>
              </div>
            </div>
          </div>

          {/* 4 Analytics Cards Grid (Phase 36 report-builder pattern) */}
          <StaggerList className={styles.chartsGrid}>
            {/* Card 1: Student / Faculty Counts */}
            <StaggerItem>
              <ChartCard
                title="Student / Faculty Counts"
                isLoading={isOverviewFetching}
                isError={isOverviewError}
                isEmpty={!isOverviewFetching && !isOverviewError && overviewDepartments.length === 0}
              >
                <StudentFacultyCountChart data={overview} />
              </ChartCard>
            </StaggerItem>

            {/* Card 2: Attendance Trend */}
            <StaggerItem>
              <ChartCard
                title="Attendance Trend"
                isLoading={isAttFetching}
                isError={isAttError}
                isEmpty={!isAttFetching && !isAttError && attList.length === 0}
              >
                <AttendanceTrendChart data={attList} />
              </ChartCard>
            </StaggerItem>

            {/* Card 3: Academic Performance */}
            <StaggerItem>
              <ChartCard
                title="Academic Performance"
                isLoading={isAcademicFetching}
                isError={isAcademicError}
                isEmpty={!isAcademicFetching && !isAcademicError && academicList.length === 0}
              >
                <AcademicPerformanceChart data={academicList} />
              </ChartCard>
            </StaggerItem>

            {/* Card 4: Faculty Workload */}
            <StaggerItem>
              <ChartCard
                title="Faculty Workload"
                isLoading={isWorkloadFetching}
                isError={isWorkloadError}
                isEmpty={!isWorkloadFetching && !isWorkloadError && workloadList.length === 0}
              >
                <FacultyWorkloadChart data={workloadList} />
              </ChartCard>
            </StaggerItem>
          </StaggerList>
        </div>
      </PageTransition>
    </DashboardShell>
  );
}
