// The fade engine. Runs once, inside the extension bundle.
//
// Every tick it multiplies three gains and applies the result by scaling
// Spotify's master volume relative to the volume the user had set:
//
//   track gain     – from the playhead: in/out points and per-track fades
//   transport gain – game controls: Stop fades to 0 and pauses, Go fades back in
//   duck gain      – lowers the music for announcements
//
// Track gain follows the playhead, so pausing pauses a fade and scrubbing
// jumps to the matching level. Transport and duck ramps follow the clock.

import { FadePoints, onHold, resolvePoints } from "./store";
import { canContinue, currentUid, isCurrentExplicit, isNextExplicit, nextTrackUri, nowPlaying, seekMs, upcoming } from "./player";
import { Command, GameSet, GameSettings, Mode, SkipEntry, activeEvent, findSet, getGame, matchesSkip, onCommand, publishStatus } from "./game";

const TICK_MS = 40;
const SEEK_MASK_MS = 700;        // keep silent this long while a seek to the in point lands
const TRACK_START_MASK_MS = 150; // Player state can lag songchange; stay silent briefly
const PRE_DIP_MS = 250;          // silence a natural track end if the next track starts quiet
const SKIP_EARLY_MS = 60;        // skip slightly before the out point to absorb tick jitter
const GO_TIMEOUT_MS = 4000;      // give up waiting for a track change after Go
const SWITCH_FADE_MS = 700;      // quick fade when Go or a set interrupts music that's playing
const DUCK_RAMP_MS = 400;
const VOLUME_SETTLE_MS = 500;    // after restoring the volume, wait this long before reading it again
const TIMER_OVER_MS = 60_000;    // show a finished countdown this long, then clear the clock
const RECOVERY_KEY = "fade-points:engine-volume";

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const curve = (x: number) => Math.sin(clamp01(x) * (Math.PI / 2)); // equal-power, for track fades
const smooth = (x: number) => { x = clamp01(x); return x * x * (3 - 2 * x); };

class Ramp {
  private from = 1;
  private to = 1;
  private t0 = 0;
  private dur = 0;
  value(now: number) {
    if (this.dur <= 0 || now - this.t0 >= this.dur) return this.to;
    return this.from + (this.to - this.from) * smooth((now - this.t0) / this.dur);
  }
  done(now: number) { return this.dur <= 0 || now - this.t0 >= this.dur; }
  set(to: number, durMs: number, now: number) {
    this.from = this.value(now);
    this.to = to;
    this.t0 = now;
    this.dur = Math.max(0, durMs);
  }
  get target() { return this.to; }
}

// Volume ownership
let baseVolume = 1;
let managing = false;

// Per-track state
let token = 0;
let songChangedAt = 0;
let seekedToken = -1;
let seekAt = 0;
let skippedToken = -1;
let skippedAt = 0;
let heldToken = -1;
let explicitSkippedToken = -1; // also used for songs on the skip list
let lastTrackGain = 1;

// Game state
const transport = new Ramp();
const duck = new Ramp();
let mode: Mode = "idle";
let afterFade: (() => void) | null = null;
let goToken = -1;
let goStartedAt = 0;
let goNeedsNewTrack = false;
let activeSet: string | undefined; // set id
let ducked = false;
let autoStopAt: number | undefined;
let timerEndsAt: number | undefined;
let timerStopAt: number | undefined;
let timerSetName: string | undefined;
let skipList: SkipEntry[] = []; // upcoming songs the user chose to skip, for this run of the playlist
let skipListCtx: string | undefined;
let freshStart = false; // after Reset event, the next set press starts its playlist from the top
// Each Go, set start, Stop or Reset bumps this; an async start that finds it changed has been
// superseded and must not start playback.
let launchGen = 0;
let goPending = false; // a Go is waiting on Spotify (playUri / skipTo), so don't time it out yet
let releasedAt = -Infinity;

const now = () => performance.now();
const startsQuiet = (p?: FadePoints) => !!p && ((p.fadeIn ?? 0) > 0 || (p.start ?? 0) > 1);
const onSkipList = (uri: string, uid?: string) => skipList.some((e) => matchesSkip(e, uri, uid));
const isNextOnSkipList = () => { const n = upcoming()[0]; return !!n && onSkipList(n.uri, n.uid); };
const nextStartsQuiet = (ctx: string | undefined, skipExplicit: boolean) =>
  startsQuiet(resolvePoints(nextTrackUri() ?? "", ctx)) || (skipExplicit && isNextExplicit()) || isNextOnSkipList();

