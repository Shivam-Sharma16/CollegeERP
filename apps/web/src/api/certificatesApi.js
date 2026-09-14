/**
 * certificatesApi — RTK Query slice for Certificate Generation.
 *
 * Endpoints:  /api/certificates/*
 * Gateway:   user-service:4002
 */

import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQuery } from './baseQuery';

export const certificatesApi = createApi({
  reducerPath: 'certificatesApi',
  baseQuery,
  tagTypes: ['Certificate'],

  endpoints: (builder) => ({
    /**
     * POST /api/certificates/:type (bonafide | transfer)
     * Generates and returns a PDF blob for the given student.
     */
    issueCertificate: builder.mutation({
      query: ({ type = 'bonafide', ...body }) => ({
        url: `/api/certificates/${type}`,
        method: 'POST',
        body,
        responseHandler: async (response) => {
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw errorData;
          }
          return response.blob();
        },
      }),
    }),
  }),
});

export const {
  useIssueCertificateMutation,
} = certificatesApi;
