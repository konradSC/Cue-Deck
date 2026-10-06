import React from "react";
import { getPlaylistTracks, PlaylistRef } from "../lib/api";
import {
  GameEvent, GameSet, GameSettings, MAX_HOTKEY_SETS, SkipEntry, Status,
  activeEvent, addEvent, findSet, getGame, getStatus, matchesSkip, newSet, onGameChange, removeEvent, send, setGame, updateEvent, updateSet,
} from "../lib/game";
import { canContinue, nowPlaying, QueueTrack, upcoming } from "../lib/player";
import { resolvePoints } from "../lib/store";
import { ExplicitBadge } from "./EditorPage";

function useGame(): GameSettings {
  const [g, setG] = React.useState(getGame);
  React.useEffect(() => onGameChange(() => setG(getGame())), []);
  return g;
}

function useStatus(): Status {
  const [s, setS] = React.useState(getStatus);
  React.useEffect(() => {
    const id = setInterval(() => setS({ ...getStatus() }), 200);
    return () => clearInterval(id);
  }, []);
  return s;
}

function useTrackInfo() {
  const read = () => {
    const d: any = Spicetify.Player.data;
    const item = d?.item ?? d?.track;
    return {
      name: item?.name ?? item?.metadata?.title ?? "",
      artists: (item?.artists ?? []).map((a: any) => a.name).join(", ") || item?.metadata?.artist_name || "",
      contextName: (d?.context?.metadata?.context_description as string | undefined) || "",
    };
  };
  const [info, setInfo] = React.useState(read);
  React.useEffect(() => {
    const h = () => setInfo(read());
    Spicetify.Player.addEventListener("songchange", h);
    return () => Spicetify.Player.removeEventListener("songchange", h);
  }, []);
  return info;
}

const clock = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** Number input that commits on blur or Enter and snaps back if invalid. */
function NumberField(props: { label: string; value: number; min?: number; max?: number; suffix?: string; hideLabel?: boolean; onCommit: (v: number) => void }) {
  const [text, setText] = React.useState(String(props.value));
  React.useEffect(() => setText(String(props.value)), [props.value]);
  const commit = () => {
    const v = Number(text);
    if (text.trim() === "" || !Number.isFinite(v) || v < (props.min ?? 0) || (props.max != null && v > props.max)) {
      setText(String(props.value));
      return;
    }
    if (v !== props.value) props.onCommit(v);
  };
  return (
    <label className="fp-field fp-short">
      {!props.hideLabel && <span>{props.label}</span>}
      <input
        inputMode="decimal"
        value={text}
        aria-label={props.hideLabel ? props.label : undefined}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      />
      {props.suffix && <span>{props.suffix}</span>}
    </label>
  );
}

/** Text input that commits on blur or Enter; an empty value snaps back. */
function TextField(props: { label: string; value: string; className?: string; onCommit: (v: string) => void }) {
  const [text, setText] = React.useState(props.value);
  React.useEffect(() => setText(props.value), [props.value]);
  const commit = () => {
    const v = text.trim();
    if (!v) return setText(props.value);
    if (v !== props.value) props.onCommit(v);
  };
  return (
    <input
      className={props.className}
      value={text}
      aria-label={props.label}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
    />
  );
}

/**
 * A Spotify-style tooltip (the Tippy instance Spotify's own buttons use) on the returned ref,
 * with white text like the top bar button. Falls back to nothing if Tippy isn't available.
 */
function useTooltip<T extends HTMLElement>(content: string | undefined) {
  const ref = React.useRef<T>(null);
  const tip = React.useRef<any>(null);
  React.useEffect(() => {
    if (!ref.current || !Spicetify.Tippy) return;
    tip.current = Spicetify.Tippy(ref.current, {
      ...Spicetify.TippyProps,
      content: "",
      onCreate: (t: any) => t.popper.classList.add("fp-nav-tip"),
    });
    return () => { tip.current?.destroy(); tip.current = null; };
  }, []);
  React.useEffect(() => {
    if (!tip.current) return;
    tip.current.setContent(content ?? "");
    if (content) tip.current.enable(); else tip.current.disable();
  }, [content]);
  return ref;
}

