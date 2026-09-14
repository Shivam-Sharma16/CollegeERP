/**
 * academicApi — RTK Query slice for academic structure.
 *
 * Endpoint:  /api/academic/*
 * Gateway:   academic-service:4003
 *
 * tagTypes:  Year | Semester | Section | Subject
 *
 * Hierarchy: Department → Year → Semester → Section → Subject
 * Each level's mutations invalidate the `DeptTree` tag in departmentsApi
 * so the resolved tree query refetches automatically. Cross-API invalidation
 * is done via the store's `invalidateTags` dispatch in `onQueryStarted`.
 */

import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQuery } from './baseQuery';

export const academicApi = createApi({
  reducerPath: 'academicApi',
  baseQuery,
  tagTypes: ['Year', 'Semester', 'Section', 'Subject'],
  keepUnusedDataFor: 600,

  endpoints: (builder) => ({

    // ── YEARS ─────────────────────────────────────────────────────────────────

    listYears: builder.query({
      query: (params = {}) => ({ url: '/api/academic/years', params }),
      providesTags: (r) =>
        r?.data
          ? [...r.data.map(({ _id }) => ({ type: 'Year', id: _id })), { type: 'Year', id: 'LIST' }]
          : [{ type: 'Year', id: 'LIST' }],
    }),

    createYear: builder.mutation({
      query: (body) => ({ url: '/api/academic/years', method: 'POST', body }),
      invalidatesTags: [{ type: 'Year', id: 'LIST' }],
    }),

    updateYear: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/api/academic/years/${id}`, method: 'PATCH', body }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Year', id }, { type: 'Year', id: 'LIST' }],
    }),

    deleteYear: builder.mutation({
      query: (id) => ({ url: `/api/academic/years/${id}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Year', id: 'LIST' }],
    }),

    // ── SEMESTERS ─────────────────────────────────────────────────────────────

    listSemesters: builder.query({
      query: (params = {}) => ({ url: '/api/academic/semesters', params }),
      providesTags: (r) =>
        r?.data
          ? [...r.data.map(({ _id }) => ({ type: 'Semester', id: _id })), { type: 'Semester', id: 'LIST' }]
          : [{ type: 'Semester', id: 'LIST' }],
    }),

    createSemester: builder.mutation({
      query: (body) => ({ url: '/api/academic/semesters', method: 'POST', body }),
      invalidatesTags: [{ type: 'Semester', id: 'LIST' }],
    }),

    updateSemester: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/api/academic/semesters/${id}`, method: 'PATCH', body }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Semester', id }, { type: 'Semester', id: 'LIST' }],
    }),

    deleteSemester: builder.mutation({
      query: (id) => ({ url: `/api/academic/semesters/${id}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Semester', id: 'LIST' }],
    }),

    // ── SECTIONS ──────────────────────────────────────────────────────────────

    listSections: builder.query({
      query: (params = {}) => ({ url: '/api/academic/sections', params }),
      providesTags: (r) =>
        r?.data
          ? [...r.data.map(({ _id }) => ({ type: 'Section', id: _id })), { type: 'Section', id: 'LIST' }]
          : [{ type: 'Section', id: 'LIST' }],
    }),

    createSection: builder.mutation({
      query: (body) => ({ url: '/api/academic/sections', method: 'POST', body }),
      invalidatesTags: [{ type: 'Section', id: 'LIST' }],
    }),

    updateSection: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/api/academic/sections/${id}`, method: 'PATCH', body }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Section', id }, { type: 'Section', id: 'LIST' }],
    }),

    deleteSection: builder.mutation({
      query: (id) => ({ url: `/api/academic/sections/${id}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Section', id: 'LIST' }],
    }),

    // ── SUBJECTS ──────────────────────────────────────────────────────────────

    listSubjects: builder.query({
      query: (params = {}) => ({ url: '/api/academic/subjects', params }),
      providesTags: (r) =>
        r?.data
          ? [...r.data.map(({ _id }) => ({ type: 'Subject', id: _id })), { type: 'Subject', id: 'LIST' }]
          : [{ type: 'Subject', id: 'LIST' }],
    }),

    createSubject: builder.mutation({
      query: (body) => ({ url: '/api/academic/subjects', method: 'POST', body }),
      invalidatesTags: [{ type: 'Subject', id: 'LIST' }],
    }),

    updateSubject: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/api/academic/subjects/${id}`, method: 'PATCH', body }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Subject', id }, { type: 'Subject', id: 'LIST' }],
    }),

    deleteSubject: builder.mutation({
      query: (id) => ({ url: `/api/academic/subjects/${id}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Subject', id: 'LIST' }],
    }),

    // ── CC SPECIFIC ───────────────────────────────────────────────────────────
    getMySection: builder.query({
      query: () => '/api/academic/sections/my-section',
      providesTags: ['Section'],
    }),

    // ── ROLLOVER ───────────────────────────────────────────────────────────────
    rollover: builder.mutation({
      query: (body) => ({
        url: '/api/academic/rollover',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Year', 'Semester', 'Section'],
      transformResponse: (response) => response?.data ?? response,
    }),
  }),
});

export const {
  // Years
  useListYearsQuery,
  useCreateYearMutation,
  useUpdateYearMutation,
  useDeleteYearMutation,
  // Semesters
  useListSemestersQuery,
  useCreateSemesterMutation,
  useUpdateSemesterMutation,
  useDeleteSemesterMutation,
  // Sections
  useListSectionsQuery,
  useCreateSectionMutation,
  useUpdateSectionMutation,
  useDeleteSectionMutation,
  // Subjects
  useListSubjectsQuery,
  useCreateSubjectMutation,
  useUpdateSubjectMutation,
  useDeleteSubjectMutation,
  // CC
  useGetMySectionQuery,
  // Rollover
  useRolloverMutation,
} = academicApi;
