/**
 * useAuth — reads current session identity from the Redux store.
 *
 * Backed by `authSlice` selectors — re-renders only when the auth state
 * in the store changes (login / logout / token refresh).
 *
 * The API intentionally matches the Phase 22 shape so no callers need
 * updating: { isAuthenticated, user, token, hasRole, login, logout }
 */

import { useCallback } from 'react';
import { useAppSelector, useAppDispatch } from '../store/index';
import {
  selectIsAuthenticated,
  selectUser,
  selectToken,
  setCredentials,
  clearCredentials,
} from '../features/ui/authSlice';

export function useAuth() {
  const dispatch       = useAppDispatch();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const user            = useAppSelector(selectUser);
  const token           = useAppSelector(selectToken);

  /** Convenience role-check: returns true if user has at least one of the given roles. */
  const hasRole = useCallback(
    (...roles) => {
      const userRoles = user?.roles ?? [];
      return roles.some((r) => userRoles.includes(r));
    },
    [user],
  );

  /**
   * Programmatic login — dispatches `setCredentials` into authSlice.
   * Normally called from authApi.login's onQueryStarted, but exposed here
   * for edge cases (e.g. token refresh from a background effect).
   */
  const login = useCallback(
    (token, user) => dispatch(setCredentials({ token, user })),
    [dispatch],
  );

  /** Wipes auth state from store (and therefore localStorage via subscriber). */
  const logout = useCallback(
    () => dispatch(clearCredentials()),
    [dispatch],
  );

  return { isAuthenticated, user, token, hasRole, login, logout };
}
