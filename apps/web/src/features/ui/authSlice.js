/**
 * authSlice — canonical session identity in the Redux store.
 *
 * Rule: this is the ONE exception to "server data lives in RTK Query".
 * User identity (token + user object + roles) is read on nearly every render
 * via selectors, so it's kept here as denormalised, cheaply accessible state.
 *
 * Source of truth for the token/user is still the authApi RTK Query cache —
 * `authApi.login` dispatches `setCredentials` in `onQueryStarted` after a
 * successful response. This slice is the READ side; authApi is the WRITE side.
 *
 * Persistence: we mirror writes to localStorage so the session survives a
 * browser refresh. The store's subscribe() call in store/index.js handles this.
 */

import { createSlice } from '@reduxjs/toolkit';

const AUTH_KEY = 'erp_auth';

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const stored = loadFromStorage();

const initialState = {
  token: stored?.token ?? null,
  user:  stored?.user  ?? null,   // { id, name, email, roles: string[] }
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    /**
     * Called by authApi mutations (login, refresh) after a successful response.
     * Also called directly on bootstrap if a stored token is refreshed.
     */
    setCredentials(state, { payload }) {
      state.token = payload.token;
      state.user  = payload.user;
    },

    /** Called on logout or 401 interception in baseQuery. */
    clearCredentials(state) {
      state.token = null;
      state.user  = null;
    },
  },
});

export const { setCredentials, clearCredentials } = authSlice.actions;
export default authSlice.reducer;

// ── Selectors ─────────────────────────────────────────────────────────────────

/** The raw JWT string, or null if not logged in. */
export const selectToken = (state) => state.auth.token;

/** Full user object, or null. */
export const selectUser = (state) => state.auth.user;

/** Boolean convenience selector. */
export const selectIsAuthenticated = (state) => Boolean(state.auth.token);

/** Array of the current user's role strings, e.g. ['ADMIN']. */
export const selectRoles = (state) => state.auth.user?.roles ?? [];

/**
 * Returns true if the current user has at least one of the provided roles.
 * Usage: `const canEdit = useSelector(selectHasRole('ADMIN', 'SUPERADMIN'));`
 */
export const selectHasRole = (...roles) => (state) => {
  const userRoles = selectRoles(state);
  return roles.some((r) => userRoles.includes(r));
};
