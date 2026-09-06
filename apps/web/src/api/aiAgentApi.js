/**
 * aiAgentApi — RTK Query slice for ai-agent-service.
 *
 * Endpoint:  /api/agents/*
 * Gateway:   ai-agent-service:4009
 *
 * tagTypes:  Conversation
 *
 * Each agent has its own `sendMessage` mutation. They share tag invalidation
 * so that conversation history (if persisted later) refreshes consistently.
 *
 * Design note: agent responses can be slow (multi-turn LLM). RTK Query's
 * built-in loading state handles the "thinking…" spinner automatically.
 * Components should NOT use `useState` to track loading for these mutations.
 */

import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQuery } from './baseQuery';

export const aiAgentApi = createApi({
  reducerPath: 'aiAgentApi',
  baseQuery,
  tagTypes: ['Conversation'],

  endpoints: (builder) => ({

    /**
     * POST /api/agents/attendance-integrity
     * Body: { sessionId, prompt? }
     * Roles: FACULTY, ADMIN, SUPERADMIN
     */
    attendanceIntegrity: builder.mutation({
      query: (body) => ({
        url:    '/api/agents/attendance-integrity',
        method: 'POST',
        body,
      }),
    }),

    /**
     * POST /api/agents/at-risk
     * Body: { studentId, prompt? }
     * Roles: HOD, ADMIN, SUPERADMIN
     */
    atRisk: builder.mutation({
      query: (body) => ({
        url:    '/api/agents/at-risk',
        method: 'POST',
        body,
      }),
    }),

    /**
     * POST /api/agents/nl-query
     * Body: { prompt }
     * Roles: ADMIN, SUPERADMIN
     * Executes one of three pre-approved aggregation templates.
     */
    nlQuery: builder.mutation({
      query: (body) => ({
        url:    '/api/agents/nl-query',
        method: 'POST',
        body,
      }),
    }),

    /**
     * POST /api/agents/notice-draft
     * Body: { prompt }
     * Roles: FACULTY, HOD, ADMIN, SUPERADMIN
     * Returns a draft notice (status always 'draft' — server-enforced).
     * On success, invalidate the Notice LIST so the draft appears immediately.
     */
    noticeDraft: builder.mutation({
      query: (body) => ({
        url:    '/api/agents/notice-draft',
        method: 'POST',
        body,
      }),
      // Cross-slice invalidation would require dispatching from onQueryStarted.
      // Handled in the component instead by calling `noticeApi.util.invalidateTags`.
    }),

    /**
     * POST /api/agents/student-personal
     * Body: { prompt }
     * Roles: STUDENT (own data only — server-enforced)
     */
    studentPersonal: builder.mutation({
      query: (body) => ({
        url:    '/api/agents/student-personal',
        method: 'POST',
        body,
      }),
    }),

    /**
     * GET /api/agents/conversations/:agentName
     * Returns persisted conversation history for the current user + agent.
     * (Endpoint to be implemented on ai-agent-service in a future phase.)
     */
    getConversationHistory: builder.query({
      query: (agentName) => `/api/agents/conversations/${agentName}`,
      providesTags: (_r, _e, agentName) => [{ type: 'Conversation', id: agentName }],
    }),
  }),
});

export const {
  useAttendanceIntegrityMutation,
  useAtRiskMutation,
  useNlQueryMutation,
  useNoticeDraftMutation,
  useStudentPersonalMutation,
  useGetConversationHistoryQuery,
} = aiAgentApi;