// ---------------------------------------------------------------- volume

function release() {
  if (!managing) return;
  managing = false;
  Spicetify.Player.setVolume(baseVolume);
  releasedAt = now();
  localStorage.removeItem(RECOVERY_KEY);
}

/** Take over the volume and silence it now, before playback starts, so nothing is heard at full volume. */
function silenceNow() {
  if (!managing) {
    managing = true;
    localStorage.setItem(RECOVERY_KEY, String(baseVolume));
  }
  Spicetify.Player.setVolume(0);
}

function applyGain(g: number) {
  if (g >= 0.999) return release();
  if (!managing) {
    managing = true;
    // If Spotify closes mid-fade, restore the user's volume on next launch.
    localStorage.setItem(RECOVERY_KEY, String(baseVolume));
  }
  const target = baseVolume * g;
  if (Math.abs(Spicetify.Player.getVolume() - target) > 0.003) Spicetify.Player.setVolume(target);
}

// ---------------------------------------------------------------- game controls

const isAudible = () => Spicetify.Player.isPlaying() && transport.value(now()) > 0.01;

function ensurePlayingSoon() {
  // Only while this Go is still pending, so a quick Stop isn't undone.
  const pending = goStartedAt;
  setTimeout(() => {
    if (mode === "going" && goStartedAt === pending && !Spicetify.Player.isPlaying()) Spicetify.Player.play();
  }, 400);
}

function fadeOutThen(ms: number, then: () => void) {
  mode = "stopping";
  autoStopAt = undefined;
  transport.set(0, ms, now());
  afterFade = then;
}

function stop() {
  if (mode === "stopped") return;
  launchGen++;
  goPending = false;
  fadeOutThen(getGame().stopFadeSec * 1000, () => {
    Spicetify.Player.pause();
    mode = "stopped";
  });
}

/** Start a Go. Returns its launch generation, for async starts to check they're still current. */
function beginGo(needsNewTrack: boolean): number {
  const t = now();
  transport.set(0, 0, t);
  ducked = false;
  duck.set(1, 0, t);
  silenceNow();
  mode = "going";
  goToken = token;
  goStartedAt = t;
  goNeedsNewTrack = needsNewTrack;
  goPending = false;
  return ++launchGen;
}

function finishGo(t: number, game: GameSettings) {
  transport.set(1, game.goFadeSec * 1000, t);
  mode = "playing";
  const limit = activeSet ? findSet(activeSet, game)?.maxPlaySec ?? 0 : 0;
  autoStopAt = limit > 0 ? t + limit * 1000 : undefined;
  if (!Spicetify.Player.isPlaying()) release(); // timed out with nothing playing: give the volume back
}

/**
 * Wait for an async Spotify call that starts playback for Go generation `gen`. Returns false
 * (after pausing anything it started) if a Stop, Reset or newer Go superseded it meanwhile.
 */
async function landGo(gen: number, call: () => Promise<unknown> | unknown, failure: string): Promise<boolean> {
  goPending = true;
  try {
    await call();
  } catch (e) {
    console.error("[cue-deck]", e);
    if (gen !== launchGen) return false;
    goPending = false;
    goStartedAt = -Infinity; // time out now: whatever was playing fades back in
    Spicetify.showNotification(failure, true);
    return false;
  }
  if (gen !== launchGen) {
    if (mode === "stopped" || mode === "stopping") Spicetify.Player.pause();
    return false;
  }
  goPending = false;
  goStartedAt = now(); // the Go timeout counts from when Spotify accepted the change
  ensurePlayingSoon();
  return true;
}

function clearTimer() {
  timerEndsAt = timerStopAt = timerSetName = undefined;
}

function go() {
  // A double-tap would skip a second track while the first change is landing.
  if (mode === "going") return;
  if (timerEndsAt !== undefined && now() >= timerEndsAt) clearTimer();
  const launch = () => {
    const next = getGame().goNextTrack;
    beginGo(next);
    if (next) {
      Spicetify.Player.next();
      ensurePlayingSoon();
    } else {
      Spicetify.Player.play();
    }
  };
  if (isAudible()) fadeOutThen(SWITCH_FADE_MS, launch);
  else launch();
}

/**
 * Spotify remembers a shuffle setting per playlist and applies it when the playlist
 * starts, overriding Player.setShuffle. Set the playlist's own setting so the set's
 * Shuffle checkbox wins. Internal API; older clients without it rely on setShuffle.
 */
