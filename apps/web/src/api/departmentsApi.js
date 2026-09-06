/**
 * departmentsApi — RTK Query slice for department management.
 *
 * Endpoint:  /api/departments/*
 * Gateway:   academic-service (or user-service, confirm in gateway config)
 *
 * tagTypes:  Department | DeptTree
 *
 * `resolveDeptTree` returns the full hierarchy (dept → years → semesters →
 * sections) used when building dropdowns that require the full academic tree.
 */

import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQuery } from './baseQuery';

export const departmentsApi = createApi({
  reducerPath: 'departmentsApi',
  baseQuery,
  tagTypes: ['Department', 'DeptTree'],

  endpoints: (builder) => ({

    /** GET /api/departments — list all departments */
    listDepartments: builder.query({
      query: (params = {}) => ({ url: '/api/departments', params }),
      providesTags: (result) =>
        result?.data
          ? [
              ...result.data.map(({ _id }) => ({ type: 'Department', id: _id })),
              { type: 'Department', id: 'LIST' },
            ]
          : [{ type: 'Department', id: 'LIST' }],
    }),

    /** GET /api/departments/:id — single department */
    getDepartment: builder.query({
      query: (id) => `/api/departments/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Department', id }],
    }),

    /** POST /api/departments — ADMIN/SUPERADMIN only */
    createDepartment: builder.mutation({
      query: (body) => ({ url: '/api/departments', method: 'POST', body }),
      invalidatesTags: [
        { type: 'Department', id: 'LIST' },
        { type: 'DeptTree',   id: 'TREE' },
      ],
    }),

    /** PATCH /api/departments/:id */
    updateDepartment: builder.mutation({
      query: ({ id, ...body }) => ({
        url:    `/api/departments/${id}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'Department', id },
        { type: 'Department', id: 'LIST' },
        { type: 'DeptTree',   id: 'TREE' },
      ],
    }),

    /** DELETE /api/departments/:id — SUPERADMIN only */
    deleteDepartment: builder.mutation({
      query: (id) => ({ url: `/api/departments/${id}`, method: 'DELETE' }),
      invalidatesTags: [
        { type: 'Department', id: 'LIST' },
        { type: 'DeptTree',   id: 'TREE' },
      ],
    }),

    /**
     * GET /api/departments/tree
     * Returns the full academic hierarchy:
     * { departments: [{ ..., years: [{ ..., semesters: [{ ..., sections: [] }] }] }] }
     *
     * Used by dropdowns in session creation, marks entry, fee structure forms, etc.
     */
    resolveDeptTree: builder.query({
      query: () => '/api/departments/tree',
      providesTags: [{ type: 'DeptTree', id: 'TREE' }],
    }),
  }),
});

export const {
  useListDepartmentsQuery,
  useGetDepartmentQuery,
  useCreateDepartmentMutation,
  useUpdateDepartmentMutation,
  useDeleteDepartmentMutation,
  useResolveDeptTreeQuery,
} = departmentsApi;
