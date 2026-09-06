/**
 * useAuth — React hook backed by authStore.
 *
 * Returns the current { token, user, isAuthenticated, hasRole } snapshot and
 * re-renders the component whenever auth state changes (login / logout).
 */

import { useEffect, useState } from 'react';
import authStore from '../store/authStore';

export function useAuth() {
  const [snapshot, setSnapshot] = useState(() => ({
    token:           authStore.getToken(),
    user:            authStore.getUser(),
    isAuthenticated: authStore.isAuthenticated(),
  }));

  useEffect(() => {
    // Re-read store on every change
    const unsub = authStore.subscribe(() => {
      setSnapshot({
        token:           authStore.getToken(),
        user:            authStore.getUser(),
        isAuthenticated: authStore.isAuthenticated(),
      });
    });
    return unsub;
  }, []);

  return {
    ...snapshot,
    /** Returns true if the current user has at least one of the given roles. */
    hasRole: (...roles) => authStore.hasRole(...roles),
    login:   authStore.login.bind(authStore),
    logout:  authStore.logout.bind(authStore),
  };
}
