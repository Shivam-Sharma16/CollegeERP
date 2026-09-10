/**
 * notificationApi — RTK Query slice for notification-service.
 *
 * Endpoint:  GET/PATCH /api/notifications/*
 * Gateway:   notification-service:4008
 *
 * This slice is defined BEFORE notificationUiSlice imports it (via the store),
 * so there is no circular dependency at module evaluation time.
 */

import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQuery } from './baseQuery';

export const notificationApi = createApi({
  reducerPath: 'notificationApi',
  baseQuery,
  tagTypes: ['Notification'],
  keepUnusedDataFor: 30,

  endpoints: (builder) => ({
    /**
     * GET /api/notifications
     * Query params: { unreadOnly?: boolean, page?: number, limit?: number }
     */
    listNotifications: builder.query({
      query: ({ unreadOnly, page = 1, limit = 20 } = {}) => ({
        url: '/api/notifications',
        params: { ...(unreadOnly ? { unreadOnly: true } : {}), page, limit },
      }),
      providesTags: (result) =>
        result?.data
          ? [
              ...result.data.map(({ _id }) => ({ type: 'Notification', id: _id })),
              { type: 'Notification', id: 'LIST' },
            ]
          : [{ type: 'Notification', id: 'LIST' }],
    }),

    /** PATCH /api/notifications/:id/read */
    markRead: builder.mutation({
      query: (id) => ({ url: `/api/notifications/${id}/read`, method: 'PATCH' }),
      invalidatesTags: (_result, _error, id) => [{ type: 'Notification', id }],
    }),

    /** PATCH /api/notifications/read-all */
    markAllRead: builder.mutation({
      query: () => ({ url: '/api/notifications/read-all', method: 'PATCH' }),
      invalidatesTags: [{ type: 'Notification', id: 'LIST' }],
    }),

    /** GET /api/notifications/unread-count */
    getUnreadCount: builder.query({
      query: () => '/api/notifications/unread-count',
      providesTags: ['Notification'],
    }),
  }),
});

export const {
  useListNotificationsQuery,
  useMarkReadMutation,
  useMarkAllReadMutation,
  useGetUnreadCountQuery,
} = notificationApi;
