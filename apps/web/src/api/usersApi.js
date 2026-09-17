/**
 * usersApi — RTK Query slice for user-service.
 *
 * Endpoint:  /api/users/*
 * Gateway:   user-service:4002
 *
 * tagTypes:  Admin | Hod | Faculty | Cc | Student
 *
 * Phase 89 additions:
 *   - listDepartmentStudents  GET  /api/users/department-students
 *   - deactivateFaculty       PATCH /api/users/faculty/:id/deactivate
 *   - deactivateCc            PATCH /api/users/cc/:id/deactivate
 *
 * Scoping rule: every list query is scoped server-side to the caller's
 * permissions (e.g. HOD only sees faculty in their own department).
 * The frontend sends NO client-side filter params for permission scoping —
 * it trusts the server response entirely.
 */

import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQuery } from './baseQuery';
import { departmentsApi } from './departmentsApi';

export const usersApi = createApi({
  reducerPath: 'usersApi',
  baseQuery,
  tagTypes: ['Profile', 'Admin', 'Hod', 'Faculty', 'Cc', 'Student'],
  keepUnusedDataFor: 300,

  endpoints: (builder) => ({

    // ── CREATE / UPDATE ───────────────────────────────────────────────────────

    /** GET /api/users/me */
    getOwnProfile: builder.query({
      query: () => '/api/users/me',
      providesTags: ['Profile'],
      transformResponse: (response) => response?.data ?? response,
    }),

    /** GET /api/users/:id */
    getUser: builder.query({
      query: (id) => `/api/users/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Hod', id }, { type: 'Faculty', id }],
      transformResponse: (response) => response?.data ?? response,
    }),

    /** PATCH /api/users/me */
    updateOwnProfile: builder.mutation({
      query: (body) => ({ url: '/api/users/me', method: 'PATCH', body }),
      invalidatesTags: ['Profile'],
    }),

    /** PATCH /api/users/:id — Hierarchy-governed user credential update */
    updateUser: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/api/users/${id}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['Admin', 'Hod', 'Faculty', 'Cc', 'Student'],
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(
            departmentsApi.util.invalidateTags([
              { type: 'Department', id: 'LIST' },
              { type: 'DeptTree', id: 'TREE' },
            ])
          );
        } catch {}
      },
    }),

    /** POST /api/users/admins  — SUPERADMIN only */
    createAdmin: builder.mutation({
      query: (body) => ({ url: '/api/users/admins', method: 'POST', body }),
      invalidatesTags: [{ type: 'Admin', id: 'LIST' }],
    }),

    /** POST /api/users/hods  — ADMIN/SUPERADMIN */
    createHod: builder.mutation({
      query: (body) => ({ url: '/api/users/hods', method: 'POST', body }),
      invalidatesTags: [{ type: 'Hod', id: 'LIST' }],
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(
            departmentsApi.util.invalidateTags([
              { type: 'Department', id: 'LIST' },
              { type: 'DeptTree', id: 'TREE' },
            ])
          );
        } catch {}
      },
    }),

    /**
     * POST /api/users/faculty  — ADMIN/SUPERADMIN
     * Also invalidates the Hod list because faculty assignments may change
     * a department's displayed headcount.
     */
    createFaculty: builder.mutation({
      query: (body) => ({ url: '/api/users/faculty', method: 'POST', body }),
      invalidatesTags: [{ type: 'Faculty', id: 'LIST' }],
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(
            departmentsApi.util.invalidateTags([
              { type: 'Department', id: 'LIST' },
              { type: 'DeptTree', id: 'TREE' },
            ])
          );
        } catch {}
      },
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

    /** DELETE /api/users/:id — SUPERADMIN or ADMIN deleting user */
    deleteUser: builder.mutation({
      query: (id) => ({
        url: `/api/users/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Admin', 'Hod', 'Faculty', 'Cc', 'Student'],
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(
            departmentsApi.util.invalidateTags([
              { type: 'Department', id: 'LIST' },
              { type: 'DeptTree', id: 'TREE' },
            ])
          );
        } catch {}
      },
    }),

    /** POST /api/users/:id/assign-custom-role — assign a custom role to user */
    assignCustomRole: builder.mutation({
      query: ({ userId, customRoleId, departmentId, sectionId, validFrom, validTo }) => ({
        url: `/api/users/${userId}/assign-custom-role`,
        method: 'POST',
        body: { customRoleId, departmentId, sectionId, validFrom, validTo },
      }),
      invalidatesTags: ['Admin', 'Hod', 'Faculty', 'Cc', 'Student', { type: 'CustomRole', id: 'LIST' }],
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(
            departmentsApi.util.invalidateTags([
              { type: 'Department', id: 'LIST' },
              { type: 'DeptTree', id: 'TREE' },
            ])
          );
        } catch {}
      },
      transformResponse: (response) => response?.data ?? response,
    }),

    /** GET /api/users/search?q=:q — search users by query */
    searchUsers: builder.query({
      query: (q) => ({
        url: '/api/users/search',
        params: { q },
      }),
      transformResponse: (response) => response?.data ?? response ?? [],
    }),

    /** POST /api/users/bulk-import — bulk import users via CSV */
    bulkImport: builder.mutation({
      query: (body) => ({
        url: '/api/users/bulk-import',
        method: 'POST',
        body: typeof body === 'string' ? { csv: body } : body,
      }),
      invalidatesTags: ['Admin', 'Hod', 'Faculty', 'Cc', 'Student'],
      transformResponse: (response) => response?.data ?? response,
    }),

    // ── PHASE 89 — HOD: Department Roster & Account Management ────────────────

    /**
     * GET /api/users/department-students
     * Optional query params: { year?, semester?, section? }
     * Scoped server-side to the calling HOD's department.
     */
    listDepartmentStudents: builder.query({
      query: (params = {}) => ({ url: '/api/users/department-students', params }),
      providesTags: (result) =>
        result?.data
          ? [
              ...result.data.map(({ _id }) => ({ type: 'Student', id: _id })),
              { type: 'Student', id: 'DEPT_LIST' },
            ]
          : [{ type: 'Student', id: 'DEPT_LIST' }],
      transformResponse: (response) => response?.data ?? response,
    }),

    /**
     * PATCH /api/users/faculty/:id/deactivate — HOD-initiated faculty deactivation.
     * Removes system access and unlinks active teaching assignments.
     */
    deactivateFaculty: builder.mutation({
      query: (id) => ({
        url: `/api/users/faculty/${id}/deactivate`,
        method: 'PATCH',
      }),
      invalidatesTags: (_r, _e, id) => [
        { type: 'Faculty', id },
        { type: 'Faculty', id: 'LIST' },
      ],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(
            departmentsApi.util.invalidateTags([
              { type: 'Department', id: 'LIST' },
              { type: 'DeptTree', id: 'TREE' },
            ])
          );
        } catch {}
      },
    }),

    /**
     * PATCH /api/users/cc/:id/deactivate — HOD-initiated CC deactivation.
     * Removes system access and unlinks the section assignment.
     */
    deactivateCc: builder.mutation({
      query: (id) => ({
        url: `/api/users/cc/${id}/deactivate`,
        method: 'PATCH',
      }),
      invalidatesTags: (_r, _e, id) => [
        { type: 'Cc', id },
        { type: 'Cc', id: 'LIST' },
      ],
    }),
  }),
});

export const {
  useGetOwnProfileQuery,
  useGetUserQuery,
  useUpdateOwnProfileMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
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
  useAssignCustomRoleMutation,
  useSearchUsersQuery,
  useBulkImportMutation,
  // Phase 89
  useListDepartmentStudentsQuery,
  useDeactivateFacultyMutation,
  useDeactivateCcMutation,
} = usersApi;
