# How Cue Deck works

Notes for contributors and the curious. For using the app, see the [user guide](user-guide.md).

## Architecture

Cue Deck is built with [spicetify-creator](https://github.com/spicetify/spicetify-creator) and ships as two bundles:

- **The custom app** (`src/app.tsx`) is the Cue Deck page, opened from its button in Spotify's top bar, with the Live and Fade points tabs. It only runs while the page is open.
- **The extension** (`src/extensions/fade-engine.tsx`) runs every time Spotify starts. It hosts the fade engine, registers the playbar Mark In/Out buttons and the track context menu items, and listens for the game hotkeys.

The two bundles don't share memory. They communicate through window events: the page sends commands (`cue-deck:cmd`), and the engine publishes its status on every tick. Settings changes are broadcast with `cue-deck:game-changed`.

```
src/
  app.tsx                     Custom app shell: event title, Live and Fade points tabs
  components/GamePage.tsx     Live tab: Go/Stop/Duck, clock, events and cues table, settings
  components/EditorPage.tsx   Fade points tab: per-track editor, explicit filter, import/export
  components/PointsEditor.tsx Shared editor (time fields + gain envelope), used by the page and the popup
  components/styles.ts        Scoped CSS using Spicetify theme variables
  components/mount.ts         Mounts React with createRoot or render, whichever this Spotify's React has
  extensions/fade-engine.tsx  Runs on every launch: fade engine, playbar buttons, context menu, hotkeys
  lib/engine.ts               The fade engine (track fades, game transport, duck, timers, explicit skip)
  lib/game.ts                 Events, cues ("sets" in the code), and settings (with v1 migration), commands, engine status
  lib/store.ts                localStorage persistence, scopes, import/export
  lib/api.ts                  Playlist/track lookup (the most Spotify-version-sensitive file)
  lib/player.ts               Player helpers, time parsing/formatting, explicit detection
  settings.json               Custom app manifest: name (shown as the button tooltip) and icons
  css/icon.svg                Top bar icon (icon-active.svg while the page is open)
tools/
  game-hotkeys.ahk            Optional AutoHotkey v2 script for global hotkeys / Stream Deck
```

## The fade engine

Every 40 ms the engine multiplies three gains and applies the result by scaling Spotify's master volume relative to the volume you had set:

- **Track gain** comes from the playhead: silent before the in point, an equal-power ramp over the fade-in, a ramp down to the out point (or the natural end), then `next()`. Pausing pauses the fade, and scrubbing jumps to the right level.
- **Transport gain** comes from the game controls. Stop ramps it to zero and pauses. Go sets it to zero, changes track, waits for the new track to become audible, then ramps it up.
- **Duck gain** ramps between 1 and the duck level.

When all three are at full, your volume is restored. When playback is stopped, the slider goes back to where you had it, so pressing play in Spotify itself is never silent.

It also hides the edges. It stays silent while the jump to an in point lands, and it pre-silences the last 250 ms of a track if the next one fades in or starts late, so you don't hear a blip at full volume.

Chromium throttles timers in hidden windows, so the engine ticks from a Web Worker. If the worker can't start, it falls back to the main thread and logs a "Worker timer unavailable" warning.

## Spotify APIs

`lib/api.ts` uses `Spicetify.Platform.RootlistAPI` and `PlaylistAPI` to list playlists and tracks. These are internal to Spotify and change between versions, which is why playlists keep working offline. If they fail, it falls back to the Web API, which only works online. This is the file most likely to need fixing after a Spotify update.

## Data format

Everything is stored in this Spotify install's `localStorage`. The keys still use the `fade-points:` prefix from the app's original name, so saved data carried over when it was renamed.

| Key | Contents |
|---|---|
| `fade-points:game:v2` | Events, cues ("sets" in the code), and settings. Older `fade-points:game:v1` data is migrated into an event called Default. |
| `fade-points:v1` | Per-track fade points, keyed by scope. This is what Export and Import read and write. |
| `fade-points:engine-volume` | Your volume while a fade or duck is active, so it can be restored if Spotify closes mid-fade. |

The fade points table, as exported:

```json
{
  "spotify:playlist:<id>": {
    "spotify:track:<id>": { "start": 10000, "end": 185000, "fadeIn": 2000, "fadeOut": 3000 }
  },
  "*": { "spotify:track:<id>": { "fadeIn": 1500 } }
}
```

The top-level keys are scopes: a playlist URI, or `*` for points that apply everywhere. All values are milliseconds and every field is optional. Playlist points take precedence over `*` points for the same track.

## Development

```powershell
npm install
spicetify enable-devtools
npm run watch        # rebuilds into %APPDATA%\spicetify\CustomApps\cue-deck on save
```

Reload Spotify with Ctrl+Shift+R after changes. Engine logs are prefixed with `[cue-deck]` in DevTools.

| Script | What it does |
|---|---|
| `npm run build` | Builds into Spicetify's CustomApps folder. |
| `npm run watch` | Same, rebuilding on every save. |
| `npm run build-local` | Builds a minified copy into `dist/` (not committed). |
| `npm run typecheck` | Runs the TypeScript compiler without emitting. |