/** A button that asks for a second click before acting, instead of a dialog. */
function ConfirmButton(props: {
  label: React.ReactNode; confirmLabel: string; className: string; title?: string; ariaLabel?: string; disabled?: boolean; onConfirm: () => void;
  /** Spotify-style tooltip instead of `title`, with different text while waiting for the second click. */
  tooltip?: { idle: string; armed: string };
}) {
  const [armed, setArmed] = React.useState(false);
  const tipRef = useTooltip<HTMLButtonElement>(props.tooltip && (armed ? props.tooltip.armed : props.tooltip.idle));
  React.useEffect(() => {
    if (!armed) return;
    const id = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(id);
  }, [armed]);
  return (
    <button
      ref={tipRef}
      className={`${props.className}${armed ? " fp-armed" : ""}`}
      title={props.tooltip ? undefined : props.title}
      aria-label={armed ? undefined : props.ariaLabel}
      disabled={props.disabled}
      onClick={() => {
        if (!armed) return setArmed(true);
        setArmed(false);
        props.onConfirm();
      }}
      onBlur={() => setArmed(false)}
    >
      {armed ? props.confirmLabel : props.label}
    </button>
  );
}

// ---------------------------------------------------------------- deck

function Deck({ game, status, playlists }: { game: GameSettings; status: Status; playlists: PlaylistRef[] }) {
  const track = useTrackInfo();
  const { uri, ctx } = nowPlaying();
  const playing = findSet(status.activeSetId ?? "", game);
  const playlistName = playlists.find((p) => p.uri === ctx)?.name || track.contextName;

  let big: string;
  let caption: string;
  if (status.timerRemainingMs !== undefined) {
    big = clock(status.timerRemainingMs);
    const what = status.timerSetName ?? "the countdown";
    caption = status.timerRemainingMs === 0
      ? `${what} is over`
      : status.musicStopsInMs !== undefined
        ? `left in ${what}. Music stops in ${clock(status.musicStopsInMs)}.`
        : `left in ${what}. Music has stopped.`;
  } else if (status.breakRemainingMs !== undefined) {
    big = clock(status.breakRemainingMs);
    caption = "until the music fades out";
  } else {
    big = { idle: Spicetify.Player.isPlaying() ? "Playing" : "Ready", stopping: "Stopping", stopped: "Stopped", going: "Starting", playing: "Playing" }[status.mode];
    caption = "";
  }

  return (
    <section className="fp-deck" aria-label="Game controls">
      <div className="fp-deck-top">
        <div className="fp-now" aria-live="polite">
          <div className={`fp-now-cue${playing ? "" : " fp-dim"}`}>
            {playing && Spicetify.Player.isPlaying() && <span className="fp-playing-dot" aria-hidden="true" />}
            {playing ? `Cue: ${playing.name}` : "No cue playing"}
          </div>
          <div className="fp-now-title">{uri ? track.name : "Nothing playing"}</div>
          {uri && <div className="fp-artist">{track.artists}</div>}
          {uri && playlistName && <div className="fp-source">{playlistName}</div>}
        </div>
        <div className="fp-clock-wrap" aria-live="polite">
          <div className={`fp-clock${status.mode === "stopped" ? " fp-clock-stopped" : ""}`}>{big}</div>
          {caption && <div className="fp-clock-caption">{caption}</div>}
          {status.timerRemainingMs !== undefined && (
            <button className="fp-link" onClick={() => send({ type: "cancelTimer" })}>Cancel countdown</button>
          )}
        </div>
      </div>

      <div className="fp-transport">
        <button className="fp-go" onClick={() => send({ type: "go" })}>
          Go<span className="fp-key">Ctrl+Alt+G</span>
        </button>
        <button className="fp-stop" onClick={() => send({ type: "stop" })}>
          Stop<span className="fp-key">Ctrl+Alt+S</span>
        </button>
        <button className="fp-duck" aria-pressed={status.ducked} onClick={() => send({ type: "duck" })}>
          {status.ducked ? "Unduck" : "Duck"}<span className="fp-key">Ctrl+Alt+D</span>
        </button>
      </div>
      <p className="fp-hint">
        Go {game.goNextTrack ? "starts the next track" : "resumes the paused track"} with a {game.goFadeSec} s fade.
        Stop fades out over {game.stopFadeSec} s. Duck drops the music to {game.duckPercent}%.
      </p>
    </section>
  );
}

// ---------------------------------------------------------------- up next

const UP_NEXT_COUNT = 5;

