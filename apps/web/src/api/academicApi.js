/**
 * academicApi — RTK Query slice for academic structure.
 *
 * Endpoints: /api/years, /api/semesters, /api/sections, /api/subjects, /api/batches
 *            Batches nested under sections: /api/sections/:id/batches
 *            Rollover: /api/academic/rollover
 * Gateway:   academic-service:4003
 *
 * tagTypes:  Year | Semester | Section | Subject | Batch
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
  tagTypes: ['Year', 'Semester', 'Section', 'Subject', 'Batch'],
  keepUnusedDataFor: 600,

  endpoints: (builder) => ({

    // ── YEARS ─────────────────────────────────────────────────────────────────

    listYears: builder.query({
      query: (params = {}) => ({ url: '/api/years', params }),
      providesTags: (r) =>
        r?.data
          ? [...r.data.map(({ _id }) => ({ type: 'Year', id: _id })), { type: 'Year', id: 'LIST' }]
          : [{ type: 'Year', id: 'LIST' }],
    }),

    createYear: builder.mutation({
      query: (body) => ({ url: '/api/years', method: 'POST', body }),
      invalidatesTags: [{ type: 'Year', id: 'LIST' }],
    }),

    updateYear: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/api/years/${id}`, method: 'PATCH', body }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Year', id }, { type: 'Year', id: 'LIST' }],
    }),

    deleteYear: builder.mutation({
      query: (id) => ({ url: `/api/years/${id}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Year', id: 'LIST' }],
    }),

    // ── SEMESTERS ─────────────────────────────────────────────────────────────

    listSemesters: builder.query({
      query: (params = {}) => ({ url: '/api/semesters', params }),
      providesTags: (r) =>
        r?.data
          ? [...r.data.map(({ _id }) => ({ type: 'Semester', id: _id })), { type: 'Semester', id: 'LIST' }]
          : [{ type: 'Semester', id: 'LIST' }],
    }),

    createSemester: builder.mutation({
      query: (body) => ({ url: '/api/semesters', method: 'POST', body }),
      invalidatesTags: [{ type: 'Semester', id: 'LIST' }],
    }),

    updateSemester: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/api/semesters/${id}`, method: 'PATCH', body }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Semester', id }, { type: 'Semester', id: 'LIST' }],
    }),

    deleteSemester: builder.mutation({
      query: (id) => ({ url: `/api/semesters/${id}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Semester', id: 'LIST' }],
    }),

    // ── SECTIONS ──────────────────────────────────────────────────────────────

    listSections: builder.query({
      query: (params = {}) => ({ url: '/api/sections', params }),
      providesTags: (r) =>
        r?.data
          ? [...r.data.map(({ _id }) => ({ type: 'Section', id: _id })), { type: 'Section', id: 'LIST' }]
          : [{ type: 'Section', id: 'LIST' }],
    }),

    createSection: builder.mutation({
      query: (body) => ({ url: '/api/sections', method: 'POST', body }),
      invalidatesTags: [{ type: 'Section', id: 'LIST' }],
    }),

    updateSection: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/api/sections/${id}`, method: 'PATCH', body }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Section', id }, { type: 'Section', id: 'LIST' }],
    }),

    deleteSection: builder.mutation({
      query: (id) => ({ url: `/api/sections/${id}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Section', id: 'LIST' }],
    }),

    // ── SUBJECTS ──────────────────────────────────────────────────────────────

    listSubjects: builder.query({
      query: (params = {}) => ({ url: '/api/subjects', params }),
      providesTags: (r) =>
        r?.data
          ? [...r.data.map(({ _id }) => ({ type: 'Subject', id: _id })), { type: 'Subject', id: 'LIST' }]
          : [{ type: 'Subject', id: 'LIST' }],
    }),

    createSubject: builder.mutation({
      query: (body) => ({ url: '/api/subjects', method: 'POST', body }),
      invalidatesTags: [{ type: 'Subject', id: 'LIST' }],
    }),

    updateSubject: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/api/subjects/${id}`, method: 'PATCH', body }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Subject', id }, { type: 'Subject', id: 'LIST' }],
    }),

    deleteSubject: builder.mutation({
      query: (id) => ({ url: `/api/subjects/${id}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Subject', id: 'LIST' }],
    }),

    // ── CC SPECIFIC ───────────────────────────────────────────────────────────
    getMySection: builder.query({
      query: () => '/api/sections/my-section',
      providesTags: ['Section'],
    }),

    // ── BATCHES (Phase 84/88) ──────────────────────────────────────────────────
    listBatches: builder.query({
      query: (sectionId) => ({
        url: sectionId ? `/api/sections/${sectionId}/batches` : '/api/batches',
      }),
      providesTags: (r) =>
        Array.isArray(r)
          ? [
              ...r.map(({ _id }) => ({ type: 'Batch', id: _id })),
              { type: 'Batch', id: 'LIST' },
            ]
          : [{ type: 'Batch', id: 'LIST' }],
      transformResponse: (response) => response?.data?.batches || response?.batches || response?.data || response || [],
    }),

    createBatch: builder.mutation({
      query: ({ sectionId, ...body }) => ({
        url: `/api/sections/${sectionId}/batches`,
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'Batch', id: 'LIST' }],
    }),

    updateBatch: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/api/batches/${id}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Batch', id }, { type: 'Batch', id: 'LIST' }],
    }),

    deleteBatch: builder.mutation({
      query: (id) => ({
        url: `/api/batches/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'Batch', id: 'LIST' }],
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
  // Batches
  useListBatchesQuery,
  useCreateBatchMutation,
  useUpdateBatchMutation,
  useDeleteBatchMutation,
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
