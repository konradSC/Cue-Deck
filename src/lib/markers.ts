// Shows the playing track's fade points on Spotify's own progress bar: the parts
// that will be skipped are dimmed, fades are shaded, and the in and out points
// get ticks. Spotify's markup changes between versions; if the bar can't be
// found, nothing is drawn.

import { FadePoints, GLOBAL, getExact, scopeFor } from "./store";
import { nowPlaying } from "./player";

const BAR = '[data-testid="playback-progressbar"] [data-testid="progress-bar-background"]';

/** The points the engine will use for the playing track, and which scope they come from. */
export function currentPoints(): { points?: FadePoints; scope: string; markScope: string } {
  const { uri, ctx } = nowPlaying();
  const markScope = scopeFor(ctx);
  if (!uri) return { scope: markScope, markScope };
  const own = getExact(markScope, uri);
  if (own || markScope === GLOBAL) return { points: own, scope: markScope, markScope };
  return { points: getExact(GLOBAL, uri), scope: GLOBAL, markScope };
}

const pct = (ms: number, duration: number) => `${Math.max(0, Math.min(100, (ms / duration) * 100))}%`;

function markup(p: FadePoints | undefined, duration: number): string {
  if (!p || !(duration > 0)) return "";
  const start = p.start ?? 0;
  const end = p.end ?? duration;
  const parts: string[] = [];
  const span = (cls: string, from: number, to: number) => {
    if (to > from) parts.push(`<div class="${cls}" style="left:${pct(from, duration)};right:calc(100% - ${pct(to, duration)})"></div>`);
  };
  span("fp-bar-skip", 0, start);
  span("fp-bar-skip", end, duration);
  if (p.fadeIn) span("fp-bar-fade-in", start, Math.min(start + p.fadeIn, end));
  if (p.fadeOut) span("fp-bar-fade-out", Math.max(end - p.fadeOut, start), end);
  if (p.start != null) parts.push(`<div class="fp-bar-tick" style="left:${pct(start, duration)}"></div>`);
  if (p.end != null) parts.push(`<div class="fp-bar-tick" style="left:${pct(end, duration)}"></div>`);
  return parts.join("");
}

/** Draw (or clear) the markers on every visible progress bar. Cheap to call often. */
export function renderMarkers() {
  const { points } = currentPoints();
  const duration = Spicetify.Player.getDuration();
  const html = markup(points, duration);
  document.querySelectorAll<HTMLElement>(BAR).forEach((bar) => {
    let layer = bar.querySelector<HTMLElement>(":scope > .fp-bar-marks");
    if (!layer) {
      if (getComputedStyle(bar).position === "static") bar.style.position = "relative";
      layer = document.createElement("div");
      layer.className = "fp-bar-marks";
      bar.appendChild(layer);
    }
    if (layer.dataset.html !== html) {
      layer.dataset.html = html;
      layer.innerHTML = html;
    }
  });
}
