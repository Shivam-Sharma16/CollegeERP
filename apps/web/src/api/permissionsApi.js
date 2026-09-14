/**
 * permissionsApi — RTK Query slice for Permission Catalog & Inspection.
 *
 * Endpoints:  /api/permissions/*
 * Gateway:   user-service:4002
 */

import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQuery } from './baseQuery';

export const permissionsApi = createApi({
  reducerPath: 'permissionsApi',
  baseQuery,
  keepUnusedDataFor: 600,

  endpoints: (builder) => ({
    /** GET /api/permissions/catalog — immutable system permission catalog */
    getCatalog: builder.query({
      query: () => '/api/permissions/catalog',
      transformResponse: (response) => {
        // Unpack { success: true, data: [...] } or array directly
        const raw = response?.data ?? response;
        return Array.isArray(raw) ? raw : [];
      },
    }),

    /** GET /api/roles/my-permissions — permissions for the authenticated caller */
    getMyPermissions: builder.query({
      query: () => '/api/roles/my-permissions',
      transformResponse: (response) => response?.data?.permissions ?? response?.permissions ?? [],
    }),
  }),
});

export const {
  useGetCatalogQuery,
  useGetMyPermissionsQuery,
} = permissionsApi;
