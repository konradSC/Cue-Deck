import React from "react";
import { getPlaylists, PlaylistRef } from "./lib/api";
import { EventTitle, GamePage } from "./components/GamePage";
import { EditorPage } from "./components/EditorPage";
import { injectStyles } from "./components/styles";

type Tab = "live" | "edit";

export default function App() {
  injectStyles();
  const [tab, setTab] = React.useState<Tab>("live");
  const [playlists, setPlaylists] = React.useState<PlaylistRef[]>([]);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    getPlaylists()
      .then(setPlaylists)
      .catch((e) => setError(`Couldn't load your playlists: ${e}. See the Spotify version notes in the README.`));
  }, []);

  return (
    <div className="fp-page">
      <div className="fp-header">
        {tab === "live" ? <EventTitle /> : <h1>Fade points</h1>}
        <div className="fp-tabs" role="tablist">
          <button role="tab" aria-selected={tab === "live"} onClick={() => setTab("live")}>Live</button>
          <button role="tab" aria-selected={tab === "edit"} onClick={() => setTab("edit")}>Fade points</button>
        </div>
      </div>
      {error && <div className="fp-warn">{error}</div>}
      {tab === "live" ? <GamePage playlists={playlists} /> : <EditorPage playlists={playlists} />}
    </div>
  );
}
