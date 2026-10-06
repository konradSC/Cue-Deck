// Fade points live in localStorage inside the Spotify client, so they work
// offline and survive restarts. Layout: scope -> trackUri -> points, where
// scope is a playlist URI or "*" for points that apply in any context.

export interface FadePoints {
  start?: number;   // ms – jump here when the track begins
  end?: number;     // ms – move to the next track here
  fadeIn?: number;  // ms – ramp up from silence, starting at `start`
  fadeOut?: number; // ms – ramp down to silence, ending at `end` (or the track's natural end)
}

type Table = Record<string, Record<string, FadePoints>>;

const STORAGE_KEY = "fade-points:v1"; // original app name, kept so saved points survive the rename
const CHANGE_EVENT = "cue-deck:changed";
const HOLD_EVENT = "cue-deck:hold";
export const GLOBAL = "*";

let cache: Table | null = null;

function load(): Table {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") as Table;
  } catch {
    cache = {};
  }
  return cache;
}

function save(table: Table) {
  cache = table;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(table));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

// The app page and the engine extension are separate bundles with separate
// module caches, so re-read storage whenever either side writes.
window.addEventListener(CHANGE_EVENT, () => { cache = null; });

export function scopeFor(contextUri?: string | null): string {
  return contextUri && contextUri.startsWith("spotify:playlist:") ? contextUri : GLOBAL;
}

/** Points stored exactly in this scope (used by editors). */
export function getExact(scope: string, trackUri: string): FadePoints | undefined {
  return load()[scope]?.[trackUri];
}

/** Points the engine should use: playlist-specific first, then global. */
export function resolvePoints(trackUri: string, contextUri?: string | null): FadePoints | undefined {
  const t = load();
  return t[scopeFor(contextUri)]?.[trackUri] ?? t[GLOBAL]?.[trackUri];
}

/**
 * `seed`: when a track gets its first points in a playlist, start from its global points.
 * Lookup is whole-entry (a playlist entry hides the global one), so without this, marking
 * an in point in a playlist would silently drop the song's global out point and fades there.
 */
function applyPatch(table: Table, scope: string, trackUri: string, patch: Partial<FadePoints> | null, seed = false) {
  const tracks = { ...(table[scope] ?? {}) };
  if (patch === null) {
    delete tracks[trackUri];
  } else {
    const base = tracks[trackUri] ?? (seed && scope !== GLOBAL ? table[GLOBAL]?.[trackUri] : undefined);
    const merged: Record<string, number | undefined> = { ...base, ...patch };
    for (const k of Object.keys(merged)) {
      const v = merged[k];
      if (v == null || !Number.isFinite(v) || v < 0) delete merged[k];
    }
    if (Object.keys(merged).length) tracks[trackUri] = merged as FadePoints;
    else delete tracks[trackUri];
  }
  if (Object.keys(tracks).length) table[scope] = tracks;
  else delete table[scope];
}

/** Merge a patch into a track's points. A field set to undefined is removed; null clears the track. */
export function setPoints(scope: string, trackUri: string, patch: Partial<FadePoints> | null) {
  const table = { ...load() };
  applyPatch(table, scope, trackUri, patch, true);
  save(table);
}

export function setPointsBatch(scope: string, entries: Array<[string, Partial<FadePoints> | null]>) {
  const table = { ...load() };
  for (const [uri, patch] of entries) applyPatch(table, scope, uri, patch, true);
  save(table);
}

export function clearScope(scope: string) {
  const table = { ...load() };
  delete table[scope];
  save(table);
}

export function exportJson(): string {
  return JSON.stringify(load(), null, 2);
}

/** Merge imported points over existing ones. Throws on malformed input. */
export function importJson(text: string): number {
  const incoming = JSON.parse(text) as Table;
  if (!incoming || typeof incoming !== "object") throw new Error("Expected a JSON object");
  const table = { ...load() };
  let count = 0;
  for (const [scope, tracks] of Object.entries(incoming)) {
    if (!tracks || typeof tracks !== "object") continue;
    for (const [uri, pts] of Object.entries(tracks)) {
      applyPatch(table, scope, uri, pts);
      count++;
    }
  }
  save(table);
  return count;
}

export function onChange(cb: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, cb);
  return () => window.removeEventListener(CHANGE_EVENT, cb);
}

/**
 * Ask the engine to leave the currently playing track alone until it changes.
 * Used when an out point is marked at the current position, which would
 * otherwise trigger an immediate fade and skip.
 */
export function requestHold() {
  window.dispatchEvent(new CustomEvent(HOLD_EVENT));
}

export function onHold(cb: () => void) {
  window.addEventListener(HOLD_EVENT, cb);
}
