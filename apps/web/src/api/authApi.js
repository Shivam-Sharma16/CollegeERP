/**
 * authApi — RTK Query slice for auth-service.
 *
 * Endpoint:  /api/auth/*
 * Gateway:   auth-service:4001
 *
 * After a successful login or refresh, `onQueryStarted` dispatches
 * `setCredentials` into `authSlice` so the rest of the app has the
 * token immediately without waiting for a selector to re-read RTK cache.
 */

import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQuery } from './baseQuery';
import { setCredentials, clearCredentials } from '../features/ui/authSlice';

export const authApi = createApi({
  reducerPath: 'authApi',
  baseQuery,
  // Auth has no cacheable entities — no tagTypes needed.
  endpoints: (builder) => ({

    /** POST /api/auth/login → { success, data: { token, user } } */
    login: builder.mutation({
      query: (credentials) => ({
        url:    '/api/auth/login',
        method: 'POST',
        body:   credentials,   // { email, password }
      }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          const token = data?.data?.token || data?.token || data?.accessToken;
          const user = data?.data?.user || data?.user || {
            id: data?.userId || data?.data?.userId,
            roles: data?.roles || data?.data?.roles || []
          };
          if (token) {
            dispatch(setCredentials({ token, user }));
          }
        } catch (err) {
          console.error('[authApi] Failed to set credentials on login:', err);
        }
      },
    }),

    /**
     * POST /api/auth/refresh
     * Called on boot to silently exchange a stored token for a fresh one.
     * Body: {} (token read from Authorization header via baseQuery).
     */
    refresh: builder.mutation({
      query: () => ({ url: '/api/auth/refresh', method: 'POST' }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          const token = data?.data?.token || data?.token || data?.accessToken;
          const user = data?.data?.user || data?.user;
          if (token) {
            dispatch(setCredentials({ token, user }));
          }
        } catch {
          dispatch(clearCredentials());
        }
      },
    }),

    /** POST /api/auth/logout — server-side token invalidation. */
    logout: builder.mutation({
      query: () => ({ url: '/api/auth/logout', method: 'POST' }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        // Optimistically clear credentials immediately so the UI updates fast.
        dispatch(clearCredentials());
        try { await queryFulfilled; } catch { /* already cleared */ }
      },
    }),

    /**
     * POST /api/auth/superadmin-signup
     * One-time bootstrap endpoint (only works when no SUPERADMIN exists).
     * Body: { name, email, password }
     */
    superadminSignup: builder.mutation({
      query: (body) => ({
        url:    '/api/auth/superadmin-signup',
        method: 'POST',
        body,
      }),
    }),

    /**
     * POST /api/auth/register
     * Student self-registration (open, no auth required).
     * Body: { name, email, password, enrollmentNumber? }
     */
    studentSelfRegister: builder.mutation({
      query: (body) => ({
        url:    '/api/auth/register',
        method: 'POST',
        body,
      }),
    }),
  }),
});

export const {
  useLoginMutation,
  useRefreshMutation,
  useLogoutMutation,
  useSuperadminSignupMutation,
  useStudentSelfRegisterMutation,
} = authApi;
