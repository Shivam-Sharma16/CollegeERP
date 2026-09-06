/**
 * sidebarSlice — client-only UI state for the sidebar.
 *
 * - `collapsed`  : whether the sidebar is in narrow icon-only mode
 * - `activeKey`  : the nav item key currently highlighted
 *
 * No server data lives here. This is pure local UI state.
 */

import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  collapsed: false,
  activeKey:  null,   // e.g. 'attendance', 'results', 'fees'
};

const sidebarSlice = createSlice({
  name: 'sidebar',
  initialState,
  reducers: {
    toggleSidebar(state) {
      state.collapsed = !state.collapsed;
    },
    setSidebarCollapsed(state, { payload }) {
      state.collapsed = Boolean(payload);
    },
    setActiveKey(state, { payload }) {
      state.activeKey = payload;
    },
  },
});

export const { toggleSidebar, setSidebarCollapsed, setActiveKey } = sidebarSlice.actions;
export default sidebarSlice.reducer;

// ── Selectors ─────────────────────────────────────────────────────────────────
export const selectSidebarCollapsed = (state) => state.sidebar.collapsed;
export const selectActiveKey        = (state) => state.sidebar.activeKey;
