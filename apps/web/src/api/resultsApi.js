/**
 * resultsApi — RTK Query slice for results-service.
 *
 * Endpoint:  /api/results/*
 * Gateway:   results-service:4005
 *
 * tagTypes:  ExamType | Mark | Transcript
 */

import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQuery } from './baseQuery';

export const resultsApi = createApi({
  reducerPath: 'resultsApi',
  baseQuery,
  tagTypes: ['ExamType', 'Mark', 'Transcript'],

  endpoints: (builder) => ({

    // ── EXAM TYPES ────────────────────────────────────────────────────────────

    /** GET /api/results/exam-types */
    listExamTypes: builder.query({
      query: (params = {}) => ({ url: '/api/results/exam-types', params }),
      providesTags: (r) =>
        r?.data
          ? [
              ...r.data.map(({ _id }) => ({ type: 'ExamType', id: _id })),
              { type: 'ExamType', id: 'LIST' },
            ]
          : [{ type: 'ExamType', id: 'LIST' }],
    }),

    /** POST /api/results/exam-types — ADMIN/SUPERADMIN */
    createExamType: builder.mutation({
      query: (body) => ({ url: '/api/results/exam-types', method: 'POST', body }),
      invalidatesTags: [{ type: 'ExamType', id: 'LIST' }],
    }),

    /** PATCH /api/results/exam-types/:id */
    updateExamType: builder.mutation({
      query: ({ id, ...body }) => ({
        url:    `/api/results/exam-types/${id}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'ExamType', id },
        { type: 'ExamType', id: 'LIST' },
      ],
    }),

    /** DELETE /api/results/exam-types/:id */
    deleteExamType: builder.mutation({
      query: (id) => ({ url: `/api/results/exam-types/${id}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'ExamType', id: 'LIST' }],
    }),

    // ── MARKS ─────────────────────────────────────────────────────────────────

    /**
     * POST /api/results/marks
     * Single mark entry. Body: { studentId, examTypeId, subjectId, marks, maxMarks }
     * Ownership validated server-side (faculty must own the TeachingAssignment).
     */
    enterMarks: builder.mutation({
      query: (body) => ({ url: '/api/results/marks', method: 'POST', body }),
      invalidatesTags: [
        { type: 'Mark',       id: 'LIST' },
        { type: 'Transcript', id: 'LIST' },
      ],
    }),

    /**
     * POST /api/results/marks/bulk
     * Bulk mark entry. Body: { examTypeId, subjectId, entries: [{ studentId, marks }] }
     * Same server-side ownership validation applies.
     */
    bulkUpsertMarks: builder.mutation({
      query: (body) => ({ url: '/api/results/marks/bulk', method: 'POST', body }),
      invalidatesTags: [
        { type: 'Mark',       id: 'LIST' },
        { type: 'Transcript', id: 'LIST' },
      ],
    }),

    /** GET /api/results/marks?studentId=&subjectId=&examTypeId= */
    listMarks: builder.query({
      query: (params = {}) => ({ url: '/api/results/marks', params }),
      providesTags: (r) =>
        r?.data
          ? [
              ...r.data.map(({ _id }) => ({ type: 'Mark', id: _id })),
              { type: 'Mark', id: 'LIST' },
            ]
          : [{ type: 'Mark', id: 'LIST' }],
    }),

    // ── TRANSCRIPT ────────────────────────────────────────────────────────────

    /**
     * GET /api/results/students/:studentId/transcript
     * Returns aggregated academic record across all exam types.
     * Students can query their own; HOD/ADMIN can query any student.
     */
    getTranscript: builder.query({
      query: (studentId) => `/api/results/students/${studentId}/transcript`,
      providesTags: (_r, _e, studentId) => [{ type: 'Transcript', id: studentId }],
    }),

    /**
     * GET /api/results/students/me/gpa
     * Returns personal GPA summary for a student.
     */
    getOwnGpa: builder.query({
      query: () => '/api/results/students/me/gpa',
      providesTags: ['Transcript'],
    }),

    /**
     * GET /api/results/reports/distribution
     * Returns marks distribution histogram data based on filters.
     */
    getDistribution: builder.query({
      query: (params = {}) => ({ url: '/api/results/reports/distribution', params }),
      providesTags: ['Mark'],
    }),

    /**
     * GET /api/results/reports/grade-distribution
     * Returns grade distribution specifically for a subject/section
     */
    getGradeDistribution: builder.query({
      query: (params = {}) => ({ url: '/api/results/reports/grade-distribution', params }),
      providesTags: ['Mark'],
    }),

    /**
     * GET /api/results/reports/subject-averages
     * Returns average marks grouped by subject for HOD analytics.
     */
    getSubjectAverages: builder.query({
      query: (params = {}) => ({ url: '/api/results/reports/subject-averages', params }),
      providesTags: ['Mark'],
    }),

    /**
     * GET /api/results/reports/subject-performance
     * Returns performance summary grouped by subject for a specific faculty.
     */
    getSubjectPerformance: builder.query({
      query: (params = {}) => ({ url: '/api/results/reports/subject-performance', params }),
      providesTags: ['Mark'],
    }),
  }),
});

export const {
  useListExamTypesQuery,
  useCreateExamTypeMutation,
  useUpdateExamTypeMutation,
  useDeleteExamTypeMutation,
  useEnterMarksMutation,
  useBulkUpsertMarksMutation,
  useListMarksQuery,
  useGetTranscriptQuery,
  useGetOwnGpaQuery,
  useGetDistributionQuery,
  useGetGradeDistributionQuery,
  useGetSubjectAveragesQuery,
  useGetSubjectPerformanceQuery,
} = resultsApi;