async function setPlaylistShuffle(uri: string, on: boolean) {
  const contextual = (Spicetify.Platform as any)?.PlayerAPI?._contextualShuffle;
  if (!contextual?.setContextualShuffleMode) return;
  try {
    await contextual.setContextualShuffleMode(uri, on ? 1 : 0); // 0 off, 1 on, 2 smart shuffle
  } catch (e) {
    console.warn("[cue-deck] couldn't set the playlist's shuffle mode:", e);
  }
}

/** Would pressing this set move on to its next song (rather than start the playlist over)? */
function setContinues(cfg: GameSet): boolean {
  const skipExplicit = getGame().skipExplicit;
  return !freshStart && canContinue(cfg.playlist ?? "", (t) => onSkipList(t.uri, t.uid) || (skipExplicit && t.explicit));
}

function startSet(cfg: GameSet | undefined, restart = false) {
  if (!cfg) return;
  if (!cfg.playlist) {
    Spicetify.showNotification(`Choose a playlist for ${cfg.name} first`, true);
    return;
  }
  // A second press while this set is still starting would skip a song.
  if (mode === "going" && activeSet === cfg.id && !restart) return;
  const launch = () => {
    // If this set's playlist is already loaded (the Timeouts set pressed at every break),
    // move on to its next song rather than restarting it, so breaks don't repeat songs.
    // Switching from another set, reaching the end of the playlist, or Restart starts it fresh.
    const continuing = !restart && setContinues(cfg);
    const wasLoaded = nowPlaying().ctx === cfg.playlist;
    activeSet = cfg.id;
    freshStart = false;
    startCountdown(cfg);
    const gen = beginGo(true);
    try {
      if (Spicetify.Player.getShuffle() !== cfg.shuffle) Spicetify.Player.setShuffle(cfg.shuffle);
    } catch { /* older clients */ }
    if (continuing) {
      Spicetify.Player.next();
      ensurePlayingSoon();
      return;
    }
    skipList = []; // a fresh run through the playlist
    const playlist = cfg.playlist!;
    landGo(gen, async () => {
      await setPlaylistShuffle(playlist, cfg.shuffle);
      if (gen !== launchGen) return; // superseded while waiting; don't start it
      // In order: start at the first song, even if this playlist is already loaded mid-way.
      await Spicetify.Player.playUri(playlist, {}, cfg.shuffle ? {} : { skipTo: { index: 0 } });
    }, `Couldn't start ${cfg.name}`).then((ok) => {
      // Restarting a loaded playlist can land on the same track without a songchange;
      // treat it as a new track so its in point and fades apply and Go doesn't wait.
      if (ok && wasLoaded) {
        token++;
        songChangedAt = now();
      }
    });
  };
  if (isAudible()) fadeOutThen(SWITCH_FADE_MS, launch);
  else launch();
}

/** Starting a set replaces the running countdown; a set with its own countdown starts a new one. */
function startCountdown(cfg: GameSet) {
  clearTimer();
  if (cfg.timerMin <= 0) return;
  const length = cfg.timerMin * 60_000;
  // Keep "stop music early" inside the countdown, so the music doesn't stop as soon as it starts.
  const lead = Math.max(0, Math.min(cfg.timerLeadSec * 1000, length - 10_000));
  timerSetName = cfg.name;
  timerEndsAt = now() + length;
  timerStopAt = timerEndsAt - lead;
}

/**
 * Jump to a song further down the queue (Play in Up next), like Go: fade out what's
 * playing, change track, then fade in. The song's own in point and fades still apply.
 * Songs in between are passed over, as when clicking a song in Spotify's queue.
 */
function playUpcoming(track: SkipEntry) {
  if (mode === "going") return;
  if (timerEndsAt !== undefined && now() >= timerEndsAt) clearTimer();
  skipList = skipList.filter((e) => !matchesSkip(e, track.uri, track.uid)); // chosen, so don't skip it
  const launch = () => {
    const gen = beginGo(true);
    const api = (Spicetify.Platform as any)?.PlayerAPI;
    const { ctx } = nowPlaying();
    landGo(gen, () => {
      if (api?.skipTo) return api.skipTo({ uri: track.uri, uid: track.uid });
      if (ctx) return Spicetify.Player.playUri(ctx, {}, { skipTo: { uri: track.uri, uid: track.uid } }); // older clients
      throw new Error("no way to jump to a song in this Spotify version");
    }, "Couldn't switch to that song");
  };
  if (isAudible()) fadeOutThen(SWITCH_FADE_MS, launch);
  else launch();
}

