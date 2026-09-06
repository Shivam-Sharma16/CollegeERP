/**
 * themeSlice — loaded theme config values applied as CSS custom properties.
 *
 * Flow:
 *   1. On app boot, `loadTheme()` thunk reads from `/theme.config.json`
 *      (or falls back to defaults).
 *   2. `applyThemeToDom()` writes every key as a CSS variable to :root so that
 *      all CSS modules pick them up without a re-render.
 *   3. Components that need to read theme values can use `selectThemeConfig`.
 *
 * No server data lives here — theme config is a static JSON file served by
 * the frontend build, not a backend API response.
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

// ── Defaults ───────────────────────────────────────────────────────────────────
const DEFAULTS = {
  '--color-primary':    '#6366f1',
  '--color-accent':     '#22d3ee',
  '--color-bg':         '#0f1117',
  '--color-surface':    '#1a1d2e',
  '--color-surface-2':  '#232741',
  '--color-border':     '#2e3455',
  '--color-text':       '#e2e8f0',
  '--color-text-muted': '#94a3b8',
};

// ── DOM helper ─────────────────────────────────────────────────────────────────
function applyThemeToDom(config) {
  const root = document.documentElement;
  Object.entries(config).forEach(([key, value]) => {
    if (key.startsWith('--')) root.style.setProperty(key, value);
  });
}

// ── Async thunk ────────────────────────────────────────────────────────────────
export const loadTheme = createAsyncThunk('theme/load', async () => {
  try {
    const res = await fetch('/theme.config.json');
    if (!res.ok) return DEFAULTS;
    const json = await res.json();
    return { ...DEFAULTS, ...json };
  } catch {
    return DEFAULTS;
  }
});

// ── Slice ──────────────────────────────────────────────────────────────────────
const themeSlice = createSlice({
  name: 'theme',
  initialState: {
    config:  DEFAULTS,
    loading: false,
  },
  reducers: {
    /** Merge an arbitrary config patch and apply to DOM immediately. */
    setThemeConfig(state, { payload }) {
      state.config = { ...state.config, ...payload };
      applyThemeToDom(state.config);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadTheme.pending, (state) => { state.loading = true; })
      .addCase(loadTheme.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.config  = payload;
        applyThemeToDom(payload);
      })
      .addCase(loadTheme.rejected, (state) => {
        state.loading = false;
        applyThemeToDom(state.config); // apply defaults anyway
      });
  },
});

export const { setThemeConfig } = themeSlice.actions;
export default themeSlice.reducer;

// ── Selectors ─────────────────────────────────────────────────────────────────
export const selectThemeConfig  = (state) => state.theme.config;
export const selectThemeLoading = (state) => state.theme.loading;
