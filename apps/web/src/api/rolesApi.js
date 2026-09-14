/**
 * rolesApi — RTK Query slice for Custom Role management.
 *
 * Endpoints:  /api/custom-roles/*
 * Gateway:   user-service:4002
 *
 * tagTypes:  CustomRole
 */

import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQuery } from './baseQuery';

export const rolesApi = createApi({
  reducerPath: 'rolesApi',
  baseQuery,
  tagTypes: ['CustomRole'],
  keepUnusedDataFor: 300,

  endpoints: (builder) => ({
    /** GET /api/custom-roles — list all custom roles with permission & assignment counts */
    listCustomRoles: builder.query({
      query: (params = {}) => ({
        url: '/api/custom-roles',
        params,
      }),
      providesTags: (result) => {
        const roles = Array.isArray(result?.data) ? result.data : Array.isArray(result) ? result : [];
        return [
          ...roles.map(({ _id }) => ({ type: 'CustomRole', id: _id })),
          { type: 'CustomRole', id: 'LIST' },
        ];
      },
      transformResponse: (response) => response?.data ?? response,
    }),

    /** POST /api/custom-roles — create a new custom role with permissions */
    createCustomRole: builder.mutation({
      query: (body) => ({
        url: '/api/custom-roles',
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'CustomRole', id: 'LIST' }],
      transformResponse: (response) => response?.data ?? response,
    }),

    /** GET /api/custom-roles/:id — retrieve single custom role */
    getCustomRoleById: builder.query({
      query: (id) => `/api/custom-roles/${id}`,
      providesTags: (_result, _err, id) => [{ type: 'CustomRole', id }],
      transformResponse: (response) => response?.data ?? response,
    }),

    /** PATCH /api/custom-roles/:id — update a custom role */
    updateCustomRole: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/api/custom-roles/${id}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_result, _err, { id }) => [
        { type: 'CustomRole', id },
        { type: 'CustomRole', id: 'LIST' },
      ],
      transformResponse: (response) => response?.data ?? response,
    }),

    /** DELETE /api/custom-roles/:id — delete custom role */
    deleteCustomRole: builder.mutation({
      query: (id) => ({
        url: `/api/custom-roles/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'CustomRole', id: 'LIST' }],
    }),
  }),
});

export const {
  useListCustomRolesQuery,
  useCreateCustomRoleMutation,
  useGetCustomRoleByIdQuery,
  useUpdateCustomRoleMutation,
  useDeleteCustomRoleMutation,
} = rolesApi;
