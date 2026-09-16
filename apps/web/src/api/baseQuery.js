/**
 * Shared RTK Query base query.
 *
 * - Reads the JWT from `state.auth.token` (Redux store) via `prepareHeaders`.
 * - On 401: dispatches `clearCredentials` and wipes localStorage.
 * - All API slices import this instead of calling `fetchBaseQuery` directly.
 */

import { fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { clearCredentials } from '../features/ui/authSlice';

const AUTH_STORAGE_KEY = 'erp_auth';

const rawBaseQuery = fetchBaseQuery({
  baseUrl: import.meta.env.VITE_API_URL || '',
  prepareHeaders: (headers, { getState }) => {
    const token = getState().auth.token;
    if (token) headers.set('Authorization', `Bearer ${token}`);

    if (typeof window !== 'undefined' && window.location?.pathname) {
      const match = window.location.pathname.match(/^\/inst\/([a-z0-9-]+)/i);
      if (match && match[1]) {
        headers.set('x-tenant-subdomain', match[1]);
      }
    }

    return headers;
  },
});

/**
 * Wrapper that intercepts 401 responses and clears auth state globally.
 * Components never need to handle session expiry manually.
 */
export const baseQuery = async (args, api, extraOptions) => {
  const result = await rawBaseQuery(args, api, extraOptions);

  if (result.error?.status === 401) {
    api.dispatch(clearCredentials());
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }

  if (result.error?.status === 'FETCH_ERROR') {
    console.warn('[baseQuery] Connection error reaching API Gateway. Ensure Gateway (port 4000) is running:', result.error);
  }

  return result;
};
