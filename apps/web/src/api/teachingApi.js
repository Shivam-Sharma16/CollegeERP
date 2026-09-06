/**
 * teachingApi — RTK Query slice for teaching assignments & faculty load.
 *
 * Endpoint:  /api/teaching/*
 * Gateway:   academic-service:4003
 *
 * tagTypes:  TeachingAssignment | SectionAssignment | FacultyLoad
 *
 * TeachingAssignment: maps Faculty → Subject (faculty teaches this subject).
 * SectionAssignment:  maps Faculty → Section  (faculty is the CC for this section).
 * FacultyLoad:        computed view — how many sessions a faculty member has.
 */

import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQuery } from './baseQuery';

export const teachingApi = createApi({
  reducerPath: 'teachingApi',
  baseQuery,
  tagTypes: ['TeachingAssignment', 'SectionAssignment', 'FacultyLoad'],

  endpoints: (builder) => ({

    // ── TEACHING ASSIGNMENTS ──────────────────────────────────────────────────

    /** GET /api/teaching/assignments?facultyId=&subjectId=&sectionId= */
    listTeachingAssignments: builder.query({
      query: (params = {}) => ({ url: '/api/teaching/assignments', params }),
      providesTags: (r) =>
        r?.data
          ? [
              ...r.data.map(({ _id }) => ({ type: 'TeachingAssignment', id: _id })),
              { type: 'TeachingAssignment', id: 'LIST' },
            ]
          : [{ type: 'TeachingAssignment', id: 'LIST' }],
    }),

    /** POST /api/teaching/assignments — ADMIN/HOD */
    createTeachingAssignment: builder.mutation({
      query: (body) => ({ url: '/api/teaching/assignments', method: 'POST', body }),
      invalidatesTags: [
        { type: 'TeachingAssignment', id: 'LIST' },
        { type: 'FacultyLoad',        id: 'LIST' },
      ],
    }),

    /** PATCH /api/teaching/assignments/:id */
    updateTeachingAssignment: builder.mutation({
      query: ({ id, ...body }) => ({
        url:    `/api/teaching/assignments/${id}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'TeachingAssignment', id },
        { type: 'TeachingAssignment', id: 'LIST' },
        { type: 'FacultyLoad',        id: 'LIST' },
      ],
    }),

    /** DELETE /api/teaching/assignments/:id */
    deleteTeachingAssignment: builder.mutation({
      query: (id) => ({ url: `/api/teaching/assignments/${id}`, method: 'DELETE' }),
      invalidatesTags: [
        { type: 'TeachingAssignment', id: 'LIST' },
        { type: 'FacultyLoad',        id: 'LIST' },
      ],
    }),

    // ── SECTION ASSIGNMENTS (CC) ──────────────────────────────────────────────

    /** GET /api/teaching/section-assignments */
    listSectionAssignments: builder.query({
      query: (params = {}) => ({ url: '/api/teaching/section-assignments', params }),
      providesTags: (r) =>
        r?.data
          ? [
              ...r.data.map(({ _id }) => ({ type: 'SectionAssignment', id: _id })),
              { type: 'SectionAssignment', id: 'LIST' },
            ]
          : [{ type: 'SectionAssignment', id: 'LIST' }],
    }),

    /** POST /api/teaching/section-assignments */
    createSectionAssignment: builder.mutation({
      query: (body) => ({ url: '/api/teaching/section-assignments', method: 'POST', body }),
      invalidatesTags: [{ type: 'SectionAssignment', id: 'LIST' }],
    }),

    /** DELETE /api/teaching/section-assignments/:id */
    deleteSectionAssignment: builder.mutation({
      query: (id) => ({ url: `/api/teaching/section-assignments/${id}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'SectionAssignment', id: 'LIST' }],
    }),

    // ── FACULTY LOAD ──────────────────────────────────────────────────────────

    /**
     * GET /api/teaching/faculty-load/:facultyId
     * Returns: { sessions: number, subjects: [], sections: [] }
     * Used by HOD dashboard to see how many sessions each faculty member has.
     */
    getFacultyLoad: builder.query({
      query: (facultyId) => `/api/teaching/faculty-load/${facultyId}`,
      providesTags: (_r, _e, facultyId) => [{ type: 'FacultyLoad', id: facultyId }],
    }),
  }),
});

export const {
  useListTeachingAssignmentsQuery,
  useCreateTeachingAssignmentMutation,
  useUpdateTeachingAssignmentMutation,
  useDeleteTeachingAssignmentMutation,
  useListSectionAssignmentsQuery,
  useCreateSectionAssignmentMutation,
  useDeleteSectionAssignmentMutation,
  useGetFacultyLoadQuery,
} = teachingApi;
