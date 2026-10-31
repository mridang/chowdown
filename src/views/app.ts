/**
 * @packageDocumentation
 *
 * What the Views of this app have of their own: the tool arguments that say
 * what a call was for, the colours, and the rules for the recipe card and its
 * fullscreen layout. Everything else in `src/views/` is the same in every app.
 */

import type { ThemePalette } from '@/views/palette';

/**
 * The tool arguments that name what a call was asked for, best first: the
 * recipe `name`, or the search `query`. A View shows the first one given while
 * it waits.
 */
export const REQUEST_ARGUMENTS: readonly string[] = ['name', 'query'];

/** The light theme. */
export const LIGHT_PALETTE: ThemePalette = {
  accent: '#b45309',
  accentStrong: '#92400e',
  accentInk: '#b45309',
  accentSoft: '#fef1d6',
  accentText: '#8a4b06',
  tealSoft: '#d4f3ee',
  tealText: '#0f6b61',
  violetSoft: '#e7e1fd',
  violetText: '#5b34c7',
  fallbackSurface: '#fbfaf8',
  fallbackText: '#1f2430',
  fallbackMuted: '#5b6270',
};

/** The dark theme. */
export const DARK_PALETTE: ThemePalette = {
  accent: '#b45309',
  accentStrong: '#92400e',
  accentInk: '#fbbf24',
  accentSoft: '#42320f',
  accentText: '#f7c572',
  tealSoft: '#113b37',
  tealText: '#7fe0d3',
  violetSoft: '#2c2350',
  violetText: '#c3b0f7',
  fallbackSurface: '#252528',
  fallbackText: '#ececed',
  fallbackMuted: '#a8a8b0',
};

/** The rules for the recipe card and its fullscreen layout. */
export const APP_STYLES = `
/* --- fullscreen recipe --- */
.full { max-width: 860px; margin:0 auto;
  padding: calc(6px + var(--safe-top, 0px)) calc(6px + var(--safe-right, 0px))
    calc(6px + var(--safe-bottom, 0px)) calc(6px + var(--safe-left, 0px)); }
.full:focus { outline: none; }
html[data-fixed-height] .full { min-height: 100vh; }
.full .title { font-size:1.875rem; }
.cols { display:grid; grid-template-columns:1fr; gap:22px; margin-top:18px; }
@media (min-width:660px){ .cols { grid-template-columns: 17rem 1fr; align-items:start; } }
.panel { background: var(--surface); border:1px solid var(--border); border-radius: var(--radius); padding:18px; }
.h2 { margin:0 0 12px; font-size:.6875rem; font-weight:700; letter-spacing:.09em; text-transform:uppercase; color: var(--muted); }
.h2.spaced { margin-top:20px; }
.ings, .cooks { margin:0; padding:0; list-style-type:""; }
.ing { display:flex; justify-content:space-between; gap:12px; padding:7px 0; border-bottom:1px solid var(--border); font-size:.84375rem; }
.ing:last-child { border-bottom:0; }
.ing .q { color: var(--muted); white-space:nowrap; }
.cook { padding:5px 0; font-size:.84375rem; }
ol.steps { margin:0; padding:0; list-style-type:""; }
.step { display:flex; gap:13px; padding:13px 0; border-bottom:1px solid var(--border); }
.step:last-child { border-bottom:0; }
.num { flex:none; width:27px; height:27px; display:grid; place-items:center; border-radius:50%;
  background: var(--accent); color: var(--on-accent); font-weight:700; font-size:.8125rem; }
.step p { margin:0; line-height:1.6; }
.tok-ing { background: var(--accent-soft); color: var(--accent-text); border-radius:5px; padding:1px 6px; font-weight:600; }
.tok-ing .tok-q { font-weight:500; opacity:.85; }
.tok-cook { background: var(--teal-soft); color: var(--teal-text); border-radius:5px; padding:1px 6px; font-weight:600; }
.tok-timer { background: var(--violet-soft); color: var(--violet-text); border-radius:5px; padding:1px 6px; font-weight:600; }
.logs { margin-top:22px; }
.log { font-size:.8125rem; padding:8px 0; border-bottom:1px solid var(--border); }
.log:last-child { border-bottom:0; }
.log .d { color: var(--muted); font-size:.6875rem; font-weight:600; }
`;
