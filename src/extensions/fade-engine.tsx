// Loaded on every Spotify start (bundled with the custom app). Runs the fade
// engine and adds the quick controls: Mark In / Mark Out on the playbar and
// "Edit fade points" in the track context menu, plus the game hotkeys.

import React from "react";
import { mount } from "../components/mount";
import { startEngine } from "../lib/engine";
import { GLOBAL, onChange as onPointsChange, requestHold, scopeFor, setPoints } from "../lib/store";
import { currentPoints, renderMarkers } from "../lib/markers";
import { formatMs, nowPlaying } from "../lib/player";
import { PointsEditor } from "../components/PointsEditor";
import { injectStyles } from "../components/styles";
import { Command, MAX_HOTKEY_SETS, send } from "../lib/game";

const icon = (path: string) =>
  `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
const IN_ICON = icon(`<path d="M6 2H3v12h3"/><path d="M8 8h6M11 5l3 3-3 3"/>`);
const OUT_ICON = icon(`<path d="M10 2h3v12h-3"/><path d="M2 8h6M5 5l3 3-3 3"/>`);
const CLEAR_ICON = icon(`<path d="M9 2.5l4.5 4.5-6 6H4L2.5 11.5z"/><path d="M6 5.5l4.5 4.5"/><path d="M9 13.5h5"/>`);

// User-facing wording: talk about the song, and only mention the playlist when the
// points are specific to it. Points set outside a playlist apply wherever the song plays.
const forSong = (scope: string) => (scope === GLOBAL ? "for this song" : "for this song in this playlist");

function mark(field: "start" | "end") {
  const { uri, ctx } = nowPlaying();
  if (!uri) return;
  const pos = Math.round(Spicetify.Player.getProgress());
  // An out point at the playhead would skip right away; let this play-through continue.
  if (field === "end") requestHold();
  setPoints(scopeFor(ctx), uri, { [field]: pos });
  Spicetify.showNotification(`${field === "start" ? "In" : "Out"} point set at ${formatMs(pos)} ${forSong(scopeFor(ctx))}`);
}

/** Clear the points shown on the progress bar for the playing track. */
function clearCurrent() {
  const { uri } = nowPlaying();
  const { points, scope, markScope } = currentPoints();
  if (!uri || !points) return;
  setPoints(scope, uri, null);
  if (scope === GLOBAL && markScope !== GLOBAL) Spicetify.showNotification("Fade points cleared for this song everywhere");
  else if (scope === GLOBAL) Spicetify.showNotification("Fade points cleared for this song");
  else if (currentPoints().points) Spicetify.showNotification("Fade points cleared for this song in this playlist. Its fade points from outside the playlist now apply instead.");
  else Spicetify.showNotification("Fade points cleared for this song in this playlist");
}

function clearLabel(): string {
  const { points, scope, markScope } = currentPoints();
  if (!points) return "This song has no fade points";
  if (scope === GLOBAL && markScope !== GLOBAL) return "Clear this song's fade points (they apply everywhere, not just this playlist)";
  return `Clear this song's fade points${scope === GLOBAL ? "" : " in this playlist"}`;
}

// Game hotkeys. These fire while Spotify has focus; see tools/game-hotkeys.ahk for global hotkeys.
// Ctrl+Alt+1–9 play the active event's sets in order; adding Shift restarts that set from the top.
const HOTKEYS: Record<string, Command> = {
  KeyG: { type: "go" },
  KeyS: { type: "stop" },
  KeyD: { type: "duck" },
  ...Object.fromEntries(
    Array.from({ length: MAX_HOTKEY_SETS }, (_, i) => [`Digit${i + 1}`, { type: "startSetIndex", index: i } as Command]),
  ),
};

