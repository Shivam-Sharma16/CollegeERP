import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQuery } from './baseQuery';

export const auditApi = createApi({
  reducerPath: 'auditApi',
  baseQuery,
  tagTypes: ['AuditLog'],

  endpoints: (builder) => ({
    getRecentActivity: builder.query({
      query: (params = {}) => ({ url: '/api/audit/recent', params }),
      providesTags: ['AuditLog'],
    }),
  }),
});

export const { useGetRecentActivityQuery } = auditApi;
