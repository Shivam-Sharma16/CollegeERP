/**
 * Redux store — single source of truth for the entire frontend.
 *
 * Layout:
 *   Plain slices  (client-only state):
 *     auth           — current user + token (hydrated from localStorage)
 *     sidebar        — collapsed/expanded, active nav key
 *     theme          — CSS variable config
 *     notificationUi — bell open/closed, unread count
 *
 *   RTK Query caches (server data — never duplicate into plain slices):
 *     authApi, usersApi, departmentsApi, academicApi, teachingApi,
 *     attendanceApi, resultsApi, feesApi, noticeApi, notificationApi,
 *     aiAgentApi
 *
 * Persistence:
 *   `auth` slice mirrors writes to localStorage via a store subscriber so
 *   the session survives a browser refresh. All RTK Query caches are ephemeral
 *   (in-memory only) — they refetch on mount when the cache is cold.
 */

import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';

// ── Plain slice reducers ───────────────────────────────────────────────────────
import authReducer           from '../features/ui/authSlice';
import sidebarReducer        from '../features/ui/sidebarSlice';
import themeReducer          from '../features/ui/themeSlice';
import notificationUiReducer from '../features/ui/notificationUiSlice';

// ── RTK Query API slice reducers ───────────────────────────────────────────────
import { authApi }         from '../api/authApi';
import { usersApi }        from '../api/usersApi';
import { departmentsApi }  from '../api/departmentsApi';
import { academicApi }     from '../api/academicApi';
import { teachingApi }     from '../api/teachingApi';
import { attendanceApi }   from '../api/attendanceApi';
import { resultsApi }      from '../api/resultsApi';
import { feesApi }         from '../api/feesApi';
import { noticeApi }       from '../api/noticeApi';
import { notificationApi } from '../api/notificationApi';
import { aiAgentApi }      from '../api/aiAgentApi';
import { reportsApi }      from '../api/reportsApi';
import { auditApi }        from '../api/auditApi';

// ── Store ──────────────────────────────────────────────────────────────────────
export const store = configureStore({
  reducer: {
    // Plain slices
    auth:           authReducer,
    sidebar:        sidebarReducer,
    theme:          themeReducer,
    notificationUi: notificationUiReducer,

    // RTK Query caches (each has its own reducerPath key)
    [authApi.reducerPath]:         authApi.reducer,
    [usersApi.reducerPath]:        usersApi.reducer,
    [departmentsApi.reducerPath]:  departmentsApi.reducer,
    [academicApi.reducerPath]:     academicApi.reducer,
    [teachingApi.reducerPath]:     teachingApi.reducer,
    [attendanceApi.reducerPath]:   attendanceApi.reducer,
    [resultsApi.reducerPath]:      resultsApi.reducer,
    [feesApi.reducerPath]:         feesApi.reducer,
    [noticeApi.reducerPath]:       noticeApi.reducer,
    [notificationApi.reducerPath]: notificationApi.reducer,
    [aiAgentApi.reducerPath]:      aiAgentApi.reducer,
    [reportsApi.reducerPath]:      reportsApi.reducer,
    [auditApi.reducerPath]:        auditApi.reducer,
  },

  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(
      authApi.middleware,
      usersApi.middleware,
      departmentsApi.middleware,
      academicApi.middleware,
      teachingApi.middleware,
      attendanceApi.middleware,
      resultsApi.middleware,
      feesApi.middleware,
      noticeApi.middleware,
      notificationApi.middleware,
      aiAgentApi.middleware,
      reportsApi.middleware,
      auditApi.middleware,
    ),
});

// ── Enable refetchOnFocus / refetchOnReconnect behaviours ─────────────────────
setupListeners(store.dispatch);

// ── Persist auth & sidebar slices to localStorage on every change ─────────────
const AUTH_KEY = 'erp_auth';
const SIDEBAR_KEY = 'erp_sidebar';

store.subscribe(() => {
  const { auth, sidebar } = store.getState();
  try {
    if (auth.token) {
      localStorage.setItem(AUTH_KEY, JSON.stringify({ token: auth.token, user: auth.user }));
    } else {
      localStorage.removeItem(AUTH_KEY);
    }
    
    // Persist sidebar state
    localStorage.setItem(SIDEBAR_KEY, JSON.stringify({ collapsed: sidebar.collapsed }));
  } catch { /* quota exceeded or private browsing — silently ignore */ }
});

// ── Typed hooks for use throughout the app ────────────────────────────────────
import { useDispatch, useSelector } from 'react-redux';

/** Use instead of `useDispatch` for full TypeScript inference (if added later). */
export const useAppDispatch = () => useDispatch();

/** Use instead of `useSelector` — consistent naming across the codebase. */
export const useAppSelector = useSelector;
