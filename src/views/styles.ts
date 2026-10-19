/**
 * @packageDocumentation
 *
 * Shared stylesheet for the chowdown MCP Apps Views (recipe card + list). One
 * cohesive design system so every surface in the chat client looks like the
 * same product. Structure (background, text, borders, font) follows the host's
 * theme variables, applied by the hook from the host context; the brand colours
 * come from {@link LIGHT_PALETTE} / {@link DARK_PALETTE}. Dark mode follows the
 * HOST's theme (the `data-theme` attribute the SDK sets), not the operating
 * system's, and only falls back to the operating system when the host sent no
 * theme at all.
 */

import {
  DARK_PALETTE,
  LIGHT_PALETTE,
  ON_ACCENT,
  type ThemePalette,
} from './palette';

/** The custom properties that differ between the light and dark themes. */
function themeVariables(palette: ThemePalette): string {
  return `
  --surface: var(--color-background-secondary, ${palette.fallbackSurface});
  --text: var(--color-text-primary, ${palette.fallbackText});
  --muted: var(--color-text-secondary, ${palette.fallbackMuted});
  --accent: ${palette.accent};
  --accent-strong: ${palette.accentStrong};
  --accent-ink: ${palette.accentInk};
  --accent-soft: ${palette.accentSoft};
  --accent-text: ${palette.accentText};
  --teal-soft: ${palette.tealSoft}; --teal-text: ${palette.tealText};
  --violet-soft: ${palette.violetSoft}; --violet-text: ${palette.violetText};`;
}

