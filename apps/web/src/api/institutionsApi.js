import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQuery } from './baseQuery';

export const institutionsApi = createApi({
  reducerPath: 'institutionsApi',
  baseQuery,
  tagTypes: ['Institution'],
  endpoints: (builder) => ({
    listInstitutions: builder.query({
      query: () => '/api/institutions',
      transformResponse: (response) => response?.data ?? response ?? [],
      providesTags: ['Institution'],
    }),

    resolveInstitutionBySlug: builder.query({
      query: (slug) => `/api/institutions/resolve/${slug}`,
      transformResponse: (response) => response?.data ?? response,
    }),

    getInstitutionBranding: builder.query({
      query: (subdomain) => ({
        url: '/api/institutions/branding',
        params: subdomain ? { subdomain } : undefined,
        headers: subdomain ? { 'x-tenant-subdomain': subdomain } : undefined,
      }),
      transformResponse: (response) => response?.data ?? response,
    }),

    getInstitutionById: builder.query({
      query: (id) => `/api/institutions/${id}`,
      transformResponse: (response) => response?.data ?? response,
      providesTags: (result, error, id) => [{ type: 'Institution', id }],
    }),

    createInstitution: builder.mutation({
      query: (body) => ({
        url: '/api/institutions',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Institution'],
    }),

    updateInstitution: builder.mutation({
      query: ({ id, ...patch }) => ({
        url: `/api/institutions/${id}`,
        method: 'PATCH',
        body: patch,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Institution', id }, 'Institution'],
    }),

    checkSubdomainAvailability: builder.query({
      query: (subdomain) => `/api/institutions/check-subdomain?subdomain=${encodeURIComponent(subdomain)}`,
      transformResponse: (response) => response?.data ?? response,
    }),
  }),
});

export const {
  useListInstitutionsQuery,
  useResolveInstitutionBySlugQuery,
  useGetInstitutionBrandingQuery,
  useGetInstitutionByIdQuery,
  useCreateInstitutionMutation,
  useUpdateInstitutionMutation,
  useCheckSubdomainAvailabilityQuery,
  useLazyCheckSubdomainAvailabilityQuery,
} = institutionsApi;