/**
 * Reset event: put the game state back to how it is before an event, after fiddling
 * around. Fades out and stops, clears the countdown, break timer, duck and skip marks,
 * forgets the playing set, and makes the next set press start its playlist from the top.
 * Sets, fade points and settings are left alone.
 */
function resetEvent() {
  launchGen++;
  goPending = false;
  clearTimer();
  skipList = [];
  activeSet = undefined;
  freshStart = true;
  const unduck = () => { ducked = false; duck.set(1, 0, now()); };
  if (isAudible()) {
    // Unduck once silent, so the music doesn't swell during the fade.
    fadeOutThen(getGame().stopFadeSec * 1000, () => { Spicetify.Player.pause(); mode = "stopped"; unduck(); });
  } else {
    afterFade = null; // drop a set or Go that was waiting on a fade
    autoStopAt = undefined;
    if (Spicetify.Player.isPlaying()) Spicetify.Player.pause();
    mode = "stopped";
    unduck();
  }
}

function toggleDuck() {
  ducked = !ducked;
  duck.set(ducked ? getGame().duckPercent / 100 : 1, DUCK_RAMP_MS, now());
}

function handle(cmd: Command) {
  switch (cmd.type) {
    case "stop": return stop();
    case "go": return go();
    case "duck": return toggleDuck();
    case "startSet": return startSet(findSet(cmd.setId), cmd.restart);
    case "startSetIndex": return startSet(activeEvent().sets[cmd.index], cmd.restart);
    case "cancelTimer": return clearTimer();
    case "resetEvent": return resetEvent();
    case "playUpcoming": return playUpcoming(cmd.track);
    case "skipUpcoming":
      if (!onSkipList(cmd.track.uri, cmd.track.uid)) skipList = [...skipList, cmd.track];
      return;
    case "unskipUpcoming":
      skipList = skipList.filter((e) => !matchesSkip(e, cmd.track.uri, cmd.track.uid));
      return;
  }
}

// ---------------------------------------------------------------- per-track gain

function computeTrackGain(t: number, uri: string, ctx: string | undefined, playing: boolean, skipExplicit: boolean): number {
  if (heldToken === token) return 1;

  // Explicit tracks (when that setting is on) and songs on the skip list are skipped silently.
  const uid = currentUid();
  const listed = onSkipList(uri, uid);
  if (explicitSkippedToken === token || listed || (skipExplicit && isCurrentExplicit())) {
    if (playing && explicitSkippedToken !== token) {
      explicitSkippedToken = token;
      if (listed) skipList = skipList.filter((e) => !matchesSkip(e, uri, uid)); // skip it once
      Spicetify.Player.next();
    }
    return 0;
  }

  const p = resolvePoints(uri, ctx);
  const progress = Spicetify.Player.getProgress();
  const duration = Spicetify.Player.getDuration();
  let g = 1;
  let naturalEnd = true;

  if (t - songChangedAt < TRACK_START_MASK_MS && startsQuiet(p)) g = 0;

  if (p) {
    const start = p.start != null && p.start > 1 && p.start < duration ? p.start : 0;

    // Jump to the in point once per track, staying silent until it lands.
    if (start > 0) {
      if (playing && seekedToken !== token && progress < start - 250) {
        seekedToken = token;
        seekAt = t;
        seekMs(start);
      }
      if ((seekedToken !== token || t - seekAt < SEEK_MASK_MS) && progress < start - 250) g = 0;
    }

    if ((p.fadeIn ?? 0) > 0 && progress >= start - 250) {
      g = Math.min(g, curve((progress - start) / p.fadeIn!));
    }

    const end = p.end != null && p.end > start && p.end < duration ? p.end : undefined;
    naturalEnd = end === undefined;
    const outAt = end ?? duration;
    if ((p.fadeOut ?? 0) > 0) g = Math.min(g, curve((outAt - progress) / p.fadeOut!));

    if (end !== undefined && progress >= end - SKIP_EARLY_MS) {
      if (skippedToken !== token) {
        if (!playing) return lastTrackGain;
        skippedToken = token;
        skippedAt = t;
        if ((p.fadeOut ?? 0) > 0 || nextStartsQuiet(ctx, skipExplicit)) g = 0;
        Spicetify.Player.next();
        return g;
      }
      if (t - skippedAt < 2000) return lastTrackGain; // waiting for the track change
      g = 1; // the user resumed past the out point on purpose
    }
  }

  // On a natural track end, pre-silence if the next track starts quiet or will be skipped.
  if (naturalEnd && duration - progress < PRE_DIP_MS && nextStartsQuiet(ctx, skipExplicit)) g = 0;
  return g;
}

