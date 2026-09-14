/**
 * grievanceApi — RTK Query slice for Grievance Handling.
 *
 * Endpoints:  /api/grievances/*
 * Gateway:   user-service:4002
 */

import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQuery } from './baseQuery';

export const grievanceApi = createApi({
  reducerPath: 'grievanceApi',
  baseQuery,
  tagTypes: ['Grievance'],
  keepUnusedDataFor: 120,

  endpoints: (builder) => ({
    /** GET /api/grievances — list grievances with optional status filter */
    list: builder.query({
      query: (params = {}) => ({
        url: '/api/grievances',
        params,
      }),
      providesTags: (result) => {
        const list = Array.isArray(result?.data) ? result.data : Array.isArray(result) ? result : [];
        return [
          ...list.map(({ _id }) => ({ type: 'Grievance', id: _id })),
          { type: 'Grievance', id: 'LIST' },
        ];
      },
      transformResponse: (response) => response?.data ?? response,
    }),

    /** POST /api/grievances — create a new grievance */
    create: builder.mutation({
      query: (body) => ({
        url: '/api/grievances',
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'Grievance', id: 'LIST' }],
      transformResponse: (response) => response?.data ?? response,
    }),

    /** POST /api/grievances/:id/resolve — resolve a grievance */
    resolve: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/api/grievances/${id}/resolve`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: 'Grievance', id },
        { type: 'Grievance', id: 'LIST' },
      ],
      transformResponse: (response) => response?.data ?? response,
    }),

    /** PATCH /api/grievances/:id/assign — assign grievance to staff/officer */
    assign: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/api/grievances/${id}/assign`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: 'Grievance', id },
        { type: 'Grievance', id: 'LIST' },
      ],
      transformResponse: (response) => response?.data ?? response,
    }),
  }),
});

export const {
  useListQuery,
  useCreateMutation,
  useResolveMutation,
  useAssignMutation,
} = grievanceApi;
