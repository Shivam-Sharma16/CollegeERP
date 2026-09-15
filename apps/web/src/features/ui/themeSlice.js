/**
 * themeSlice — loads `public/theme.config.json` and injects CSS custom
 * properties onto `:root`, re-skinning the entire app with zero component edits.
 *
 * Flow:
 *   1. `main.jsx` calls `store.dispatch(loadTheme())` before first render.
 *   2. `loadTheme` fetches `/theme.config.json` (served as a static asset).
 *   3. `configToCssVars()` maps the nested JSON structure → flat CSS variable map.
 *   4. `applyThemeToDom()` writes every `--*` key as an inline style on `:root`.
 *   5. `applyInstitutionMeta()` sets `document.title` and the favicon `<link>`.
 *
 * Swapping only `theme.config.json` and reloading the page re-skins every
 * button, accent, link, and surface colour — no CSS or JSX edits needed.
 *
 * theme.config.json shape:
 * {
 *   "institution": {
 *     "name":       "Demo College",
 *     "logoUrl":    "/logo.svg",
 *     "faviconUrl": "/favicon.ico"
 *   },
 *   "colors": {
 *     "primary":          "#6366f1",
 *     "primaryLight":     "#818cf8",
 *     "secondary":        "#22d3ee",
 *     "surface":          "#1a1d2e",
 *     "surfaceElevated":  "#232741",
 *     "bg":               "#0f1117",
 *     "border":           "#2e3455",
 *     "text":             "#e2e8f0",
 *     "textMuted":        "#94a3b8",
 *     "danger":           "#f43f5e",
 *     "success":          "#10b981",
 *     "warning":          "#f59e0b"
 *   },
 *   "fonts": {
 *     "heading":  "Inter",
 *     "body":     "Inter",
 *     "importUrl": "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap"
 *   },
 *   "radius": {
 *     "sm": "6px",
 *     "md": "12px",
 *     "lg": "20px"
 *   }
 * }
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

// ── CSS variable defaults (mirror tokens.css) ──────────────────────────────────
// Exported so consumers (e.g. InstitutionSettings) can reference canonical defaults
// without duplicating hex literals.
export const DEFAULT_COLORS = {
  primary:         '#4f46e5',
  primaryLight:    '#6366f1',
  secondary:       '#06b6d4',
  surface:         '#ffffff',
  surfaceElevated: '#f8fafc',
  bg:              '#f1f5f9',
  border:          '#e2e8f0',
  text:            '#0f172a',
  textMuted:       '#64748b',
  danger:          '#ef4444',
  success:         '#10b981',
  warning:         '#f59e0b',
};

const CSS_DEFAULTS = {
  '--color-primary':          '#4f46e5',
  '--color-primary-light':    '#6366f1',
  '--color-secondary':        '#06b6d4',
  '--color-surface':          '#ffffff',
  '--color-surface-elevated': '#f8fafc',
  '--color-bg':               '#f1f5f9',
  '--color-border':           '#e2e8f0',
  '--color-text':             '#0f172a',
  '--color-text-muted':       '#64748b',
  '--color-danger':           '#ef4444',
  '--color-success':          '#10b981',
  '--color-warning':          '#f59e0b',
  '--font-heading':           "'Inter', system-ui, sans-serif",
  '--font-body':              "'Inter', system-ui, sans-serif",
  '--radius-sm':              '6px',
  '--radius-md':              '12px',
  '--radius-lg':              '20px',
  '--spacing-1':              '0.25rem',
  '--spacing-2':              '0.5rem',
  '--spacing-3':              '0.75rem',
  '--spacing-4':              '1rem',
  '--spacing-5':              '1.25rem',
  '--spacing-6':              '1.5rem',
  '--spacing-7':              '1.75rem',
  '--spacing-8':              '2rem',
  '--shadow-sm':              '0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04)',
  '--shadow-md':              '0 4px 12px -1px rgba(0,0,0,.08), 0 2px 6px -1px rgba(0,0,0,.04)',
  '--shadow-lg':              '0 12px 24px -2px rgba(0,0,0,.10), 0 4px 8px -2px rgba(0,0,0,.04)',
  '--transition':             '160ms ease',
};

// ── Map nested theme.config.json → flat CSS variable map ──────────────────────
function configToCssVars(json) {
  const vars = { ...CSS_DEFAULTS };

  const c = json.colors ?? {};
  if (c.primary)         vars['--color-primary']          = c.primary;
  if (c.primaryLight)    vars['--color-primary-light']    = c.primaryLight;
  if (c.secondary)       vars['--color-secondary']        = c.secondary;
  if (c.surface)         vars['--color-surface']          = c.surface;
  if (c.surfaceElevated) vars['--color-surface-elevated'] = c.surfaceElevated;
  if (c.bg)              vars['--color-bg']               = c.bg;
  if (c.border)          vars['--color-border']           = c.border;
  if (c.text)            vars['--color-text']             = c.text;
  if (c.textMuted)       vars['--color-text-muted']       = c.textMuted;
  if (c.danger)          vars['--color-danger']           = c.danger;
  if (c.success)         vars['--color-success']          = c.success;
  if (c.warning)         vars['--color-warning']          = c.warning;

  const f = json.fonts ?? {};
  if (f.heading)
    vars['--font-heading'] = `'${f.heading}', system-ui, sans-serif`;
  if (f.body)
    vars['--font-body']    = `'${f.body}', system-ui, sans-serif`;

  const r = json.radius ?? {};
  if (r.sm) vars['--radius-sm'] = r.sm;
  if (r.md) vars['--radius-md'] = r.md;
  if (r.lg) vars['--radius-lg'] = r.lg;

  return vars;
}

// ── Apply CSS variables to :root ───────────────────────────────────────────────
function applyThemeToDom(cssVars) {
  const root = document.documentElement;
  Object.entries(cssVars).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}

// ── Apply institution metadata (title, favicon, font imports) ─────────────────
function applyInstitutionMeta(json) {
  const inst = json.institution ?? {};

  // Page title
  if (inst.name) {
    document.title = inst.name;
  }

  // Favicon
  if (inst.faviconUrl) {
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = inst.faviconUrl;
  }

  // Dynamic font import (if the theme uses a non-default font)
  const importUrl = json.fonts?.importUrl;
  if (importUrl) {
    const existing = document.querySelector(`link[href="${importUrl}"]`);
    if (!existing) {
      const fontLink = document.createElement('link');
      fontLink.rel  = 'stylesheet';
      fontLink.href = importUrl;
      document.head.appendChild(fontLink);
    }
  }
}

// Helper to derive lighter tint for primary-light
export function adjustColorBrightness(hex, percent) {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return hex;
  let clean = hex.slice(1);
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  if (clean.length !== 6) return hex;
  const num = parseInt(clean, 16);
  if (isNaN(num)) return hex;
  let r = (num >> 16) + Math.round(255 * (percent / 100));
  let g = ((num >> 8) & 0x00FF) + Math.round(255 * (percent / 100));
  let b = (num & 0x0000FF) + Math.round(255 * (percent / 100));
  r = Math.min(255, Math.max(0, r));
  g = Math.min(255, Math.max(0, g));
  b = Math.min(255, Math.max(0, b));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

// Subdomain & tenant detection helper
export function detectTenantSubdomain() {
  if (typeof window === 'undefined') return null;

  // 1. Path-based detection: /inst/:slug/...
  const pathMatch = window.location.pathname.match(/^\/inst\/([a-z0-9-]+)/i);
  if (pathMatch && pathMatch[1]) {
    return pathMatch[1].toLowerCase();
  }

  // 2. Query param: ?subdomain=...
  const urlParams = new URLSearchParams(window.location.search);
  const querySub = urlParams.get('subdomain') || urlParams.get('tenant');
  if (querySub) {
    return querySub.toLowerCase().trim();
  }

  // 3. Subdomain-based detection from hostname:
  // e.g. jecrc.collegeerp.com -> jecrc, apex-tech.localhost -> apex-tech
  const hostname = window.location.hostname;
  const parts = hostname.split('.');
  if (parts.length > 2 || (parts.length === 2 && parts[1] === 'localhost')) {
    const sub = parts[0].toLowerCase().trim();
    if (!['www', 'localhost', '127', 'collegeerp', 'app', 'portal', 'api', 'admin'].includes(sub)) {
      return sub;
    }
  }

  return null;
}

// ── Async thunk ────────────────────────────────────────────────────────────────
export const loadTheme = createAsyncThunk('theme/load', async (targetSubdomain) => {
  const subdomain = targetSubdomain || detectTenantSubdomain();

  if (subdomain) {
    try {
      const baseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
      const res = await fetch(`${baseUrl}/api/institutions/branding?subdomain=${encodeURIComponent(subdomain)}`, {
        headers: {
          'x-tenant-subdomain': subdomain,
        },
      });
      if (res.ok) {
        const json = await res.json();
        const data = json?.data || json;
        if (data && (data.name || data.primaryColor)) {
          const primary = data.primaryColor || '#4f46e5';
          const secondary = data.secondaryColor || '#06b6d4';
          const primaryLight = adjustColorBrightness(primary, 25);

          const cssVars = {
            ...CSS_DEFAULTS,
            '--color-primary': primary,
            '--color-primary-light': primaryLight,
            '--color-secondary': secondary,
          };

          const raw = {
            institution: {
              name: data.name,
              logoUrl: data.logoUrl || data.branding?.logoUrl || null,
              faviconUrl: data.faviconUrl || data.branding?.faviconUrl || null,
              coverImageUrl: data.coverImageUrl || data.branding?.coverImageUrl || null,
            },
            colors: {
              primary,
              primaryLight,
              secondary,
            },
          };

          return { cssVars, raw };
        }
      }
    } catch (fetchErr) {
      console.warn('[themeSlice] Failed to fetch institution branding, falling back to theme.config.json:', fetchErr);
    }
  }

  try {
    const res = await fetch('/theme.config.json');
    if (!res.ok) return { cssVars: CSS_DEFAULTS, raw: {} };
    const json = await res.json();
    return { cssVars: configToCssVars(json), raw: json };
  } catch {
    return { cssVars: CSS_DEFAULTS, raw: {} };
  }
});

// ── Slice ──────────────────────────────────────────────────────────────────────
const themeSlice = createSlice({
  name: 'theme',
  initialState: {
    cssVars:     CSS_DEFAULTS,
    institution: {},      // { name, logoUrl, faviconUrl }
    loading:     false,
  },
  reducers: {
    /**
     * Apply a partial CSS variable patch immediately.
     * Keys must be canonical `--*` names (e.g. `'--color-primary': '#ff0000'`).
     * Used by a future "theme editor" admin page.
     */
    patchTheme(state, { payload }) {
      state.cssVars = { ...state.cssVars, ...payload };
      applyThemeToDom(state.cssVars);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadTheme.pending, (state) => {
        state.loading = true;
      })
      .addCase(loadTheme.fulfilled, (state, { payload }) => {
        state.loading     = false;
        state.cssVars     = payload.cssVars;
        state.institution = payload.raw?.institution ?? {};
        applyThemeToDom(payload.cssVars);
        applyInstitutionMeta(payload.raw ?? {});
      })
      .addCase(loadTheme.rejected, (state) => {
        state.loading = false;
        applyThemeToDom(state.cssVars); // apply defaults anyway
      });
  },
});

export const { patchTheme } = themeSlice.actions;
export default themeSlice.reducer;

// ── Selectors ─────────────────────────────────────────────────────────────────
export const selectThemeCssVars    = (state) => state.theme.cssVars;
export const selectInstitution     = (state) => state.theme.institution;
export const selectInstitutionName = (state) => state.theme.institution?.name ?? 'ERP Portal';
export const selectInstitutionLogo = (state) => state.theme.institution?.logoUrl ?? null;
export const selectInstitutionCoverImage = (state) => state.theme.institution?.coverImageUrl ?? null;
export const selectThemeLoading    = (state) => state.theme.loading;
