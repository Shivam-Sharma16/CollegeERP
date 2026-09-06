/**
 * notificationUiSlice — local UI state for the notification bell.
 *
 * Rule: the actual notification DOCUMENTS live in notificationApi's RTK Query
 * cache — never duplicate them here. This slice only owns:
 *   - `bellOpen`    : whether the dropdown is visible
 *   - `unreadCount` : a denormalised count synced from notificationApi responses
 *                     (saved here so the bell badge can render without a
 *                      full re-query on every route change)
 *
 * The count is kept in sync via `extraReducers` that listens to the
 * `listNotifications` RTK Query fulfilled action.
 */

import { createSlice } from '@reduxjs/toolkit';
import { notificationApi } from '../../api/notificationApi';

const initialState = {
  bellOpen:    false,
  unreadCount: 0,
};

const notificationUiSlice = createSlice({
  name: 'notificationUi',
  initialState,
  reducers: {
    toggleBell(state) {
      state.bellOpen = !state.bellOpen;
    },
    setBellOpen(state, { payload }) {
      state.bellOpen = Boolean(payload);
    },
    /** Manual override — used when a new socket push arrives. */
    incrementUnread(state) {
      state.unreadCount += 1;
    },
    setUnreadCount(state, { payload }) {
      state.unreadCount = Number(payload);
    },
  },
  extraReducers: (builder) => {
    /**
     * Whenever the notificationApi list query resolves, recount unread
     * from the full response rather than tracking diffs.
     */
    builder.addMatcher(
      notificationApi.endpoints.listNotifications.matchFulfilled,
      (state, { payload }) => {
        const notifications = payload?.data ?? [];
        state.unreadCount = notifications.filter((n) => !n.read).length;
      },
    );

    /**
     * When markAllRead resolves, we know count is now 0.
     */
    builder.addMatcher(
      notificationApi.endpoints.markAllRead.matchFulfilled,
      (state) => {
        state.unreadCount = 0;
      },
    );

    /**
     * When a single notification is marked read, decrement by 1.
     */
    builder.addMatcher(
      notificationApi.endpoints.markRead.matchFulfilled,
      (state) => {
        state.unreadCount = Math.max(0, state.unreadCount - 1);
      },
    );
  },
});

export const { toggleBell, setBellOpen, incrementUnread, setUnreadCount } =
  notificationUiSlice.actions;

export default notificationUiSlice.reducer;

// ── Selectors ─────────────────────────────────────────────────────────────────
export const selectBellOpen    = (state) => state.notificationUi.bellOpen;
export const selectUnreadCount = (state) => state.notificationUi.unreadCount;
