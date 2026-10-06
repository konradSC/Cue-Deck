import { isExplicitTrack } from "./player";

// Library access. This is the most version-sensitive file in the project:
// Spicetify.Platform exposes Spotify's internal APIs, which change shape
// between client releases. Each call tries the internal API first (works
// offline), then falls back to the Web API (needs a connection).

export interface PlaylistRef { uri: string; name: string }
export interface TrackRef { uri: string; name: string; artists: string; durationMs: number; explicit: boolean }

const P = () => Spicetify.Platform as any;

function walkRootlist(items: any[], out: PlaylistRef[], prefix = "") {
  for (const it of items ?? []) {
    if (it.type === "playlist" && it.uri) out.push({ uri: it.uri, name: prefix + (it.name ?? it.uri) });
    else if (it.type === "folder") walkRootlist(it.items, out, `${prefix}${it.name} / `);
  }
}

export async function getPlaylists(): Promise<PlaylistRef[]> {
  try {
    const root = await P().RootlistAPI.getContents();
    const out: PlaylistRef[] = [];
    walkRootlist(root?.items, out);
    if (out.length) return out;
  } catch (e) {
    console.warn("[cue-deck] RootlistAPI failed, trying Web API", e);
  }
  const out: PlaylistRef[] = [];
  let url: string | null = "https://api.spotify.com/v1/me/playlists?limit=50";
  while (url) {
    const res: any = await Spicetify.CosmosAsync.get(url);
    for (const p of res.items ?? []) out.push({ uri: p.uri, name: p.name });
    url = res.next;
  }
  return out;
}

export async function getPlaylistTracks(playlistUri: string): Promise<TrackRef[]> {
  try {
    const res = await P().PlaylistAPI.getContents(playlistUri);
    if (Array.isArray(res?.items)) {
      return (res.items as any[])
        .filter((t) => t.uri?.startsWith("spotify:track:"))
        .map((t) => ({
          uri: t.uri,
          name: t.name ?? t.uri,
          artists: (t.artists ?? []).map((a: any) => a.name).join(", "),
          durationMs: t.duration?.milliseconds ?? t.duration_ms ?? 0,
          explicit: isExplicitTrack(t),
        }));
    }
  } catch (e) {
    console.warn("[cue-deck] PlaylistAPI failed, trying Web API", e);
  }
  const id = playlistUri.split(":").pop();
  const out: TrackRef[] = [];
  let url: string | null = `https://api.spotify.com/v1/playlists/${id}/tracks?limit=100`;
  while (url) {
    const res: any = await Spicetify.CosmosAsync.get(url);
    for (const { track: t } of res.items ?? []) {
      if (!t?.uri?.startsWith("spotify:track:")) continue;
      out.push({
        uri: t.uri,
        name: t.name,
        artists: (t.artists ?? []).map((a: any) => a.name).join(", "),
        durationMs: t.duration_ms ?? 0,
        explicit: isExplicitTrack(t),
      });
    }
    url = res.next;
  }
  return out;
}

/** Play a track within its playlist so the queue continues through the playlist. */
export async function playInPlaylist(playlistUri: string, trackUri: string) {
  try {
    await Spicetify.Player.playUri(playlistUri, {}, { skipTo: { uri: trackUri } });
  } catch {
    await Spicetify.Player.playUri(trackUri);
  }
}
