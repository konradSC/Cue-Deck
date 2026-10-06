// Styles are injected once and scoped with an `fp-` prefix. Colors come from
// Spicetify's theme variables so the page follows whatever theme is active.

const CSS = `
.fp-nav-tip .main-contextMenu-tippy { color: #fff; opacity: 1; }
/* Fade point markers drawn on Spotify's progress bar (lib/markers.ts). */
.fp-bar-marks { position: absolute; inset: 0; pointer-events: none; z-index: 1; }
.fp-bar-marks > div { position: absolute; top: 0; bottom: 0; }
.fp-bar-skip { background: rgba(0, 0, 0, 0.65); }
.fp-bar-fade-in { background: linear-gradient(to right, rgba(0, 0, 0, 0.55), transparent); }
.fp-bar-fade-out { background: linear-gradient(to left, rgba(0, 0, 0, 0.55), transparent); }
.fp-bar-marks > .fp-bar-tick { top: -3px; bottom: -3px; width: 2px; margin-left: -1px; border-radius: 1px; background: var(--spice-button, #1ed760); }
/* Spicetify asks for a 24px top bar icon but the button renders it at 16px; match Home's size. */
.custom-navlink[aria-label="Cue Deck"] svg { width: 24px; height: 24px; }
.custom-navlink[aria-label="Cue Deck"] svg svg { width: 100%; height: 100%; }
.fp-page { padding: 32px clamp(16px, 4vw, 48px) 96px; color: var(--spice-text); max-width: 1200px; }
.fp-page h1 { font-size: 2rem; font-weight: 800; letter-spacing: -0.02em; margin: 0; }
.fp-header { display: flex; flex-wrap: wrap; gap: 12px 24px; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.fp-event-title { position: relative; display: inline-flex; align-items: center; min-width: 0; max-width: 100%; }
.fp-page .fp-event-title select { appearance: none; -webkit-appearance: none; background: transparent; border: none;
  border-radius: 6px; padding: 0 36px 0 6px; margin-left: -6px; color: var(--spice-text); font-size: 2rem; font-weight: 800;
  letter-spacing: -0.02em; line-height: 1.2; cursor: pointer; max-width: 100%; text-overflow: ellipsis; }
.fp-page .fp-event-title select:hover { background: var(--spice-highlight); }
.fp-event-title select option { font-size: 1rem; font-weight: 400; background: var(--spice-card); }
.fp-event-title::after { content: ""; position: absolute; right: 12px; top: 50%; width: 9px; height: 9px; margin-top: -7px;
  border-right: 2.5px solid var(--spice-subtext); border-bottom: 2.5px solid var(--spice-subtext); transform: rotate(45deg); pointer-events: none; }
.fp-tabs { display: flex; gap: 8px; }
.fp-tabs button { background: var(--spice-card); color: var(--spice-text); border: none; border-radius: 999px;
  padding: 6px 14px; font: inherit; font-weight: 600; cursor: pointer; }
.fp-tabs button[aria-selected="true"] { background: var(--spice-text); color: var(--spice-main); }
.fp-tabs button:focus-visible { outline: 2px solid var(--spice-button); outline-offset: 2px; }
.fp-lede { color: var(--spice-subtext); margin: 0 0 24px; max-width: 64ch; line-height: 1.5; }

.fp-toolbar { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-bottom: 16px; }
.fp-toolbar select { min-width: 260px; max-width: 100%; }
.fp-spacer { flex: 1; }

.fp-page select, .fp-page input, .fp-page textarea, .fp-popup input, .fp-popup textarea {
  background: var(--spice-card); color: var(--spice-text); border: 1px solid transparent;
  border-radius: 4px; padding: 6px 8px; font: inherit; font-variant-numeric: tabular-nums;
}
.fp-page input:focus-visible, .fp-page select:focus-visible, .fp-popup input:focus-visible,
.fp-btn:focus-visible, .fp-icon-btn:focus-visible { outline: 2px solid var(--spice-button); outline-offset: 1px; }
input.fp-bad { border-color: #e35d5d; }

.fp-btn { background: transparent; color: var(--spice-text); border: 1px solid var(--spice-subtext);
  border-radius: 999px; padding: 6px 16px; font: inherit; font-weight: 700; cursor: pointer; }
.fp-btn:hover { border-color: var(--spice-text); }
.fp-btn-primary { background: var(--spice-button); color: var(--spice-main); border-color: var(--spice-button); }
.fp-icon-btn { background: none; border: none; color: var(--spice-subtext); cursor: pointer;
  padding: 4px 6px; border-radius: 4px; font-size: 14px; line-height: 1; }
.fp-icon-btn:hover { color: var(--spice-text); background: var(--spice-highlight); }

.fp-defaults { display: flex; flex-wrap: wrap; gap: 12px; align-items: end; padding: 12px 0 20px;
  border-bottom: 1px solid var(--spice-highlight); margin-bottom: 8px; }
.fp-defaults input { width: 64px; }

.fp-row { display: grid; grid-template-columns: 28px minmax(140px, 1.2fr) minmax(200px, 2fr) auto;
  gap: 16px; align-items: center; padding: 10px 8px; border-radius: 6px; }
.fp-row:hover { background: var(--spice-highlight); }
.fp-row.fp-current .fp-title { color: var(--spice-button); }
.fp-index { color: var(--spice-subtext); text-align: right; font-variant-numeric: tabular-nums; }
.fp-title { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fp-artist { color: var(--spice-subtext); font-size: 0.875rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fp-actions { display: flex; gap: 2px; }

.fp-editor { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.fp-fields { display: flex; flex-wrap: wrap; gap: 8px 12px; }
.fp-field { display: flex; align-items: center; gap: 4px; font-size: 0.8125rem; color: var(--spice-subtext); }
.fp-field input { width: 76px; }
.fp-field.fp-short input { width: 52px; }
.fp-warn { color: #e35d5d; font-size: 0.8125rem; }

/* The envelope: the track's gain over time, drawn on the track's timeline. */
.fp-env-wrap { position: relative; cursor: pointer; touch-action: none; }
.fp-env { width: 100%; height: 28px; display: block; }
.fp-env-handle { position: absolute; top: -3px; bottom: -3px; width: 12px; margin-left: -6px; cursor: ew-resize; }
.fp-env-handle::before { content: ""; position: absolute; left: 5px; top: 0; bottom: 0; width: 2px;
  background: var(--spice-button); border-radius: 1px; }
.fp-env-handle::after { content: ""; position: absolute; left: 2px; top: 0; width: 8px; height: 8px;
  background: var(--spice-button); border-radius: 50%; }
.fp-env-handle:hover::before, .fp-env-handle.fp-dragging::before { width: 3px; left: 4.5px; }
.fp-env-handle:focus-visible { outline: 2px solid var(--spice-text); outline-offset: 1px; border-radius: 3px; }
.fp-env-tip { position: absolute; bottom: calc(100% + 4px); left: 50%; transform: translateX(-50%);
  background: var(--spice-text); color: var(--spice-main); font-size: 0.75rem; font-weight: 700;
  font-variant-numeric: tabular-nums; padding: 2px 6px; border-radius: 4px; white-space: nowrap; pointer-events: none; }
.fp-env .fp-env-track { fill: var(--spice-highlight); }
.fp-env .fp-env-shape { fill: var(--spice-button); fill-opacity: 0.35; stroke: var(--spice-button); stroke-width: 1.5; vector-effect: non-scaling-stroke; }
.fp-env .fp-env-head { stroke: var(--spice-text); stroke-width: 2; vector-effect: non-scaling-stroke; }

.fp-empty { color: var(--spice-subtext); padding: 32px 0; }

.fp-popup { display: flex; flex-direction: column; gap: 12px; min-width: min(420px, 80vw); }
.fp-popup textarea { width: 100%; min-height: 200px; font-family: monospace; font-size: 12px; }

.fp-btn[disabled] { opacity: 0.4; cursor: default; }
.fp-btn .fp-key { margin-left: 8px; }
.fp-key { font-size: 11px; font-weight: 500; opacity: 0.75; }
.fp-explicit { display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px;
  background: var(--spice-subtext); color: var(--spice-main); font-size: 10px; font-weight: 700;
  border-radius: 2px; margin-right: 6px; vertical-align: 1px; flex: none; }
.fp-banner { padding: 12px 16px; border: 1px solid #e35d5d; border-radius: 8px; margin-bottom: 16px; }
.fp-hint { color: var(--spice-subtext); font-size: 0.8125rem; margin: 0; line-height: 1.4; }
.fp-hint-warn { color: var(--spice-text); display: flex; align-items: center; }
.fp-check { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; font-size: 0.875rem; }
.fp-row-flex { display: flex; flex-wrap: wrap; gap: 12px 20px; align-items: center; margin-bottom: 12px; }

/* Game page */
.fp-game section { margin-top: 24px; }
.fp-game section.fp-deck { margin-top: 0; }
.fp-deck { background: var(--spice-card); border-radius: 12px; padding: 16px 20px; }
.fp-deck-top { display: flex; flex-wrap: wrap; gap: 12px 24px; justify-content: space-between; align-items: flex-start; }
.fp-now { min-width: 0; flex: 1 1 240px; }
.fp-now-title { font-size: 1.125rem; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fp-source { margin-top: 6px; font-size: 0.875rem; color: var(--spice-subtext); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fp-now-cue { display: flex; align-items: center; margin-bottom: 6px; font-size: 0.8125rem; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.08em; color: var(--spice-button); }
.fp-now-cue.fp-dim { color: var(--spice-subtext); }
.fp-upnext-head { display: flex; align-items: baseline; gap: 16px; margin-bottom: 8px; }
.fp-upnext-title { font-size: 1.125rem; font-weight: 700; margin: 0; }
.fp-upnext-title .fp-dim { font-weight: 400; }
.fp-upnext { list-style: none; margin: 0; padding: 0; }
.fp-upnext li { display: grid; grid-template-columns: minmax(0, 1fr) auto 136px; gap: 12px; align-items: center;
  padding: 6px 12px; border-radius: 6px; }
.fp-upnext li:hover { background: var(--spice-highlight); }
.fp-upnext-name { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fp-upnext-artist { font-size: 0.8125rem; color: var(--spice-subtext); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fp-upnext-meta { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; align-items: center;
  font-size: 0.8125rem; color: var(--spice-subtext); font-variant-numeric: tabular-nums; }
.fp-upnext-action { display: flex; justify-content: flex-end; gap: 6px; }
.fp-upnext-skipped .fp-upnext-main { opacity: 0.5; text-decoration: line-through; }
.fp-upnext-more { padding: 4px 12px 0; }
.fp-chip { border: 1px solid color-mix(in srgb, var(--spice-subtext) 50%, transparent); border-radius: 999px;
  padding: 1px 8px; font-size: 0.75rem; white-space: nowrap; }
.fp-chip-next { background: var(--spice-button); border-color: transparent; color: #000; font-weight: 700; }
.fp-clock-wrap { text-align: right; }
.fp-clock { font-size: 2.25rem; font-weight: 800; line-height: 1; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
.fp-clock-stopped { color: #e35d5d; }
.fp-clock-caption { color: var(--spice-subtext); font-size: 0.8125rem; margin-top: 4px; }
.fp-link { background: none; border: none; padding: 0; margin-top: 4px; color: var(--spice-subtext); font: inherit;
  font-size: 0.8125rem; text-decoration: underline; cursor: pointer; }
.fp-link:hover { color: var(--spice-text); }
.fp-transport { display: flex; flex-wrap: wrap; gap: 8px; margin: 14px 0 10px; }
.fp-transport button { min-width: 132px; height: 48px; padding: 0 20px; border: none; border-radius: 999px; font: inherit;
  font-size: 1.0625rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 10px; }
.fp-transport button:active { transform: scale(0.98); }
.fp-transport button:focus-visible { outline: 3px solid var(--spice-text); outline-offset: 2px; }
.fp-go { background: var(--spice-button); color: var(--spice-main); }
.fp-stop { background: #e35d5d; color: #fff; }
.fp-duck { background: transparent; color: var(--spice-text); box-shadow: inset 0 0 0 2px var(--spice-subtext); }
.fp-duck[aria-pressed="true"] { background: var(--spice-text); color: var(--spice-main); box-shadow: none; }

.fp-eventbar { display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center; margin-bottom: 8px; }
.fp-eventbar .fp-field { font-size: 0.875rem; font-weight: 700; color: var(--spice-text); gap: 8px; }
.fp-eventbar h2 { font-size: 1.125rem; font-weight: 700; margin: 0 8px 0 0; }
.fp-name-input { width: 100%; min-width: 120px; }
.fp-eventbar .fp-name-input { width: 200px; }
.fp-btn-small { padding: 3px 12px; font-size: 0.8125rem; }
.fp-btn.fp-armed { border-color: #e35d5d; color: #e35d5d; }
.fp-title-row { display: flex; align-items: center; gap: 8px; min-width: 0; max-width: 100%; }
.fp-reset-btn { display: inline-flex; align-items: center; justify-content: center; min-width: 32px; height: 32px; border-radius: 999px; }
.fp-reset-btn.fp-armed { color: #e35d5d; font-weight: 700; padding: 0 12px; box-shadow: inset 0 0 0 1px #e35d5d; }

.fp-sets-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
.fp-sets-table th { text-align: left; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--spice-subtext); padding: 8px; border-bottom: 1px solid var(--spice-highlight); }
.fp-sets-table td { padding: 6px 8px; border-bottom: 1px solid var(--spice-highlight); vertical-align: middle; }
.fp-sets-table tbody tr:hover { background: var(--spice-highlight); }
.fp-sets-table tr.fp-set-active td { background: color-mix(in srgb, var(--spice-button) 14%, transparent); }
.fp-sets-table select { width: 100%; max-width: 260px; }
.fp-key-cell { width: 1%; white-space: nowrap; }
.fp-key-cell .fp-key { color: var(--spice-subtext); font-variant-numeric: tabular-nums; }
.fp-play-cell { width: 1%; text-align: right; white-space: nowrap; }
.fp-play-cell .fp-btn + .fp-btn { margin-left: 6px; }
.fp-set-name { font-weight: 700; white-space: nowrap; }
.fp-ellipsis { max-width: 260px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fp-dim { color: var(--spice-subtext); }
.fp-explicit-count { display: inline-flex; align-items: center; }
.fp-playing-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--spice-button); margin-right: 8px; vertical-align: 1px; }
.fp-reorder { display: flex; gap: 0; }
.fp-reorder .fp-icon-btn { font-size: 10px; }
.fp-reorder .fp-icon-btn[disabled] { opacity: 0.25; cursor: default; }
.fp-cell-row { display: flex; flex-wrap: wrap; gap: 6px 12px; align-items: center; }
.fp-table-foot { margin-top: 12px; flex-wrap: nowrap; }
.fp-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

.fp-settings summary { cursor: pointer; font-size: 1rem; font-weight: 700; padding: 4px 0; }
.fp-settings[open] summary { margin-bottom: 12px; }

@media (max-width: 760px) {
  .fp-transport button { flex: 1 1 120px; min-width: 0; }
  .fp-clock-wrap { text-align: left; }
  .fp-row { grid-template-columns: 1fr auto; }
  .fp-index { display: none; }
  .fp-row .fp-editor { grid-column: 1 / -1; grid-row: 2; }
}
`;

export function injectStyles() {
  if (document.getElementById("cue-deck-css")) return;
  const el = document.createElement("style");
  el.id = "cue-deck-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
