import React from "react";
import { FadePoints, getExact, onChange, requestHold, setPoints } from "../lib/store";
import { formatMs, formatSeconds, nowPlaying, parseTime, seekMs } from "../lib/player";

type Field = keyof FadePoints;

/** Re-render when the playing track changes; returns the playing track URI. */
export function useNowPlayingUri(): string | undefined {
  const [uri, setUri] = React.useState(() => nowPlaying().uri);
  React.useEffect(() => {
    const h = () => setUri(nowPlaying().uri);
    Spicetify.Player.addEventListener("songchange", h);
    return () => Spicetify.Player.removeEventListener("songchange", h);
  }, []);
  return uri;
}

function useProgress(active: boolean): number | undefined {
  const [ms, setMs] = React.useState<number>();
  React.useEffect(() => {
    if (!active) { setMs(undefined); return; }
    const id = setInterval(() => setMs(Spicetify.Player.getProgress()), 200);
    return () => clearInterval(id);
  }, [active]);
  return ms;
}

function TimeField(props: {
  label: string;
  kind: "time" | "seconds";
  value?: number;
  onCommit: (v: number | undefined) => void;
  onUseCurrent?: () => void;
}) {
  const fmt = props.kind === "time" ? formatMs : formatSeconds;
  const [text, setText] = React.useState(fmt(props.value));
  const [bad, setBad] = React.useState(false);
  React.useEffect(() => { setText(fmt(props.value)); setBad(false); }, [props.value]);

  const commit = () => {
    const v = parseTime(text);
    if (v === null) return setBad(true);
    setBad(false);
    if (v !== props.value) props.onCommit(v);
  };

  return (
    <div className={`fp-field${props.kind === "seconds" ? " fp-short" : ""}`}>
      <span>{props.label}</span>
      <input
        className={bad ? "fp-bad" : ""}
        value={text}
        placeholder={props.kind === "time" ? "m:ss.s" : "sec"}
        aria-label={props.label}
        aria-invalid={bad}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      />
      {props.onUseCurrent && (
        <button className="fp-icon-btn" title={`Set ${props.label.toLowerCase()} to the current position`} onClick={props.onUseCurrent}>
          ⌖
        </button>
      )}
    </div>
  );
}

type Handle = "start" | "end";

const SNAP_MS = 100;    // handles snap to tenths, matching the time fields
const EDGE_MS = 50;     // this close to the track's edge clears the point
const MIN_GAP_MS = 500; // keep In and Out at least this far apart
const snap = (ms: number) => Math.round(ms / SNAP_MS) * SNAP_MS;

/**
 * The track's gain over time: silence before the in point, ramps, silence after the out point.
 * Drag the In/Out handles to move them. Clicking the bar seeks while the track is playing,
 * and otherwise moves the nearer handle to that spot.
 */
