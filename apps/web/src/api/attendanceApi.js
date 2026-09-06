/**
 * attendanceApi — RTK Query slice for attendance-service.
 *
 * Endpoint:  /api/attendance/* (proxied by gateway to attendance-service:4004)
 * Gateway:   attendance-service:4004
 *
 * tagTypes:  Session | AttendanceRecord
 *
 * Note on liveness ping & QR polling:
 *   - `getQrToken` uses `keepUnusedDataFor: 0` and is called on a 30-second
 *     component-level interval (not polled by RTK's built-in `pollingInterval`
 *     because the QR rotates on every request, not on a schedule).
 *   - Liveness ping goes over Socket.IO, not RTK Query — no entry here.
 */

import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQuery } from './baseQuery';

export const attendanceApi = createApi({
  reducerPath: 'attendanceApi',
  baseQuery,
  tagTypes: ['Session', 'AttendanceRecord'],

  endpoints: (builder) => ({

    // ── SESSIONS ──────────────────────────────────────────────────────────────

    /**
     * POST /api/attendance/sessions
     * Body: { teachingAssignmentId, date, timeSlot, topic, geofence }
     * Returns a new active session with the first QR token.
     */
    createSession: builder.mutation({
      query: (body) => ({
        url:    '/api/attendance/sessions',
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'Session', id: 'LIST' }],
    }),

    /** GET /api/attendance/sessions — list (faculty sees their own) */
    listSessions: builder.query({
      query: (params = {}) => ({ url: '/api/attendance/sessions', params }),
      providesTags: (r) =>
        r?.data
          ? [
              ...r.data.map(({ _id }) => ({ type: 'Session', id: _id })),
              { type: 'Session', id: 'LIST' },
            ]
          : [{ type: 'Session', id: 'LIST' }],
    }),

    /** GET /api/attendance/sessions/:id */
    getSession: builder.query({
      query: (id) => `/api/attendance/sessions/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Session', id }],
    }),

    /**
     * POST /api/attendance/sessions/:id/close
     * Faculty closes the session; triggers session.closed notification.
     */
    closeSession: builder.mutation({
      query: (id) => ({
        url:    `/api/attendance/sessions/${id}/close`,
        method: 'POST',
      }),
      invalidatesTags: (_r, _e, id) => [
        { type: 'Session', id },
        { type: 'Session', id: 'LIST' },
        { type: 'AttendanceRecord', id: 'LIST' },
      ],
    }),

    /**
     * GET /api/attendance/sessions/:id/qr
     * Returns a fresh QR token. Call this on a ≤30s interval while session is active.
     * `keepUnusedDataFor: 0` so the old token is never served from cache.
     */
    getQrToken: builder.query({
      query: (sessionId) => `/api/attendance/sessions/${sessionId}/qr`,
      keepUnusedDataFor: 0,
    }),

    // ── ATTENDANCE RECORDS ────────────────────────────────────────────────────

    /**
     * POST /api/attendance/sessions/:id/checkin
     * Body: { studentId, qrToken, deviceFingerprint, gpsCoords }
     */
    checkIn: builder.mutation({
      query: ({ sessionId, ...body }) => ({
        url:    `/api/attendance/sessions/${sessionId}/checkin`,
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'AttendanceRecord', id: 'LIST' }],
    }),

    /**
     * GET /api/attendance/sessions/:id/records
     * Returns all attendance records for a session (faculty/admin view).
     */
    getSessionRecords: builder.query({
      query: ({ sessionId, ...params }) => ({
        url: `/api/attendance/sessions/${sessionId}/records`,
        params,
      }),
      providesTags: (r) =>
        r?.data
          ? [
              ...r.data.map(({ _id }) => ({ type: 'AttendanceRecord', id: _id })),
              { type: 'AttendanceRecord', id: 'LIST' },
            ]
          : [{ type: 'AttendanceRecord', id: 'LIST' }],
    }),

    /**
     * POST /api/attendance/records/:id/override
     * Faculty manually overrides attendance status for a record.
     * Body: { status: 'present' | 'absent' | 'flagged', reason }
     */
    overrideRecord: builder.mutation({
      query: ({ recordId, ...body }) => ({
        url:    `/api/attendance/records/${recordId}/override`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_r, _e, { recordId }) => [
        { type: 'AttendanceRecord', id: recordId },
        { type: 'AttendanceRecord', id: 'LIST' },
      ],
    }),
  }),
});

export const {
  useCreateSessionMutation,
  useListSessionsQuery,
  useGetSessionQuery,
  useCloseSessionMutation,
  useGetQrTokenQuery,
  useCheckInMutation,
  useGetSessionRecordsQuery,
  useOverrideRecordMutation,
} = attendanceApi;
