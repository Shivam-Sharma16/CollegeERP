import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQuery } from './baseQuery';

export const reportsApi = createApi({
  reducerPath: 'reportsApi',
  baseQuery,
  tagTypes: ['DashboardStats', 'Reports'],
  keepUnusedDataFor: 120,

  endpoints: (builder) => ({
    getDashboardStats: builder.query({
      query: () => '/api/reports/dashboard-stats',
      providesTags: ['DashboardStats'],
    }),

    getHodDashboardStats: builder.query({
      query: () => '/api/reports/hod-stats',
      providesTags: ['DashboardStats'],
    }),

    /**
     * GET /api/reports/overview?departmentId=
     * Total students/faculty breakdown overall & per department.
     */
    getOverview: builder.query({
      query: (params = {}) => {
        const p = {};
        if (params.departmentId && params.departmentId !== 'all') {
          p.departmentId = params.departmentId;
        }
        return {
          url: '/api/reports/overview',
          params: p,
        };
      },
      providesTags: ['Reports'],
      transformResponse: (response) => response?.data ?? response,
    }),

    /**
     * GET /api/reports/attendance-trend?departmentId=
     * Attendance percentage trend over time.
     */
    getAttendanceTrend: builder.query({
      query: (params = {}) => {
        const p = {};
        if (params.departmentId && params.departmentId !== 'all') {
          p.departmentId = params.departmentId;
        }
        return {
          url: '/api/reports/attendance-trend',
          params: p,
        };
      },
      providesTags: ['Reports'],
      transformResponse: (response) => response?.data ?? response,
    }),

    /**
     * GET /api/reports/academic-performance?departmentId=
     * Average marks & pass rates across exams.
     */
    getAcademicPerformance: builder.query({
      query: (params = {}) => {
        const p = {};
        if (params.departmentId && params.departmentId !== 'all') {
          p.departmentId = params.departmentId;
        }
        return {
          url: '/api/reports/academic-performance',
          params: p,
        };
      },
      providesTags: ['Reports'],
      transformResponse: (response) => response?.data ?? response,
    }),

    /**
     * GET /api/reports/faculty-workload?departmentId=
     * Total subjects & sections assigned per faculty member.
     */
    getFacultyWorkload: builder.query({
      query: (params = {}) => {
        const p = {};
        if (params.departmentId && params.departmentId !== 'all') {
          p.departmentId = params.departmentId;
        }
        return {
          url: '/api/reports/faculty-workload',
          params: p,
        };
      },
      providesTags: ['Reports'],
      transformResponse: (response) => response?.data ?? response,
    }),
  }),
});

export const {
  useGetDashboardStatsQuery,
  useGetHodDashboardStatsQuery,
  useGetOverviewQuery,
  useGetAttendanceTrendQuery,
  useGetAcademicPerformanceQuery,
  useGetFacultyWorkloadQuery,
} = reportsApi;