function onKeyDown(e: KeyboardEvent) {
  if (!e.ctrlKey || !e.altKey || e.metaKey || e.repeat) return;
  let cmd: Command | undefined = HOTKEYS[e.code];
  if (e.shiftKey) cmd = cmd?.type === "startSetIndex" ? { ...cmd, restart: true } : undefined;
  if (!cmd) return;
  // On AltGr layouts Ctrl+Alt+key types a character (e.g. ² or @); let it reach text fields.
  const plain = e.code.replace(/^(Key|Digit)/, "").toLowerCase();
  const el = e.target as HTMLElement | null;
  const typing = !!el && (el.isContentEditable || /^(INPUT|TEXTAREA)$/.test(el.tagName));
  if (typing && e.key.length === 1 && e.key.toLowerCase() !== plain) return;
  e.preventDefault();
  e.stopPropagation();
  send(cmd);
}

// Spicetify wraps the top bar button in Spotify's TooltipWrapper, which doesn't show on
// current Spotify versions. Attach the same Tippy tooltip the playbar buttons use.
function attachNavTooltip() {
  document.querySelectorAll<HTMLElement>(".custom-navlink[aria-label^='Cue Deck']").forEach((el) => {
    if ((el as any)._tippy) return;
    Spicetify.Tippy?.(el, {
      content: el.getAttribute("aria-label"),
      ...Spicetify.TippyProps,
      placement: "bottom",
      onCreate: (tip: any) => tip.popper.classList.add("fp-nav-tip"),
    });
  });
}

/** Run `fn` (at most once per frame) whenever Spotify re-renders part of the page. */
function onDomChange(fn: () => void) {
  let queued = false;
  new MutationObserver(() => {
    if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; fn(); }); }
  }).observe(document.body, { childList: true, subtree: true });
  fn();
}

let unmountPopup: (() => void) | null = null;

function openEditor(trackUri: string, contextUri?: string) {
  const scope = scopeFor(contextUri);
  unmountPopup?.();
  const popupHost = document.createElement("div");
  popupHost.className = "fp-popup";
  unmountPopup = mount(popupHost, <PointsEditor trackUri={trackUri} scope={scope} />);
  Spicetify.PopupModal.display({
    title: `Fade points ${forSong(scope)}`,
    content: popupHost,
  });
}

async function main() {
  while (!Spicetify?.Player?.addEventListener || !Spicetify?.Playbar || !Spicetify?.ContextMenu || !Spicetify?.PopupModal) {
    await new Promise((r) => setTimeout(r, 100));
  }
  injectStyles();
  startEngine();
  document.addEventListener("keydown", onKeyDown, true);
  onDomChange(() => { attachNavTooltip(); renderMarkers(); });

  const markIn = new Spicetify.Playbar.Button("Mark in point", IN_ICON, () => mark("start"));
  const markOut = new Spicetify.Playbar.Button("Mark out point", OUT_ICON, () => mark("end"));
  const clear = new Spicetify.Playbar.Button("Clear fade points", CLEAR_ICON, clearCurrent);
  markIn.register();
  markOut.register();
  clear.register();

  // Say where a new point will apply or be cleared, and keep the progress bar markers current.
  const refresh = () => {
    const { points, markScope } = currentPoints();
    markIn.label = `Mark in point ${forSong(markScope)}`;
    markOut.label = `Mark out point ${forSong(markScope)}`;
    clear.disabled = !points;
    clear.label = clearLabel();
    renderMarkers();
  };
  Spicetify.Player.addEventListener("songchange", () => {
    refresh();
    setTimeout(renderMarkers, 1000); // the new track's duration can arrive a moment later
  });
  onPointsChange(refresh);
  refresh();

  const isSingleTrack = (uris: string[]) => uris.length === 1 && uris[0].startsWith("spotify:track:");

  new Spicetify.ContextMenu.Item(
    "Edit fade points",
    (uris: string[], _uids?: string[], contextUri?: string) => openEditor(uris[0], contextUri),
    isSingleTrack,
  ).register();

  new Spicetify.ContextMenu.Item(
    "Clear fade points",
    (uris: string[], _uids?: string[], contextUri?: string) => {
      setPoints(scopeFor(contextUri), uris[0], null);
      Spicetify.showNotification(`Fade points cleared ${forSong(scopeFor(contextUri))}`);
    },
    isSingleTrack,
  ).register();
}

// Custom-app extensions aren't invoked by the loader, so start ourselves.
main().catch((e) => console.error("[cue-deck] failed to start", e));