function Envelope({ p, durationMs, progress, onSet }: {
  p: FadePoints;
  durationMs: number;
  progress?: number;
  onSet: (field: Handle, v: number | undefined) => void;
}) {
  const W = 1000, H = 28, TOP = 3;
  const wrap = React.useRef<HTMLDivElement>(null);
  const [drag, setDrag] = React.useState<{ field: Handle; ms: number } | null>(null);

  const savedStart = p.start ?? 0;
  const savedEnd = Math.min(p.end ?? durationMs, durationMs);
  const start = drag?.field === "start" ? drag.ms : savedStart;
  const end = drag?.field === "end" ? drag.ms : savedEnd;

  const x = (ms: number) => (Math.min(Math.max(ms, 0), durationMs) / durationMs) * W;
  const pct = (ms: number) => `${(Math.min(Math.max(ms, 0), durationMs) / durationMs) * 100}%`;
  const len = end - start;
  let fi = p.fadeIn ?? 0, fo = p.fadeOut ?? 0;
  if (len > 0 && fi + fo > len) { const k = len / (fi + fo); fi *= k; fo *= k; }

  const msAt = (clientX: number) => {
    const r = wrap.current!.getBoundingClientRect();
    return ((clientX - r.left) / r.width) * durationMs;
  };

  /** Clamp a handle position so In stays before Out, snapped to tenths. */
  const clampFor = (field: Handle, ms: number) =>
    field === "start"
      ? snap(Math.min(Math.max(ms, 0), savedEnd - MIN_GAP_MS))
      : snap(Math.max(Math.min(ms, durationMs), savedStart + MIN_GAP_MS));

  /** Save a handle position, clearing it when it sits at the track's edge. */
  const commit = (field: Handle, ms: number) => {
    const v = field === "start" ? (ms <= EDGE_MS ? undefined : ms) : (ms >= durationMs - EDGE_MS ? undefined : ms);
    if (v !== (field === "start" ? p.start : p.end)) onSet(field, v);
  };

  const onHandleDown = (field: Handle) => (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.focus();
    setDrag({ field, ms: field === "start" ? savedStart : savedEnd });
  };
  const onHandleMove = (field: Handle) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag?.field === field) setDrag({ field, ms: clampFor(field, msAt(e.clientX)) });
  };
  const onHandleUp = (field: Handle) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag?.field !== field) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    commit(field, drag.ms);
    setDrag(null);
  };

  const onKey = (field: Handle) => (e: React.KeyboardEvent<HTMLDivElement>) => {
    const cur = field === "start" ? savedStart : savedEnd;
    const step = e.shiftKey ? 1000 : SNAP_MS;
    let next: number;
    switch (e.key) {
      case "ArrowLeft": case "ArrowDown": next = cur - step; break;
      case "ArrowRight": case "ArrowUp": next = cur + step; break;
      case "Home": next = 0; break;
      case "End": next = durationMs; break;
      default: return;
    }
    e.preventDefault();
    commit(field, clampFor(field, next));
  };

  const onBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const ms = msAt(e.clientX);
    if (progress !== undefined) return seekMs(ms);
    const field: Handle = Math.abs(ms - savedStart) <= Math.abs(ms - savedEnd) ? "start" : "end";
    commit(field, clampFor(field, ms));
  };

  const handle = (field: Handle, ms: number) => {
    const label = field === "start" ? "In point" : "Out point";
    return (
      <div
        className={`fp-env-handle${drag?.field === field ? " fp-dragging" : ""}`}
        style={{ left: pct(ms) }}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={Math.round(durationMs / 1000)}
        aria-valuenow={Math.round(ms / 1000)}
        aria-valuetext={formatMs(ms)}
        title={`${label}: drag to move. Arrow keys nudge 0.1 s, Shift+arrow 1 s.`}
        onPointerDown={onHandleDown(field)}
        onPointerMove={onHandleMove(field)}
        onPointerUp={onHandleUp(field)}
        onPointerCancel={() => setDrag(null)}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKey(field)}
      >
        {drag?.field === field && <span className="fp-env-tip">{formatMs(ms)}</span>}
      </div>
    );
  };

  return (
    <div
      ref={wrap}
      className="fp-env-wrap"
      onClick={onBarClick}
      title={progress !== undefined ? "Click to seek" : "Click to move the nearer In or Out point here"}
    >
      <svg
        className="fp-env"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Plays ${formatMs(start)} to ${formatMs(end)}, fade in ${formatSeconds(fi)}s, fade out ${formatSeconds(fo)}s`}
      >
        <rect className="fp-env-track" x={0} y={H - 2} width={W} height={2} />
        {len > 0 && (
          <polygon
            className="fp-env-shape"
            points={`${x(start)},${H} ${x(start + fi)},${TOP} ${x(end - fo)},${TOP} ${x(end)},${H}`}
          />
        )}
        {progress !== undefined && <line className="fp-env-head" x1={x(progress)} x2={x(progress)} y1={0} y2={H} />}
      </svg>
      {handle("start", start)}
      {handle("end", end)}
    </div>
  );
}

export function PointsEditor({ trackUri, scope, durationMs }: { trackUri: string; scope: string; durationMs?: number }) {
  const [p, setP] = React.useState<FadePoints>(() => getExact(scope, trackUri) ?? {});
  React.useEffect(() => {
    setP(getExact(scope, trackUri) ?? {});
    return onChange(() => setP(getExact(scope, trackUri) ?? {}));
  }, [scope, trackUri]);

  const isCurrent = useNowPlayingUri() === trackUri;
  const progress = useProgress(isCurrent);
  const duration = durationMs || (isCurrent ? Spicetify.Player.getDuration() : 0);

  const commit = (field: Field) => (v: number | undefined) => {
    // Setting an out point behind the playhead would skip immediately; let this play-through finish.
    if (field === "end" && isCurrent && v !== undefined && v <= Spicetify.Player.getProgress()) requestHold();
    setPoints(scope, trackUri, { [field]: v });
  };
  const useCurrent = (field: Field) =>
    isCurrent ? () => commit(field)(Math.round(Spicetify.Player.getProgress())) : undefined;

  const invalid = p.start != null && p.end != null && p.end <= p.start;

  return (
    <div className="fp-editor">
      <div className="fp-fields">
        <TimeField label="In" kind="time" value={p.start} onCommit={commit("start")} onUseCurrent={useCurrent("start")} />
        <TimeField label="Out" kind="time" value={p.end} onCommit={commit("end")} onUseCurrent={useCurrent("end")} />
        <TimeField label="Fade in" kind="seconds" value={p.fadeIn} onCommit={commit("fadeIn")} />
        <TimeField label="Fade out" kind="seconds" value={p.fadeOut} onCommit={commit("fadeOut")} />
      </div>
      {invalid && <div className="fp-warn">The out point is before the in point, so the out point is ignored.</div>}
      {duration > 0 && <Envelope p={p} durationMs={duration} progress={progress} onSet={(f, v) => commit(f)(v)} />}
    </div>
  );
}
