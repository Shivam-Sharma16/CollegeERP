import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQuery } from './baseQuery';
import { patchTheme } from '../features/ui/themeSlice';

export const settingsApi = createApi({
  reducerPath: 'settingsApi',
  baseQuery,
  tagTypes: ['ThemeConfig'],

  endpoints: (builder) => ({
    getThemeConfig: builder.query({
      query: () => '/api/settings/theme',
      providesTags: ['ThemeConfig'],
    }),

    updateThemeConfig: builder.mutation({
      query: (body) => ({
        url: '/api/settings/theme',
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['ThemeConfig'],
      // We can optionally dispatch patchTheme right here, or let the component do it 
      // or let the global loadTheme thunk handle it on reload.
      // Phase 33 says: "saving new colors here changes the sidebar/button colors across the *entire app* on next load". 
      // So we don't strictly need to do an immediate dispatch here.
    }),
  }),
});

export const { useGetThemeConfigQuery, useUpdateThemeConfigMutation } = settingsApi;
