/**
 * Central Axios-style fetch wrapper for all API calls.
 *
 * Base URL is sourced from VITE_API_URL (points to the API Gateway).
 * Every request automatically attaches the JWT from authStore.
 * 401 responses clear auth state and redirect to /login.
 */

import authStore from '../store/authStore';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

async function request(method, path, { body, params } = {}) {
  const token = authStore.getToken();

  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, v);
    });
  }

  const res = await fetch(url.toString(), {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (res.status === 401) {
    authStore.logout();
    window.location.replace('/login');
    return;
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(data?.message ?? data?.error ?? `HTTP ${res.status}`);
    err.status = res.status;
    err.data   = data;
    throw err;
  }

  return data;
}

const api = {
  get:    (path, opts)  => request('GET',    path, opts),
  post:   (path, body, opts)  => request('POST',   path, { body, ...opts }),
  patch:  (path, body, opts)  => request('PATCH',  path, { body, ...opts }),
  put:    (path, body, opts)  => request('PUT',    path, { body, ...opts }),
  delete: (path, opts)  => request('DELETE', path, opts),
};

export default api;
