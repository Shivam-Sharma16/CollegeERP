/**
 * authStore — lightweight auth state with no external dependency.
 *
 * Shape persisted to localStorage:
 *   { token: string, user: { id, name, email, roles: string[] } }
 *
 * Subscribers (React hooks) are notified on every change via a simple
 * publish/subscribe pattern so multiple components stay in sync.
 */

const AUTH_KEY = 'erp_auth';

let listeners = [];

function notifyAll() {
  listeners.forEach((fn) => fn());
}

/** Read raw state from storage (null when not logged in). */
function getState() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Persist auth state and notify subscribers. */
function setState(state) {
  if (state) {
    localStorage.setItem(AUTH_KEY, JSON.stringify(state));
  } else {
    localStorage.removeItem(AUTH_KEY);
  }
  notifyAll();
}

const authStore = {
  /** Current JWT string, or null. */
  getToken() {
    return getState()?.token ?? null;
  },

  /** Current user object { id, name, email, roles }, or null. */
  getUser() {
    return getState()?.user ?? null;
  },

  /** True when a token is present (does NOT validate expiry). */
  isAuthenticated() {
    return Boolean(authStore.getToken());
  },

  /** Check whether the current user has at least one of the given roles. */
  hasRole(...roles) {
    const userRoles = authStore.getUser()?.roles ?? [];
    return roles.some((r) => userRoles.includes(r));
  },

  /** Called after a successful login/token-refresh. */
  login(token, user) {
    setState({ token, user });
  },

  /** Wipe all auth state. */
  logout() {
    setState(null);
  },

  /** Subscribe to state changes. Returns an unsubscribe function. */
  subscribe(fn) {
    listeners.push(fn);
    return () => {
      listeners = listeners.filter((l) => l !== fn);
    };
  },
};

export default authStore;
