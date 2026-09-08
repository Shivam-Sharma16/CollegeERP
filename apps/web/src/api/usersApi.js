/**
 * usersApi — RTK Query slice for user-service.
 *
 * Endpoint:  /api/users/*
 * Gateway:   user-service:4002
 *
 * tagTypes:  Admin | Hod | Faculty | Cc
 *
 * Scoping rule: every list query is scoped server-side to the caller's
 * permissions (e.g. HOD only sees faculty in their own department).
 * The frontend sends NO client-side filter params for permission scoping —
 * it trusts the server response entirely.
 */

import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQuery } from './baseQuery';

export const usersApi = createApi({
  reducerPath: 'usersApi',
  baseQuery,
  tagTypes: ['Admin', 'Hod', 'Faculty', 'Cc', 'Student'],

  endpoints: (builder) => ({

    // ── CREATE ────────────────────────────────────────────────────────────────

    /** POST /api/users/admins  — SUPERADMIN only */
    createAdmin: builder.mutation({
      query: (body) => ({ url: '/api/users/admins', method: 'POST', body }),
      invalidatesTags: [{ type: 'Admin', id: 'LIST' }],
    }),

    /** POST /api/users/hods  — ADMIN/SUPERADMIN */
    createHod: builder.mutation({
      query: (body) => ({ url: '/api/users/hods', method: 'POST', body }),
      invalidatesTags: [{ type: 'Hod', id: 'LIST' }],
    }),

    /**
     * POST /api/users/faculty  — ADMIN/SUPERADMIN
     * Also invalidates the Hod list because faculty assignments may change
     * a department's displayed headcount.
     */
    createFaculty: builder.mutation({
      query: (body) => ({ url: '/api/users/faculty', method: 'POST', body }),
      invalidatesTags: [{ type: 'Faculty', id: 'LIST' }],
    }),

    /** POST /api/users/cc  — ADMIN/SUPERADMIN (Class Coordinator) */
    createCc: builder.mutation({
      query: (body) => ({ url: '/api/users/cc', method: 'POST', body }),
      invalidatesTags: [{ type: 'Cc', id: 'LIST' }],
    }),

    // ── LIST (server-side scoped) ──────────────────────────────────────────────

    /** GET /api/users/admins */
    listAdmins: builder.query({
      query: (params = {}) => ({ url: '/api/users/admins', params }),
      providesTags: (result) =>
        result?.data
          ? [
              ...result.data.map(({ _id }) => ({ type: 'Admin', id: _id })),
              { type: 'Admin', id: 'LIST' },
            ]
          : [{ type: 'Admin', id: 'LIST' }],
    }),

    /** GET /api/users/hods */
    listHods: builder.query({
      query: (params = {}) => ({ url: '/api/users/hods', params }),
      providesTags: (result) =>
        result?.data
          ? [
              ...result.data.map(({ _id }) => ({ type: 'Hod', id: _id })),
              { type: 'Hod', id: 'LIST' },
            ]
          : [{ type: 'Hod', id: 'LIST' }],
    }),

    /**
     * GET /api/users/faculty
     * Optional query params: { departmentId?, page?, limit? }
     * Scoping (department ownership) enforced server-side.
     */
    listFaculty: builder.query({
      query: (params = {}) => ({ url: '/api/users/faculty', params }),
      providesTags: (result) =>
        result?.data
          ? [
              ...result.data.map(({ _id }) => ({ type: 'Faculty', id: _id })),
              { type: 'Faculty', id: 'LIST' },
            ]
          : [{ type: 'Faculty', id: 'LIST' }],
    }),

    /** GET /api/users/cc */
    listCc: builder.query({
      query: (params = {}) => ({ url: '/api/users/cc', params }),
      providesTags: (result) =>
        result?.data
          ? [
              ...result.data.map(({ _id }) => ({ type: 'Cc', id: _id })),
              { type: 'Cc', id: 'LIST' },
            ]
          : [{ type: 'Cc', id: 'LIST' }],
    }),
    /** POST /api/users/students — CC only */
    onboardStudent: builder.mutation({
      query: (body) => ({ url: '/api/users/students', method: 'POST', body }),
      invalidatesTags: [{ type: 'Student', id: 'LIST' }],
    }),

    /** GET /api/users/students */
    listSectionStudents: builder.query({
      query: (params = {}) => ({ url: '/api/users/students', params }),
      providesTags: (result) =>
        result?.data
          ? [
              ...result.data.map(({ _id }) => ({ type: 'Student', id: _id })),
              { type: 'Student', id: 'LIST' },
            ]
          : [{ type: 'Student', id: 'LIST' }],
    }),
  }),
});

export const {
  useCreateAdminMutation,
  useCreateHodMutation,
  useCreateFacultyMutation,
  useCreateCcMutation,
  useOnboardStudentMutation,
  useListAdminsQuery,
  useListHodsQuery,
  useListFacultyQuery,
  useListCcQuery,
  useListSectionStudentsQuery,
} = usersApi;