// ---------------------------------------------------------------- tick

function tick() {
  const t = now();
  // Follow the user's volume, but not just after release(): getVolume() can lag setVolume(),
  // and capturing a faded level would make it the new full volume.
  if (!managing && t - releasedAt > VOLUME_SETTLE_MS) baseVolume = Spicetify.Player.getVolume();
  const game = getGame();
  const playing = Spicetify.Player.isPlaying();
  const { uri, ctx } = nowPlaying();

  // Forget the active set once the user plays something else.
  if (activeSet && mode !== "going" && mode !== "stopping" && ctx && ctx !== findSet(activeSet, game)?.playlist) {
    activeSet = undefined;
    autoStopAt = undefined;
  }

  // Skips are for this run through a playlist; starting a different one forgets them.
  if (ctx && ctx !== skipListCtx) {
    skipListCtx = ctx;
    skipList = [];
  }

  const trackG = uri ? computeTrackGain(t, uri, ctx, playing, game.skipExplicit) : 1;
  lastTrackGain = trackG;

  // Transport state machine
  if (mode === "stopping" && transport.done(t)) {
    const then = afterFade;
    afterFade = null;
    mode = "idle";
    then?.();
  }
  if (mode === "going" && !goPending) {
    const changed = !goNeedsNewTrack || token !== goToken;
    if ((playing && changed && trackG > 0) || t - goStartedAt > GO_TIMEOUT_MS) finishGo(t, game);
  }
  if (mode === "stopped") {
    if (!playing) transport.set(1, 0, t);       // so pressing play in Spotify isn't silent
    else if (transport.target === 1) mode = "idle";
  }
  const stopLead = game.stopFadeSec * 1000;
  if (mode === "playing" && autoStopAt !== undefined && t >= autoStopAt - stopLead) stop();
  if (timerStopAt !== undefined && t >= timerStopAt - stopLead) {
    timerStopAt = undefined;
    stop();
  }
  if (timerEndsAt !== undefined && t >= timerEndsAt + TIMER_OVER_MS) clearTimer();

  publishStatus({
    engine: true,
    mode,
    ducked,
    activeSetId: activeSet,
    breakRemainingMs: autoStopAt !== undefined ? Math.max(0, autoStopAt - t) : undefined,
    timerSetName,
    timerRemainingMs: timerEndsAt !== undefined ? Math.max(0, timerEndsAt - t) : undefined,
    musicStopsInMs: timerStopAt !== undefined ? Math.max(0, timerStopAt - t) : undefined,
    skipList,
    freshStart,
  });

  if (!playing) {
    // Paused: nothing is audible. Hand the volume back once a stop or skip is finished.
    if (mode === "stopped" || skippedToken === token || explicitSkippedToken === token) release();
    return;
  }

  applyGain(trackG * transport.value(t) * duck.value(t));
}

/**
 * Drive ticks from a Worker when possible: Chromium heavily throttles
 * setInterval in hidden windows, which would make fades stutter while
 * Spotify is minimized. Worker timers are not throttled the same way.
 */
function startTicker(fn: () => void, ms: number) {
  const safe = () => { try { fn(); } catch (e) { console.error("[cue-deck]", e); } };
  let fellBack = false;
  const fallback = (reason: unknown) => {
    if (fellBack) return;
    fellBack = true;
    console.warn("[cue-deck] Worker timer unavailable, using setInterval:", reason);
    setInterval(safe, ms);
  };
  try {
    const src = `setInterval(() => postMessage(0), ${ms});`;
    const worker = new Worker(URL.createObjectURL(new Blob([src], { type: "text/javascript" })));
    worker.onmessage = safe;
    worker.onerror = (e) => { worker.terminate(); fallback(e); };
  } catch (e) {
    fallback(e);
  }
}

export function startEngine() {
  const saved = localStorage.getItem(RECOVERY_KEY);
  if (saved != null && Number.isFinite(+saved)) Spicetify.Player.setVolume(+saved);
  localStorage.removeItem(RECOVERY_KEY);
  baseVolume = Spicetify.Player.getVolume();

  Spicetify.Player.addEventListener("songchange", () => {
    token++;
    songChangedAt = now();
  });
  onHold(() => { heldToken = token; });
  onCommand(handle);

  startTicker(tick, TICK_MS);
  console.log("[cue-deck] engine started");
}
