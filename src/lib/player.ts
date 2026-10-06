// Small wrappers over Spicetify.Player. Field names on Player.data have moved
// between Spotify versions, so every lookup tries the newer name first.

export function nowPlaying(): { uri?: string; ctx?: string } {
  const d: any = Spicetify.Player.data;
  return {
    uri: d?.item?.uri ?? d?.track?.uri,
    ctx: d?.context?.uri ?? d?.context_uri,
  };
}

export interface QueueTrack {
  uri: string;
  uid?: string;
  name: string;
  artists: string;
  durationMs?: number;
  explicit: boolean;
  queued: boolean; // added with "Add to queue" rather than coming from the playlist
}

function toQueueTrack(o: any): QueueTrack | null {
  const t = o?.contextTrack ?? o; // older Spicetify.Queue entries wrap the track
  if (!t?.uri) return null;
  const md = t.metadata ?? {};
  const duration = o?.duration?.milliseconds ?? t.duration?.milliseconds ?? (Number(md.duration) || undefined);
  return {
    uri: t.uri,
    uid: t.uid,
    name: o?.name || md.title || "",
    artists: (o?.artists ?? []).map((a: any) => a.name).join(", ") || md.artist_name || "",
    durationMs: duration,
    explicit: isExplicitTrack(o) || isExplicitTrack(t),
    queued: o?.provider === "queue",
  };
}

/**
 * What plays after the current track, in order: songs added to the queue first, then
 * the rest of the playlist or album. Autoplay suggestions are left out.
 */
export function upcoming(): QueueTrack[] {
  const api = (Spicetify.Platform as any)?.PlayerAPI;
  const q = api?.getQueue?.();
  const raw: any[] = q
    ? [...(q.queued ?? []), ...(q.nextUp ?? [])]
    : (Spicetify as any).Queue?.nextTracks ?? []; // older Spotify versions
  return raw
    .filter((o) => (o?.provider ?? o?.contextTrack?.provider) !== "autoplay")
    .map(toQueueTrack)
    .filter((t): t is QueueTrack => !!t && !t.uri.startsWith("spotify:delimiter") && !t.uri.startsWith("spotify:meta:"));
}

/**
 * Is `playlist` loaded with a song still to come from it (not just songs added to the queue)?
 * `willSkip` leaves out songs that would be skipped. Shared by the engine and the cues table,
 * so the Next/Play label matches what pressing the set will do.
 */
export function canContinue(playlist: string, willSkip: (t: QueueTrack) => boolean = () => false): boolean {
  return !!playlist && nowPlaying().ctx === playlist && upcoming().some((t) => !t.queued && !willSkip(t));
}

export function nextTrackUri(): string | undefined {
  return upcoming()[0]?.uri;
}

/** The playing track's uid, which tells apart two copies of the same song in a playlist. */
export function currentUid(): string | undefined {
  const d: any = Spicetify.Player.data;
  return d?.item?.uid ?? d?.track?.uid;
}

/** Spicetify treats seek values <= 1 as a fraction of the track, so clamp to 2 ms. */
export function seekMs(ms: number) {
  Spicetify.Player.seek(Math.max(2, Math.round(ms)));
}

export function formatMs(ms?: number): string {
  if (ms == null) return "";
  const tenths = Math.round(ms / 100);
  const m = Math.floor(tenths / 600);
  const s = (tenths % 600) / 10;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}

export function formatSeconds(ms?: number): string {
  return ms == null ? "" : String(+(ms / 1000).toFixed(2));
}

/**
 * Parse "1:23.4", "83.4", or "1:02:03" into ms.
 * Returns undefined for an empty field and null for invalid input.
 */
export function parseTime(text: string): number | undefined | null {
  const t = text.trim();
  if (!t) return undefined;
  const parts = t.split(":").map(Number);
  if (parts.length > 3 || parts.some((p) => !Number.isFinite(p) || p < 0)) return null;
  return Math.round(parts.reduce((acc, p) => acc * 60 + p, 0) * 1000);
}

export function waitForTrack(uri: string, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    if (nowPlaying().uri === uri) return resolve(true);
    const done = (ok: boolean) => {
      Spicetify.Player.removeEventListener("songchange", handler);
      clearTimeout(timer);
      resolve(ok);
    };
    const handler = () => { if (nowPlaying().uri === uri) done(true); };
    const timer = setTimeout(() => done(false), timeoutMs);
    Spicetify.Player.addEventListener("songchange", handler);
  });
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Explicit flags appear under different names depending on where the track object came from.
export function isExplicitTrack(o: any): boolean {
  return o?.isExplicit === true || o?.explicit === true || o?.metadata?.is_explicit === "true";
}

export function isCurrentExplicit(): boolean {
  const d: any = Spicetify.Player.data;
  return isExplicitTrack(d?.item ?? d?.track);
}

export function isNextExplicit(): boolean {
  return upcoming()[0]?.explicit ?? false;
}
