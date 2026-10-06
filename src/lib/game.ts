// Game-day settings, commands, and engine status.
//
// The Game page (app bundle) and the engine (extension bundle) don't share
// module state, so they talk through the window: commands go out as events,
// and the engine publishes its status on a window property each tick.
//
// Sets are grouped into events (Basketball, Lacrosse, Graduation…). One event
// is active at a time; Ctrl+Alt+1–9 play its sets in order.

export interface GameSet {
  id: string;
  name: string;
  playlist?: string;
  maxPlaySec: number;    // 0 = no limit; otherwise fade out and stop this long after Go
  shuffle: boolean;
  timerMin: number;      // 0 = no countdown; otherwise start a countdown when the set starts
  timerLeadSec: number;  // with a countdown, stop the music this long before it ends
}

export interface GameEvent {
  id: string;
  name: string;
  sets: GameSet[];
}

export interface GameSettings {
  events: GameEvent[];
  activeEvent: string;
  stopFadeSec: number;
  goFadeSec: number;
  duckPercent: number;
  goNextTrack: boolean;   // Go starts the next track (true) or resumes the paused one (false)
  skipExplicit: boolean;
}

export const MAX_HOTKEY_SETS = 9;

export const newId = () => Math.random().toString(36).slice(2, 10);

export function newSet(patch: Partial<GameSet> = {}): GameSet {
  return { id: newId(), name: "New cue", maxPlaySec: 0, shuffle: true, timerMin: 0, timerLeadSec: 30, ...patch };
}

function defaultEvent(): GameEvent {
  return {
    id: newId(),
    name: "Default",
    sets: [
      newSet({ name: "Pregame" }),
      newSet({ name: "Breaks", maxPlaySec: 45 }),
      newSet({ name: "Halftime", timerMin: 10 }),
      newSet({ name: "Postgame" }),
    ],
  };
}

const SHARED_DEFAULTS = {
  stopFadeSec: 2,
  goFadeSec: 1,
  duckPercent: 20,
  goNextTrack: true,
  skipExplicit: false,
};

// Storage keys keep the app's original name so saved settings survive the rename.
const KEY = "fade-points:game:v2";
const OLD_KEY = "fade-points:game:v1";
const CHANGE_EVENT = "cue-deck:game-changed";
const CMD_EVENT = "cue-deck:cmd";

/** Convert v1 settings (four fixed sets plus a halftime timer) into a "Default" event. */
function migrateV1(old: any): GameSettings {
  const ev = defaultEvent();
  const ids = ["pregame", "breaks", "halftime", "postgame"];
  ev.sets = ev.sets.map((s, i) => {
    const o = old?.sets?.[ids[i]] ?? {};
    return {
      ...s,
      playlist: o.playlist,
      maxPlaySec: o.maxPlaySec ?? s.maxPlaySec,
      shuffle: o.shuffle ?? s.shuffle,
      ...(ids[i] === "halftime" ? { timerMin: old.halftimeMin ?? 10, timerLeadSec: old.halftimeLeadSec ?? 30 } : {}),
    };
  });
  const shared: any = {};
  for (const k of Object.keys(SHARED_DEFAULTS)) if (old?.[k] !== undefined) shared[k] = old[k];
  return { ...SHARED_DEFAULTS, ...shared, events: [ev], activeEvent: ev.id };
}

let cache: GameSettings | null = null;
window.addEventListener(CHANGE_EVENT, () => { cache = null; });

export function getGame(): GameSettings {
  if (cache) return cache;
  let saved: any = null;
  try { saved = JSON.parse(localStorage.getItem(KEY) || "null"); } catch { /* use defaults */ }
  if (!saved) {
    let old: any = null;
    try { old = JSON.parse(localStorage.getItem(OLD_KEY) || "null"); } catch { /* none */ }
    saved = old ? migrateV1(old) : null;
    if (saved) localStorage.setItem(KEY, JSON.stringify(saved));
  }
  const g: GameSettings = { ...SHARED_DEFAULTS, events: [], activeEvent: "", ...(saved ?? {}) };
  g.events = (g.events ?? []).map((e) => ({ ...e, sets: (e.sets ?? []).map((s) => newSet(s)) }));
  if (!g.events.length) g.events = [defaultEvent()];
  if (!g.events.some((e) => e.id === g.activeEvent)) g.activeEvent = g.events[0].id;
  cache = g;
  return g;
}

