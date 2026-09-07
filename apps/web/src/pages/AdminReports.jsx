import { useState } from 'react';
import { DashboardShell } from '../components/DashboardShell';
import { FilterBar } from '../components/reports/FilterBar';
import { ChartCard } from '../components/reports/ChartCard';
import { AttendanceTrendChart } from '../components/reports/AttendanceTrendChart';
import { MarksDistributionChart } from '../components/reports/MarksDistributionChart';
import { FeeCollectionChart } from '../components/reports/FeeCollectionChart';
import { useListDepartmentsQuery } from '../api/departmentsApi';
import { useGetTrendQuery } from '../api/attendanceApi';
import { useGetDistributionQuery } from '../api/resultsApi';
import { useGetCollectionTrendQuery } from '../api/feesApi';
import styles from './AdminReports.module.css';

export default function AdminReports() {
  const [filters, setFilters] = useState({
    departmentId: 'all',
    startDate: '',
    endDate: ''
  });

  const { data: deptData, isLoading: isLoadingDepts } = useListDepartmentsQuery();
  const departments = deptData?.data || [];

  // Pass filters directly to the RTK Query hooks. They will automatically refetch
  // whenever `filters` changes. Since they are all called together, the loading state
  // will be synchronized.
  const { 
    data: attendanceData, 
    isFetching: isAttFetching, 
    isError: isAttError 
  } = useGetTrendQuery(filters);

  const { 
    data: marksData, 
    isFetching: isMarksFetching, 
    isError: isMarksError 
  } = useGetDistributionQuery(filters);

  const { 
    data: feesData, 
    isFetching: isFeesFetching, 
    isError: isFeesError 
  } = useGetCollectionTrendQuery(filters);

  const attList = attendanceData?.data || [];
  const marksList = marksData?.data || [];
  const feesList = feesData?.data || [];

  return (
    <DashboardShell title="Reports & Analytics" subtitle="Institution-wide insights" icon="📈">
      <div className={styles.container}>
        <FilterBar 
          filters={filters} 
          onFilterChange={setFilters} 
          departments={departments}
          isLoadingDepartments={isLoadingDepts}
        />

        <div className={styles.chartsGrid}>
          {/* Attendance Trend */}
          <ChartCard 
            title="Attendance Trend" 
            isLoading={isAttFetching} 
            isError={isAttError}
            isEmpty={!isAttFetching && !isAttError && attList.length === 0}
          >
            <AttendanceTrendChart data={attList} />
          </ChartCard>

          {/* Marks Distribution */}
          <ChartCard 
            title="Marks Distribution" 
            isLoading={isMarksFetching} 
            isError={isMarksError}
            isEmpty={!isMarksFetching && !isMarksError && marksList.length === 0}
          >
            <MarksDistributionChart data={marksList} />
          </ChartCard>

          {/* Fee Collection Trend */}
          <ChartCard 
            title="Fee Collection Trend" 
            isLoading={isFeesFetching} 
            isError={isFeesError}
            isEmpty={!isFeesFetching && !isFeesError && feesList.length === 0}
          >
            <FeeCollectionChart data={feesList} />
          </ChartCard>
        </div>
      </div>
    </DashboardShell>
  );
}