/** The stylesheet every View includes. */
export const STYLES = `
:root {
  color-scheme: light dark;${themeVariables(LIGHT_PALETTE)}
  --surface-2: color-mix(in srgb, var(--text) 5%, transparent);
  --border: color-mix(in srgb, var(--text) 13%, transparent);
  --on-accent: ${ON_ACCENT};
  --radius: var(--border-radius-xl, 16px);
  --radius-sm: var(--border-radius-md, 10px);
}
:root[data-theme="dark"] {${themeVariables(DARK_PALETTE)}
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) {${themeVariables(DARK_PALETTE)}
  }
}
* { box-sizing: border-box; }
html, body { background: transparent; }
body { margin: 0; color: var(--text);
  font: var(--font-text-sm-size, .875rem)/1.5 var(--font-sans, var(--font-family, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif));
  -webkit-font-smoothing: antialiased; }
:focus-visible { outline: 2px solid var(--color-ring-primary, var(--accent)); outline-offset: 2px; }
button { font: inherit; }

/* Room kept clear of the notch, the chat composer and rounded corners. The base
   4px is the focus ring's width plus its offset: the frame clips at its edge,
   so anything flush against it would lose the ring. */
.wrap { padding: calc(4px + var(--safe-top, 0px)) calc(4px + var(--safe-right, 0px))
  calc(4px + var(--safe-bottom, 0px)) calc(4px + var(--safe-left, 0px)); }

/* Lists draw no markers. An empty-string marker rather than none: WebKit
   (Safari, VoiceOver) stops announcing a list as a list when its style is
   none, but keeps doing so for an empty marker, and nothing is drawn either way. */

/* --- card --- */
.card { background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 18px 20px;
  box-shadow: 0 1px 2px rgba(0,0,0,.04), 0 6px 20px -12px rgba(0,0,0,.14); }
.eyebrow { display:flex; align-items:center; gap:7px; font-size:.6875rem; font-weight:700;
  letter-spacing:.09em; text-transform:uppercase; color: var(--accent-ink); margin-bottom: 8px; }
.eyebrow .dot { width:7px; height:7px; border-radius:50%; background: var(--accent-ink); }
.title { margin:0; font-size:1.3125rem; font-weight:750; letter-spacing:-.015em; line-height:1.2; }
.meta { margin-top:7px; display:flex; flex-wrap:wrap; align-items:center; gap:6px 10px;
  font-size:.78125rem; color: var(--muted); }
.meta .sep { opacity:.4; }
.meta b { font-weight:600; color: var(--text); opacity:.8; text-transform:capitalize; }
.badge { display:inline-flex; align-items:center; padding:2px 8px; border-radius:999px;
  font-size:.625rem; font-weight:700; letter-spacing:.05em; text-transform:uppercase;
  background: var(--accent-soft); color: var(--accent-text); }
.chips { margin-top:14px; display:flex; flex-wrap:wrap; gap:6px; padding:0; list-style-type:""; }
.chip { padding:4px 10px; border-radius:999px; font-size:.75rem; font-weight:600;
  background: var(--accent-soft); color: var(--accent-text); white-space:nowrap; }
.chip.more { background: var(--surface-2); color: var(--muted); }
.actions { margin-top:18px; display:flex; flex-wrap:wrap; gap:9px; }
.btn { border:0; border-radius: var(--radius-sm); padding:10px 18px; min-height:44px; font-size:.8125rem;
  font-weight:650; cursor:pointer; background: var(--accent); color: var(--on-accent);
  box-shadow: 0 1px 2px rgba(0,0,0,.12); transition: background .12s, transform .06s; }
.btn:hover { background: var(--accent-strong); }
.btn:active { transform: translateY(1px); }
.btn.ghost { background: var(--surface-2); color: var(--text); box-shadow:none; }
.btn.ghost:hover { background: color-mix(in srgb, var(--text) 10%, transparent); }
.link { background:none; border:0; padding:0; min-height:44px; color: var(--accent-ink); cursor:pointer;
  text-decoration: underline; text-underline-offset: 3px; font-size:.8125rem; }

/* --- loading, empty and failed states --- */
.skeleton { display:grid; gap:10px; }
.skeleton .bar { height:12px; border-radius:6px; background: var(--surface-2);
  animation: pulse 1.4s ease-in-out infinite; }
.skeleton .bar.title-bar { height:20px; width:60%; }
.skeleton .bar.short { width:40%; }
@keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:.45; } }
.status-line { color: var(--muted); font-size:.78125rem; margin-top:12px; }
.notice { margin:0; line-height:1.55; white-space:pre-line; }
.card.error { border-color: var(--color-border-danger, #a73d39); }
.card.error .eyebrow { color: var(--color-text-danger, #a73d39); }
.card.error .eyebrow .dot { background: var(--color-text-danger, #a73d39); }

/* --- list --- */
.list-head { display:flex; align-items:baseline; justify-content:space-between; gap:10px; margin-bottom:12px; }
.list-head h1 { margin:0; font-size:1.0625rem; font-weight:700; letter-spacing:-.01em; }
.list-head .count { font-size:.78125rem; color: var(--muted); }
.grid { display:grid; grid-template-columns: 1fr; gap:9px; padding:0; margin:0; list-style-type:""; }
@media (min-width:520px){ .grid { grid-template-columns: 1fr 1fr; } }
.tile { display:flex; align-items:center; justify-content:space-between; gap:10px;
  text-align:left; width:100%; min-height:44px; background: var(--surface); border:1px solid var(--border);
  border-radius: var(--radius-sm); padding:13px 15px; cursor:pointer; color:inherit;
  transition: border-color .12s, transform .06s, box-shadow .12s; }
.tile:hover { border-color: color-mix(in srgb, var(--accent) 55%, var(--border));
  box-shadow: 0 6px 16px -12px rgba(0,0,0,.3); transform: translateY(-1px); }
.tile .name { font-weight:620; font-size:.875rem; min-width:0; overflow:hidden; overflow-wrap:anywhere;
  display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; line-clamp:2; }
.tile .arrow { color: var(--muted); flex:none; }
.tile[aria-busy="true"] { opacity:.6; cursor:progress; }
.empty { color: var(--muted); padding:20px 2px; text-align:center; }
.toolbar { display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:8px; }
.hint { margin:0; text-align:right; }
.more-row { margin-top:12px; display:flex; justify-content:center; }
.filter { display:block; width:100%; min-height:44px; margin:0 0 12px; padding:8px 12px; font:inherit;
  color: var(--text); background: var(--surface); border:1px solid var(--border); border-radius: var(--radius-sm); }
.filter::placeholder { color: var(--muted); }

/* Text only assistive technology reads (step numbers, the arrival announcement). */
.sr-only { position:absolute; width:1px; height:1px; margin:-1px; padding:0; overflow:hidden;
  clip:rect(0 0 0 0); clip-path:inset(50%); white-space:nowrap; border:0; }

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

/* People who ask their device for less motion get none. */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
  .tile:hover, .btn:active { transform: none; }
}
`;