export function activeEvent(g = getGame()): GameEvent {
  return g.events.find((e) => e.id === g.activeEvent) ?? g.events[0];
}

export function findSet(id: string, g = getGame()): GameSet | undefined {
  for (const e of g.events) {
    const s = e.sets.find((x) => x.id === id);
    if (s) return s;
  }
  return undefined;
}

export function setGame(patch: Partial<GameSettings>) {
  save({ ...getGame(), ...patch });
}

export function updateEvent(id: string, fn: (e: GameEvent) => GameEvent) {
  const g = getGame();
  save({ ...g, events: g.events.map((e) => (e.id === id ? fn(e) : e)) });
}

export function updateSet(eventId: string, setId: string, patch: Partial<GameSet>) {
  updateEvent(eventId, (e) => ({ ...e, sets: e.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)) }));
}

export function addEvent(name: string, copyFrom?: GameEvent): GameEvent {
  const ev: GameEvent = {
    id: newId(),
    name,
    sets: copyFrom ? copyFrom.sets.map((s) => ({ ...s, id: newId() })) : [newSet({ name: "Pregame" })],
  };
  const g = getGame();
  save({ ...g, events: [...g.events, ev], activeEvent: ev.id });
  return ev;
}

export function removeEvent(id: string) {
  const g = getGame();
  if (g.events.length <= 1) return;
  const events = g.events.filter((e) => e.id !== id);
  save({ ...g, events, activeEvent: g.activeEvent === id ? events[0].id : g.activeEvent });
}

function save(g: GameSettings) {
  localStorage.setItem(KEY, JSON.stringify(g));
  cache = null;
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function onGameChange(cb: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, cb);
  return () => window.removeEventListener(CHANGE_EVENT, cb);
}

export type Command =
  | { type: "stop" }
  | { type: "go" }
  | { type: "duck" }
  | { type: "startSet"; setId: string; restart?: boolean } // restart: from the top even if already loaded
  | { type: "startSetIndex"; index: number; restart?: boolean } // in the active event, for hotkeys
  | { type: "cancelTimer" }
  | { type: "resetEvent" }
  | { type: "playUpcoming"; track: SkipEntry }
  | { type: "skipUpcoming"; track: SkipEntry }
  | { type: "unskipUpcoming"; track: SkipEntry };

/** An upcoming song the user asked to skip, or to jump to. The uid is used to jump to it. */
export interface SkipEntry { uri: string; uid?: string }

// Skips match by song, not uid: the queue's uids and the player's may not use the same
// format, which would let a "Will skip" song play. A song listed twice is skipped both times.
export function matchesSkip(entry: SkipEntry, uri: string, _uid?: string): boolean {
  return entry.uri === uri;
}

export function send(cmd: Command) {
  window.dispatchEvent(new CustomEvent(CMD_EVENT, { detail: cmd }));
}

export function onCommand(cb: (cmd: Command) => void) {
  window.addEventListener(CMD_EVENT, (e) => cb((e as CustomEvent<Command>).detail));
}

export type Mode = "idle" | "stopping" | "stopped" | "going" | "playing";

export interface Status {
  engine: boolean;
  mode: Mode;
  ducked: boolean;
  activeSetId?: string;
  breakRemainingMs?: number;
  timerSetName?: string;
  timerRemainingMs?: number;
  musicStopsInMs?: number;
  skipList?: SkipEntry[];
  freshStart?: boolean; // after Reset event, until a set starts
}

export function getStatus(): Status {
  return (window as any).__cueDeckStatus ?? { engine: false, mode: "idle", ducked: false };
}

export function publishStatus(s: Status) {
  (window as any).__cueDeckStatus = s;
}
