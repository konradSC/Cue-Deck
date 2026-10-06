import React from "react";
import { mount } from "./mount";
import { getPlaylistTracks, playInPlaylist, PlaylistRef, TrackRef } from "../lib/api";
import { clearScope, exportJson, importJson, resolvePoints, setPoints, setPointsBatch } from "../lib/store";
import { formatMs, nowPlaying, parseTime, seekMs, sleep, waitForTrack } from "../lib/player";
import { PointsEditor, useNowPlayingUri } from "./PointsEditor";

export const ExplicitBadge = () => <span className="fp-explicit" title="Explicit" aria-label="Explicit">E</span>;

function ImportForm() {
  const [text, setText] = React.useState("");
  const [msg, setMsg] = React.useState("");
  const run = () => {
    try {
      const n = importJson(text);
      setMsg(`Imported ${n} tracks.`);
      Spicetify.showNotification(`Imported fade points for ${n} tracks`);
    } catch (e) {
      setMsg(`Couldn't import: ${(e as Error).message}. Paste the JSON from Export.`);
    }
  };
  return (
    <div className="fp-popup">
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste exported JSON here" />
      <div><button className="fp-btn fp-btn-primary" onClick={run}>Import</button></div>
      {msg && <div>{msg}</div>}
    </div>
  );
}

function TrackRow({ t, i, playlist, current }: { t: TrackRef; i: number; playlist: string; current: boolean }) {
  const previewOut = async () => {
    const p = resolvePoints(t.uri, playlist) ?? {};
    const outAt = p.end ?? t.durationMs;
    const target = Math.max(p.start ?? 0, outAt - (p.fadeOut ?? 0) - 4000);
    if (nowPlaying().uri !== t.uri) {
      await playInPlaylist(playlist, t.uri);
      if (!(await waitForTrack(t.uri, 3000))) return;
      await sleep(400); // let the engine's jump to the in point land first
    }
    seekMs(target);
  };

  return (
    <div className={`fp-row${current ? " fp-current" : ""}`}>
      <div className="fp-index">{i + 1}</div>
      <div style={{ minWidth: 0 }}>
        <div className="fp-title" title={t.name}>{t.explicit && <ExplicitBadge />}{t.name}</div>
        <div className="fp-artist">{t.artists}, {formatMs(t.durationMs).replace(/\.\d$/, "")}</div>
      </div>
      <PointsEditor trackUri={t.uri} scope={playlist} durationMs={t.durationMs} />
      <div className="fp-actions">
        <button className="fp-icon-btn" title="Play from the in point" onClick={() => playInPlaylist(playlist, t.uri)}>▶</button>
        <button className="fp-icon-btn" title="Play the last few seconds before the out point" onClick={previewOut}>⇥</button>
        <button className="fp-icon-btn" title="Clear fade points" onClick={() => setPoints(playlist, t.uri, null)}>✕</button>
      </div>
    </div>
  );
}

export function EditorPage({ playlists }: { playlists: PlaylistRef[] }) {
  const [selected, setSelected] = React.useState("");
  const [tracks, setTracks] = React.useState<TrackRef[] | null>(null);
  const [error, setError] = React.useState("");
  const [defIn, setDefIn] = React.useState("2");
  const [defOut, setDefOut] = React.useState("3");
  const [explicitOnly, setExplicitOnly] = React.useState(false);
  const currentUri = useNowPlayingUri();

  React.useEffect(() => {
    if (selected || !playlists.length) return;
    const ctx = nowPlaying().ctx;
    setSelected(ctx && playlists.some((p) => p.uri === ctx) ? ctx : playlists[0].uri);
  }, [playlists]);

  React.useEffect(() => {
    if (!selected) return;
    setTracks(null);
    setError("");
    setExplicitOnly(false);
    getPlaylistTracks(selected)
      .then(setTracks)
      .catch((e) => setError(`Couldn't load this playlist's tracks: ${e}`));
  }, [selected]);

  const explicitCount = tracks?.filter((t) => t.explicit).length ?? 0;
  const shown = tracks?.map((t, i) => ({ t, i })).filter(({ t }) => !explicitOnly || t.explicit);

  const applyDefaults = () => {
    const fi = parseTime(defIn), fo = parseTime(defOut);
    if (fi === null || fo === null || !tracks) return;
    const entries = tracks
      // Use the points that apply here, so a song's global fades count as "has fades".
      .filter((t) => { const p = resolvePoints(t.uri, selected); return p?.fadeIn == null && p?.fadeOut == null; })
      .map((t) => [t.uri, { fadeIn: fi, fadeOut: fo }] as [string, { fadeIn?: number; fadeOut?: number }]);
    setPointsBatch(selected, entries);
    Spicetify.showNotification(`Fades added to ${entries.length} tracks`);
  };

  const clearAll = () => {
    if (window.confirm("Remove all fade points from this playlist?")) clearScope(selected);
  };

  const doExport = async () => {
    const json = exportJson();
    try {
      await navigator.clipboard.writeText(json);
    } catch {
      await (Spicetify.Platform as any).ClipboardAPI.copy(json);
    }
    Spicetify.showNotification("Fade points copied to the clipboard");
  };

  const doImport = () => {
    const host = document.createElement("div");
    mount(host, <ImportForm />);
    Spicetify.PopupModal.display({ title: "Import fade points", content: host });
  };

  return (
    <>
      <p className="fp-lede">
        Set where each track starts and stops in a playlist, and how long it fades in and out.
        Points apply whenever the playlist plays, including offline.
      </p>

      <div className="fp-toolbar">
        <select value={selected} onChange={(e) => setSelected(e.target.value)} aria-label="Playlist">
          {playlists.map((p) => <option key={p.uri} value={p.uri}>{p.name}</option>)}
        </select>
        {explicitCount > 0 && (
          <button className="fp-btn" aria-pressed={explicitOnly} onClick={() => setExplicitOnly(!explicitOnly)}>
            <ExplicitBadge />
            {explicitOnly ? "Show all tracks" : `${explicitCount} explicit ${explicitCount === 1 ? "track" : "tracks"}`}
          </button>
        )}
        <div className="fp-spacer" />
        <button className="fp-btn" onClick={doExport}>Export</button>
        <button className="fp-btn" onClick={doImport}>Import</button>
      </div>

      <div className="fp-defaults">
        <div className="fp-field fp-short"><span>Fade in</span><input value={defIn} onChange={(e) => setDefIn(e.target.value)} aria-label="Default fade in, seconds" /></div>
        <div className="fp-field fp-short"><span>Fade out</span><input value={defOut} onChange={(e) => setDefOut(e.target.value)} aria-label="Default fade out, seconds" /></div>
        <button className="fp-btn fp-btn-primary" onClick={applyDefaults} disabled={!tracks?.length}>
          Add fades to tracks without them
        </button>
        <div className="fp-spacer" />
        <button className="fp-btn" onClick={clearAll} disabled={!selected}>Clear playlist</button>
      </div>

      {error && <div className="fp-warn">{error}</div>}
      {!error && !tracks && selected && <div className="fp-empty">Loading tracks…</div>}
      {!error && !selected && <div className="fp-empty">Create a playlist in Spotify, then come back here to set its fade points.</div>}
      {tracks?.length === 0 && <div className="fp-empty">This playlist has no tracks yet. Add some in Spotify, then reopen this page.</div>}
      {shown?.map(({ t, i }) => (
        <TrackRow key={`${t.uri}-${i}`} t={t} i={i} playlist={selected} current={t.uri === currentUri} />
      ))}
    </>
  );
}
