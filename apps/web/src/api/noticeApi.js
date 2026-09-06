/**
 * noticeApi — RTK Query slice for notice-service.
 *
 * Endpoint:  /api/notices/*
 * Gateway:   notice-service:4007
 *
 * tagTypes:  Notice | Note
 *
 * Notice: system-wide announcements with targeting (departments/years/sections/roles).
 * Note:   study material uploads (scoped to section/department per uploader role).
 */

import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQuery } from './baseQuery';

export const noticeApi = createApi({
  reducerPath: 'noticeApi',
  baseQuery,
  tagTypes: ['Notice', 'Note'],

  endpoints: (builder) => ({

    // ── NOTICES ───────────────────────────────────────────────────────────────

    /**
     * POST /api/notices/notices
     * Creates a notice. Admin can target freely; CC/Faculty targeting is clamped
     * server-side to their own section (via resolveScope middleware).
     * Body: { title, body, targeting: { departments, years, sections, roles } }
     */
    createNotice: builder.mutation({
      query: (body) => ({ url: '/api/notices/notices', method: 'POST', body }),
      invalidatesTags: [{ type: 'Notice', id: 'LIST' }],
    }),

    /**
     * GET /api/notices/notices/mine
     * Returns all notices visible to the authenticated user (server-scoped by role
     * and section membership). No client-side filtering needed.
     */
    listMyNotices: builder.query({
      query: (params = {}) => ({ url: '/api/notices/notices/mine', params }),
      providesTags: (r) =>
        r?.data
          ? [
              ...r.data.map(({ _id }) => ({ type: 'Notice', id: _id })),
              { type: 'Notice', id: 'LIST' },
            ]
          : [{ type: 'Notice', id: 'LIST' }],
    }),

    /** GET /api/notices/notices/:id */
    getNotice: builder.query({
      query: (id) => `/api/notices/notices/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Notice', id }],
    }),

    // ── NOTES (study material) ────────────────────────────────────────────────

    /**
     * POST /api/notices/notes
     * Upload a study note. Body: { title, fileUrl, subjectId, targeting }
     * Scope clamped server-side to the uploader's section/department.
     */
    createNote: builder.mutation({
      query: (body) => ({ url: '/api/notices/notes', method: 'POST', body }),
      invalidatesTags: [{ type: 'Note', id: 'LIST' }],
    }),

    /**
     * GET /api/notices/notes?q=&subjectId=
     * Returns notes visible to the authenticated user.
     */
    listNotes: builder.query({
      query: (params = {}) => ({ url: '/api/notices/notes', params }),
      providesTags: (r) =>
        r?.data
          ? [
              ...r.data.map(({ _id }) => ({ type: 'Note', id: _id })),
              { type: 'Note', id: 'LIST' },
            ]
          : [{ type: 'Note', id: 'LIST' }],
    }),
  }),
});

export const {
  useCreateNoticeMutation,
  useListMyNoticesQuery,
  useGetNoticeQuery,
  useCreateNoteMutation,
  useListNotesQuery,
} = noticeApi;
