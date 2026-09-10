/**
 * feesApi — RTK Query slice for fees-service.
 *
 * Endpoint:  /api/fees/*
 * Gateway:   fees-service:4006
 *
 * tagTypes:  FeeStructure | Payment | Defaulter
 *
 * Note: the payment webhook endpoint is server-to-server only (payment gateway
 * → fees-service). It is NOT called from the frontend, so it's not defined here.
 */

import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQuery } from './baseQuery';

export const feesApi = createApi({
  reducerPath: 'feesApi',
  baseQuery,
  tagTypes: ['FeeStructure', 'Payment', 'Defaulter'],
  keepUnusedDataFor: 120,

  endpoints: (builder) => ({

    // ── FEE STRUCTURES ────────────────────────────────────────────────────────

    /**
     * POST /api/fees/fee-structures
     * ADMIN/SUPERADMIN only (HOD for their own dept if they have write permission).
     * Body: { departmentId, year, totalAmount, installments: [{ dueDate, amount }] }
     */
    createFeeStructure: builder.mutation({
      query: (body) => ({ url: '/api/fees/fee-structures', method: 'POST', body }),
      invalidatesTags: [{ type: 'FeeStructure', id: 'LIST' }],
    }),

    /** GET /api/fees/fee-structures?departmentId=&year= */
    listFeeStructures: builder.query({
      query: (params = {}) => ({ url: '/api/fees/fee-structures', params }),
      providesTags: (r) =>
        r?.data
          ? [
              ...r.data.map(({ _id }) => ({ type: 'FeeStructure', id: _id })),
              { type: 'FeeStructure', id: 'LIST' },
            ]
          : [{ type: 'FeeStructure', id: 'LIST' }],
    }),

    /** GET /api/fees/fee-structures/:id */
    getFeeStructure: builder.query({
      query: (id) => `/api/fees/fee-structures/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'FeeStructure', id }],
    }),

    // ── PAYMENTS ──────────────────────────────────────────────────────────────

    /**
     * GET /api/fees/payments?studentId=
     * Student sees their own payments (server scoped); Admin/HOD can pass any studentId.
     */
    listPayments: builder.query({
      query: (params = {}) => ({ url: '/api/fees/payments', params }),
      providesTags: (r) =>
        r?.data
          ? [
              ...r.data.map(({ _id }) => ({ type: 'Payment', id: _id })),
              { type: 'Payment', id: 'LIST' },
            ]
          : [{ type: 'Payment', id: 'LIST' }],
    }),

    /**
     * GET /api/fees/payments/:id/receipt
     * Streams a PDF. The component opens this URL in a new tab rather than
     * using the RTK Query result directly.
     */
    getReceiptUrl: builder.query({
      // Returns a signed URL to the PDF, not the PDF bytes.
      query: (paymentId) => `/api/fees/payments/${paymentId}/receipt`,
      providesTags: (_r, _e, paymentId) => [{ type: 'Payment', id: paymentId }],
    }),

    /**
     * GET /api/fees/students/me/status
     * Returns personal fee status for a student (pending amount, upcoming installments).
     */
    getOwnFeeStatus: builder.query({
      query: () => '/api/fees/students/me/status',
      providesTags: ['Payment', 'FeeStructure'],
    }),

    getOwnFeeStructure: builder.query({
      query: () => '/api/fees/students/me/status',
      providesTags: ['Payment', 'FeeStructure'],
    }),

    initiatePayment: builder.mutation({
      query: (body) => ({ url: '/api/fees/payments/initiate', method: 'POST', body }),
      invalidatesTags: ['Payment'],
    }),

    getReceipt: builder.query({
      query: (paymentId) => ({
        url: `/api/fees/payments/${paymentId}/receipt`,
        responseHandler: (response) => response.blob(),
      }),
    }),

    // ── DEFAULTERS ────────────────────────────────────────────────────────────

    /**
     * GET /api/fees/defaulters?departmentId=&year=
     * ADMIN/HOD only. Returns students with at least one overdue installment.
     */
    getDefaulters: builder.query({
      query: (params = {}) => ({ url: '/api/fees/defaulters', params }),
      providesTags: [{ type: 'Defaulter', id: 'LIST' }],
    }),

    /**
     * GET /api/fees/collection-summary
     * Returns total fees collected this month and trend.
     */
    getCollectionSummary: builder.query({
      query: (params = {}) => ({ url: '/api/fees/collection-summary', params }),
      providesTags: ['Payment'],
    }),

    /**
     * GET /api/fees/reports/collection-trend
     * Returns fee collection trend over time based on filters.
     */
    getCollectionTrend: builder.query({
      query: (params = {}) => ({ url: '/api/fees/reports/collection-trend', params }),
      providesTags: ['Payment'],
    }),
  }),
});

export const {
  useCreateFeeStructureMutation,
  useListFeeStructuresQuery,
  useGetFeeStructureQuery,
  useListPaymentsQuery,
  useGetReceiptUrlQuery,
  useGetDefaultersQuery,
  useGetCollectionSummaryQuery,
  useGetCollectionTrendQuery,
  useGetOwnFeeStatusQuery,
  useGetOwnFeeStructureQuery,
  useInitiatePaymentMutation,
  useGetReceiptQuery,
} = feesApi;