function useUpcoming(): QueueTrack[] {
  const [list, setList] = React.useState(upcoming);
  React.useEffect(() => {
    const id = setInterval(() => setList(upcoming()), 500);
    return () => clearInterval(id);
  }, []);
  return list;
}

const mmss = (ms: number) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** The song's length, or how much of it plays when it has in or out points ("0:45 of 3:12"). */
function playLength(t: QueueTrack, ctx?: string): string {
  if (!t.durationMs) return "";
  const p = resolvePoints(t.uri, ctx);
  const start = p?.start ?? 0;
  const end = Math.min(p?.end ?? t.durationMs, t.durationMs);
  return start > 0 || end < t.durationMs ? `${mmss(end - start)} of ${mmss(t.durationMs)}` : mmss(t.durationMs);
}

// Whether Up next shows the full list or just the next song. Remembered on this computer.
const UP_NEXT_OPEN_KEY = "cue-deck:upnext-open";

function useUpNextOpen(): [boolean, (open: boolean) => void] {
  const [open, setOpen] = React.useState(() => {
    try { return localStorage.getItem(UP_NEXT_OPEN_KEY) === "1"; } catch { return false; }
  });
  const set = (v: boolean) => {
    setOpen(v);
    try { localStorage.setItem(UP_NEXT_OPEN_KEY, v ? "1" : "0"); } catch { /* not remembered */ }
  };
  return [open, set];
}

/**
 * The next few songs in the loaded playlist (and anything added to the queue), with Skip.
 * Folded, it shows only the song that plays next, so the cues table stays in view.
 */
