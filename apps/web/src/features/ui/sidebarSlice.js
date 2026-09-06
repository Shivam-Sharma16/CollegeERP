/**
 * sidebarSlice — client-only UI state for the sidebar.
 *
 * - `collapsed`  : whether the sidebar is in narrow icon-only mode
 * - `activeKey`  : the nav item key currently highlighted
 *
 * No server data lives here. This is pure local UI state.
 */

import { createSlice } from '@reduxjs/toolkit';

const SIDEBAR_KEY = 'erp_sidebar';

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(SIDEBAR_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const stored = loadFromStorage();

const initialState = {
  collapsed: stored?.collapsed ?? false,
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
