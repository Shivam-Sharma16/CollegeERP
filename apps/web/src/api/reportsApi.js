import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQuery } from './baseQuery';

export const reportsApi = createApi({
  reducerPath: 'reportsApi',
  baseQuery,
  tagTypes: ['DashboardStats'],

  endpoints: (builder) => ({
    getDashboardStats: builder.query({
      query: () => '/api/reports/dashboard-stats',
      providesTags: ['DashboardStats'],
    }),
  }),
});

export const { useGetDashboardStatsQuery } = reportsApi;
