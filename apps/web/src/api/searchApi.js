import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQuery } from './baseQuery';

export const searchApi = createApi({
  reducerPath: 'searchApi',
  baseQuery,
  endpoints: (builder) => ({
    globalSearch: builder.query({
      async queryFn(q, _queryApi, _extraOptions, fetchWithBQ) {
        if (!q || q.length < 2) return { data: { users: [], notices: [] } };

        try {
          const [usersRes, noticesRes] = await Promise.all([
            fetchWithBQ(`/api/users/search?q=${encodeURIComponent(q)}`),
            fetchWithBQ(`/api/notices/search?q=${encodeURIComponent(q)}`)
          ]);

          return {
            data: {
              users: usersRes.data?.data || [],
              notices: noticesRes.data?.data || []
            }
          };
        } catch (error) {
          return { error };
        }
      }
    })
  })
});

export const { useGlobalSearchQuery } = searchApi;