function UpNext({ game, status, playlists }: { game: GameSettings; status: Status; playlists: PlaylistRef[] }) {
  const list = useUpcoming();
  const [open, setOpen] = useUpNextOpen();
  const { uri, ctx } = nowPlaying();
  if (!uri) return null;
  const cue = findSet(status.activeSetId ?? "", game);
  const source = cue?.name ?? playlists.find((p) => p.uri === ctx)?.name;
  const skipList = status.skipList ?? [];

  let nextFound = false;
  const rows = list.slice(0, UP_NEXT_COUNT).map((t) => {
    const listed = skipList.some((e) => matchesSkip(e, t.uri, t.uid));
    const explicitSkip = game.skipExplicit && t.explicit;
    const isNext = !listed && !explicitSkip && !nextFound;
    if (isNext) nextFound = true;
    return { t, listed, explicitSkip, isNext };
  });
  const shown = open ? rows : rows.filter((r) => r.isNext).concat(nextFound ? [] : rows.slice(0, 1));
  const skippedCount = rows.filter((r) => r.listed || r.explicitSkip).length;

  return (
    <section aria-label="Up next">
      <div className="fp-upnext-head">
        <h2 className="fp-upnext-title">Up next{source && <span className="fp-dim"> in {source}</span>}</h2>
        {rows.length > 1 && (
          <button className="fp-link" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? "Show less" : `Show ${rows.length}${skippedCount ? ` (${skippedCount} skipped)` : ""}`}
          </button>
        )}
      </div>
      {list.length === 0 ? (
        <p className="fp-hint">
          Nothing after this song.{cue && ` Pressing ${cue.name} again starts its playlist over.`}
        </p>
      ) : (
        <ol className="fp-upnext">
          {shown.map(({ t, listed, explicitSkip, isNext }, i) => {
            const entry = { uri: t.uri, uid: t.uid };
            return (
              <li key={t.uid ?? `${t.uri}-${i}`} className={listed || explicitSkip ? "fp-upnext-skipped" : ""}>
                <div className="fp-upnext-main">
                  <div className="fp-upnext-name">{t.explicit && <ExplicitBadge />}{t.name}</div>
                  <div className="fp-upnext-artist">{t.artists}</div>
                </div>
                <div className="fp-upnext-meta">
                  {isNext && <span className="fp-chip fp-chip-next">Plays next</span>}
                  {t.queued && <span className="fp-chip">Added to queue</span>}
                  {listed && <span className="fp-chip">Will skip</span>}
                  {explicitSkip && <span className="fp-chip">Skipped: explicit</span>}
                  <span className="fp-upnext-len">{playLength(t, ctx)}</span>
                </div>
                <div className="fp-upnext-action">
                  {!explicitSkip && (
                    <button className="fp-btn fp-btn-primary fp-btn-small" aria-label={`Play ${t.name} now`} title="Fade out and play this song now"
                      onClick={() => send({ type: "playUpcoming", track: entry })}>Play</button>
                  )}
                  {listed ? (
                    <button className="fp-btn fp-btn-small" aria-label={`Don't skip ${t.name}`} onClick={() => send({ type: "unskipUpcoming", track: entry })}>Undo</button>
                  ) : !explicitSkip && (
                    <button className="fp-btn fp-btn-small" aria-label={`Skip ${t.name}`} onClick={() => send({ type: "skipUpcoming", track: entry })}>Skip</button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {open && list.length > UP_NEXT_COUNT && <p className="fp-hint fp-upnext-more">and {list.length - UP_NEXT_COUNT} more</p>}
    </section>
  );
}

// ---------------------------------------------------------------- event title and sets bar

const RESET_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 3v6h6" />
  </svg>
);

/**
 * The page title on the Live tab: the active event's name, which switches events when clicked,
 * and Reset event, which clears everything left over from testing (two clicks, so a stray
 * click mid-game can't stop the music).
 */
export function EventTitle() {
  const game = useGame();
  const ev = activeEvent(game);
  const reset = () => {
    send({ type: "resetEvent" });
    Spicetify.showNotification(`${ev.name} reset: ready to start`);
  };
  return (
    <div className="fp-title-row">
      <div className="fp-event-title">
        <h1 className="fp-sr">{ev.name}</h1>
        <select
          value={ev.id}
          aria-label="Event"
          title="Switch event"
          onChange={(e) => setGame({ activeEvent: e.target.value })}
        >
          {game.events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </div>
      <ConfirmButton className="fp-icon-btn fp-reset-btn" label={RESET_ICON} confirmLabel="Reset?"
        tooltip={{ idle: "Reset event", armed: "Click again to reset event" }} ariaLabel="Reset event" onConfirm={reset} />
    </div>
  );
}

function SetsBar({ game, ev, editing, setEditing }: { game: GameSettings; ev: GameEvent; editing: boolean; setEditing: (v: boolean) => void }) {
  // New events open selected, with the name field ready to rename.
  const create = (copy: boolean) => addEvent(copy ? `${ev.name} copy` : "New event", copy ? ev : undefined);

  return (
    <div className="fp-eventbar">
      <h2>Cues</h2>
      {editing && (
        <>
          <label className="fp-field">
            <span>Event name</span>
            <TextField label="Event name" className="fp-name-input" value={ev.name} onCommit={(name) => updateEvent(ev.id, (e) => ({ ...e, name }))} />
          </label>
          <button className="fp-btn" onClick={() => create(false)}>New event</button>
          <button className="fp-btn" onClick={() => create(true)}>Duplicate</button>
          <ConfirmButton
            className="fp-btn"
            label="Delete event"
            confirmLabel={`Delete ${ev.name} and its ${ev.sets.length} cues?`}
            disabled={game.events.length <= 1}
            title={game.events.length <= 1 ? "Keep at least one event" : undefined}
            onConfirm={() => removeEvent(ev.id)}
          />
        </>
      )}
      <div className="fp-spacer" />
      <button className={`fp-btn${editing ? " fp-btn-primary" : ""}`} onClick={() => setEditing(!editing)}>
        {editing ? "Done" : "Edit cues"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- sets table

function playsText(s: GameSet) {
  return s.maxPlaySec > 0 ? `${s.maxPlaySec} s` : "Until Stop";
}

function SetRow(props: {
  s: GameSet; i: number; ev: GameEvent; editing: boolean; active: boolean; fresh: boolean;
  playlists: PlaylistRef[]; explicitCount?: number; skipExplicit: boolean; skipList: SkipEntry[];
}) {
  const { s, i, ev, editing } = props;
  // Same check as the engine, so Next only shows when pressing really moves on to the next song.
  const loaded = !props.fresh && canContinue(s.playlist ?? "", (t) =>
    props.skipList.some((e) => matchesSkip(e, t.uri, t.uid)) || (props.skipExplicit && t.explicit));
  const patch = (p: Partial<GameSet>) => updateSet(ev.id, s.id, p);
  const move = (d: number) => updateEvent(ev.id, (e) => {
    const sets = [...e.sets];
    const [x] = sets.splice(i, 1);
    sets.splice(i + d, 0, x);
    return { ...e, sets };
  });
  const remove = () => updateEvent(ev.id, (e) => ({ ...e, sets: e.sets.filter((x) => x.id !== s.id) }));
  const playlistName = props.playlists.find((p) => p.uri === s.playlist)?.name;
  const key = i < MAX_HOTKEY_SETS ? `Ctrl+Alt+${i + 1}` : "";

  const explicit = props.explicitCount ? (
    <span className="fp-explicit-count" title={props.skipExplicit ? "Skipped during play" : "Explicit tracks in this playlist"}>
      <ExplicitBadge />{props.explicitCount}
    </span>
  ) : <span className="fp-dim">—</span>;

  if (!editing) {
    return (
      <tr className={props.active ? "fp-set-active" : ""}>
        <td className="fp-key-cell">{key && <span className="fp-key">{key}</span>}</td>
        <td className="fp-set-name">
          {props.active && <span className="fp-playing-dot" aria-label="Playing" />}
          {s.name}
        </td>
        <td className="fp-ellipsis">{playlistName ?? (s.playlist ? <span className="fp-dim">Unknown playlist</span> : <span className="fp-warn">No playlist</span>)}</td>
        <td>{playsText(s)}{s.shuffle && <span className="fp-dim" title="Shuffle"> · shuffle</span>}</td>
        <td>{s.timerMin > 0 ? `${s.timerMin} min` : <span className="fp-dim">—</span>}</td>
        <td>{explicit}</td>
        <td className="fp-play-cell">
          {/* Once this cue's playlist is loaded, Play moves on to its next song; Restart starts it over. */}
          {loaded && (
            <button className="fp-btn fp-btn-small" title="Start the playlist again from the first song (or a fresh shuffle)"
              onClick={() => send({ type: "startSet", setId: s.id, restart: true })}>
              Restart
            </button>
          )}
          <button className="fp-btn fp-btn-primary fp-btn-small" disabled={!s.playlist} onClick={() => send({ type: "startSet", setId: s.id })}
            title={loaded ? "Play the next song in this playlist" : undefined}>
            {loaded ? "Next" : "Play"}
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td className="fp-key-cell">
        <div className="fp-reorder">
          <button className="fp-icon-btn" title="Move up" aria-label={`Move ${s.name} up`} disabled={i === 0} onClick={() => move(-1)}>▲</button>
          <button className="fp-icon-btn" title="Move down" aria-label={`Move ${s.name} down`} disabled={i === ev.sets.length - 1} onClick={() => move(1)}>▼</button>
        </div>
      </td>
      <td><TextField label="Cue name" className="fp-name-input" value={s.name} onCommit={(name) => patch({ name })} /></td>
      <td>
        <select value={s.playlist ?? ""} onChange={(e) => patch({ playlist: e.target.value || undefined })} aria-label={`${s.name} playlist`}>
          <option value="">Choose a playlist</option>
          {props.playlists.map((p) => <option key={p.uri} value={p.uri}>{p.name}</option>)}
        </select>
      </td>
      <td>
        <div className="fp-cell-row">
          <NumberField label="Stop after, seconds (0 plays until Stop)" hideLabel suffix="s" value={s.maxPlaySec} onCommit={(v) => patch({ maxPlaySec: Math.round(v) })} />
          <label className="fp-check"><input type="checkbox" checked={s.shuffle} onChange={(e) => patch({ shuffle: e.target.checked })} />Shuffle</label>
        </div>
      </td>
      <td>
        <div className="fp-cell-row">
          <NumberField label="Countdown, minutes (0 for none)" hideLabel suffix="min" value={s.timerMin} max={180} onCommit={(v) => patch({ timerMin: v })} />
          {s.timerMin > 0 && (
            <NumberField label="Stop music" suffix="s early" value={s.timerLeadSec} onCommit={(v) => patch({ timerLeadSec: Math.round(v) })} />
          )}
        </div>
      </td>
      <td>{explicit}</td>
      <td className="fp-play-cell">
        <ConfirmButton className="fp-btn fp-btn-small" label="Delete" confirmLabel="Sure?" title={`Delete ${s.name}`} onConfirm={remove} />
      </td>
    </tr>
  );
}

function SetsTable({ game, ev, status, editing, playlists }: { game: GameSettings; ev: GameEvent; status: Status; editing: boolean; playlists: PlaylistRef[] }) {
  const [explicitCounts, setExplicitCounts] = React.useState<Record<string, number>>({});
  const assigned = ev.sets.map((s) => s.playlist).filter(Boolean) as string[];
  React.useEffect(() => {
    for (const uri of assigned) {
      if (uri in explicitCounts) continue;
      getPlaylistTracks(uri)
        .then((ts) => setExplicitCounts((c) => ({ ...c, [uri]: ts.filter((t) => t.explicit).length })))
        .catch(() => { /* counts are advisory */ });
    }
  }, [assigned.join("|")]);

  return (
    <>
      <table className={`fp-sets-table${editing ? " fp-editing" : ""}`}>
        <thead>
          <tr>
            <th className="fp-key-cell">{editing ? "Order" : "Key"}</th>
            <th>Cue</th>
            <th>Playlist</th>
            <th>{editing ? "Stop after" : "Plays"}</th>
            <th>Countdown</th>
            <th>Explicit</th>
            <th className="fp-play-cell"><span className="fp-sr">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {ev.sets.map((s, i) => (
            <SetRow
              key={s.id}
              s={s}
              i={i}
              ev={ev}
              editing={editing}
              active={status.activeSetId === s.id}
              fresh={!!status.freshStart}
              skipList={status.skipList ?? []}
              playlists={playlists}
              explicitCount={s.playlist ? explicitCounts[s.playlist] : undefined}
              skipExplicit={game.skipExplicit}
            />
          ))}
        </tbody>
      </table>
      {!ev.sets.length && <p className="fp-empty">This event has no cues yet. Click Edit cues to add one.</p>}
      {editing && (
        <div className="fp-row-flex fp-table-foot">
          <button className="fp-btn" onClick={() => updateEvent(ev.id, (e) => ({ ...e, sets: [...e.sets, newSet()] }))}>Add cue</button>
          <p className="fp-hint">
            Stop after 0 plays until you press Stop. A countdown shows on the clock while the cue plays and fades the music out before it ends, for halftime.
            {ev.sets.length > MAX_HOTKEY_SETS && ` Only the first ${MAX_HOTKEY_SETS} cues have hotkeys.`}
          </p>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------- settings

function Settings({ game }: { game: GameSettings }) {
  return (
    <details className="fp-settings">
      <summary>Settings</summary>
      <div className="fp-row-flex">
        <NumberField label="Stop fade" suffix="s" value={game.stopFadeSec} max={10} onCommit={(v) => setGame({ stopFadeSec: v })} />
        <NumberField label="Go fade" suffix="s" value={game.goFadeSec} max={10} onCommit={(v) => setGame({ goFadeSec: v })} />
        <NumberField label="Duck to" suffix="%" value={game.duckPercent} max={100} onCommit={(v) => setGame({ duckPercent: Math.round(v) })} />
      </div>
      <div className="fp-row-flex">
        <label className="fp-check">
          <input type="radio" name="fp-go" checked={game.goNextTrack} onChange={() => setGame({ goNextTrack: true })} />
          Go starts the next track
        </label>
        <label className="fp-check">
          <input type="radio" name="fp-go" checked={!game.goNextTrack} onChange={() => setGame({ goNextTrack: false })} />
          Go resumes the paused track
        </label>
      </div>
      <label className="fp-check">
        <input type="checkbox" checked={game.skipExplicit} onChange={(e) => setGame({ skipExplicit: e.target.checked })} />
        Skip explicit tracks during play (applies everywhere, not just on this page)
      </label>
    </details>
  );
}

export function GamePage({ playlists }: { playlists: PlaylistRef[] }) {
  const game = useGame();
  const status = useStatus();
  const [editing, setEditing] = React.useState(false);
  const ev = activeEvent(game);

  return (
    <div className="fp-game">
      {!status.engine && (
        <div className="fp-warn fp-banner">
          The fade engine isn't running, so these controls won't do anything. Run <code>spicetify apply</code> and restart Spotify.
        </div>
      )}
      <Deck game={game} status={status} playlists={playlists} />
      <UpNext game={game} status={status} playlists={playlists} />
      <section>
        <SetsBar game={game} ev={ev} editing={editing} setEditing={setEditing} />
        <SetsTable game={game} ev={ev} status={status} editing={editing} playlists={playlists} />
      </section>
      <section>
        <Settings game={game} />
      </section>
    </div>
  );
}
