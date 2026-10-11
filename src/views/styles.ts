/**
 * Shared stylesheet for the chowdown MCP Apps Views (recipe card + list). One
 * cohesive design system so every surface in the chat client looks like the
 * same product. Colours prefer the host's theme variables (applied by
 * `useHostStyleVariables`) and fall back to a warm palette, with a dark-mode
 * override so it looks right in both ChatGPT and Claude.
 */

export const STYLES = `
:root {
  color-scheme: light dark;
  --bg: var(--color-background-primary, #ffffff);
  --surface: var(--color-background-secondary, #fbfaf8);
  --surface-2: color-mix(in srgb, var(--text) 4%, transparent);
  --text: var(--color-text-primary, #1f2430);
  --muted: var(--color-text-secondary, #6b7280);
  --border: color-mix(in srgb, var(--text) 11%, transparent);
  --accent: #e0820a;
  --accent-strong: #c2700a;
  --accent-soft: #fef1d6;
  --accent-text: #8a4b06;
  --teal-soft: #d4f3ee; --teal-text: #0f6b61;
  --violet-soft: #e7e1fd; --violet-text: #5b34c7;
  --radius: 16px;
  --radius-sm: 10px;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: var(--color-background-primary, #1b1b1d);
    --surface: var(--color-background-secondary, #252528);
    --text: var(--color-text-primary, #ececed);
    --muted: var(--color-text-secondary, #a0a0a8);
    --accent-soft: #42320f; --accent-text: #f7c572;
    --teal-soft: #113b37; --teal-text: #7fe0d3;
    --violet-soft: #2c2350; --violet-text: #c3b0f7;
  }
}
* { box-sizing: border-box; }
body { margin: 0; color: var(--text);
  font: 14px/1.5 var(--font-family, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif);
  -webkit-font-smoothing: antialiased; }
.wrap { padding: 1px; }

/* --- card --- */
.card { background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 18px 20px;
  box-shadow: 0 1px 2px rgba(0,0,0,.04), 0 6px 20px -12px rgba(0,0,0,.14); }
.eyebrow { display:flex; align-items:center; gap:7px; font-size:11px; font-weight:700;
  letter-spacing:.09em; text-transform:uppercase; color: var(--accent); margin-bottom: 8px; }
.eyebrow .dot { width:7px; height:7px; border-radius:50%; background: var(--accent); }
.title { margin:0; font-size:21px; font-weight:750; letter-spacing:-.015em; line-height:1.2; }
.meta { margin-top:7px; display:flex; flex-wrap:wrap; align-items:center; gap:6px 10px;
  font-size:12.5px; color: var(--muted); }
.meta .sep { opacity:.4; }
.meta b { font-weight:600; color: var(--text); opacity:.8; text-transform:capitalize; }
.badge { display:inline-flex; align-items:center; padding:2px 8px; border-radius:999px;
  font-size:10px; font-weight:700; letter-spacing:.05em; text-transform:uppercase;
  background: var(--accent-soft); color: var(--accent-text); }
.chips { margin-top:14px; display:flex; flex-wrap:wrap; gap:6px; }
.chip { padding:4px 10px; border-radius:999px; font-size:12px; font-weight:600;
  background: var(--accent-soft); color: var(--accent-text); white-space:nowrap; }
.chip.more { background: var(--surface-2); color: var(--muted); }
.actions { margin-top:18px; display:flex; gap:9px; }
.btn { border:0; border-radius: var(--radius-sm); padding:10px 18px; font-size:13px;
  font-weight:650; cursor:pointer; background: var(--accent); color:#fff;
  box-shadow: 0 1px 2px rgba(0,0,0,.12); transition: background .12s, transform .06s; }
.btn:hover { background: var(--accent-strong); }
.btn:active { transform: translateY(1px); }
.btn.ghost { background: var(--surface-2); color: var(--text); box-shadow:none; }

/* --- list --- */
.list-head { display:flex; align-items:baseline; justify-content:space-between; gap:10px; margin-bottom:12px; }
.list-head h1 { margin:0; font-size:17px; font-weight:700; letter-spacing:-.01em; }
.list-head .count { font-size:12.5px; color: var(--muted); }
.grid { display:grid; grid-template-columns: 1fr; gap:9px; }
@media (min-width:520px){ .grid { grid-template-columns: 1fr 1fr; } }
.tile { display:flex; align-items:center; justify-content:space-between; gap:10px;
  text-align:left; width:100%; background: var(--surface); border:1px solid var(--border);
  border-radius: var(--radius-sm); padding:13px 15px; cursor:pointer; color:inherit;
  font:inherit; transition: border-color .12s, transform .06s, box-shadow .12s; }
.tile:hover { border-color: color-mix(in srgb, var(--accent) 55%, var(--border));
  box-shadow: 0 6px 16px -12px rgba(0,0,0,.3); transform: translateY(-1px); }
.tile .name { font-weight:620; font-size:14px; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.tile .arrow { color: var(--muted); flex:none; }
.empty { color: var(--muted); padding:20px 2px; text-align:center; }

/* --- fullscreen recipe --- */
.full { max-width: 860px; margin:0 auto; padding:6px; }
.full .title { font-size:30px; }
.cols { display:grid; grid-template-columns:1fr; gap:22px; margin-top:18px; }
@media (min-width:660px){ .cols { grid-template-columns: 17rem 1fr; align-items:start; } }
.panel { background: var(--surface); border:1px solid var(--border); border-radius: var(--radius); padding:18px; }
.h2 { margin:0 0 12px; font-size:11px; font-weight:700; letter-spacing:.09em; text-transform:uppercase; color: var(--muted); }
.ing { display:flex; justify-content:space-between; gap:12px; padding:7px 0; border-bottom:1px solid var(--border); font-size:13.5px; }
.ing:last-child { border-bottom:0; }
.ing .q { color: var(--muted); white-space:nowrap; }
.cook { padding:5px 0; font-size:13.5px; }
ol.steps { margin:0; padding:0; list-style:none; }
.step { display:flex; gap:13px; padding:13px 0; border-bottom:1px solid var(--border); }
.step:last-child { border-bottom:0; }
.num { flex:none; width:27px; height:27px; display:grid; place-items:center; border-radius:50%;
  background: var(--accent); color:#fff; font-weight:700; font-size:13px; }
.step p { margin:0; line-height:1.6; }
.tok-ing { background: var(--accent-soft); color: var(--accent-text); border-radius:5px; padding:1px 6px; font-weight:600; }
.tok-cook { background: var(--teal-soft); color: var(--teal-text); border-radius:5px; padding:1px 6px; font-weight:600; }
.tok-timer { background: var(--violet-soft); color: var(--violet-text); border-radius:5px; padding:1px 6px; font-weight:600; }
.logs { margin-top:22px; }
.log { font-size:13px; padding:8px 0; border-bottom:1px solid var(--border); }
.log:last-child { border-bottom:0; }
.log .d { color: var(--muted); font-size:11px; font-weight:600; }
`;
