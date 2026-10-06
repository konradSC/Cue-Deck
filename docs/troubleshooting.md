# Troubleshooting

## Common problems

**The Cue Deck button is missing.**
A Spotify update probably removed Spicetify. Run `spicetify backup apply` in PowerShell. If that doesn't bring it back, run `npm run build`, `spicetify config custom_apps cue-deck`, and `spicetify apply` again.

**The Live tab says "The fade engine isn't running".**
The buttons won't do anything until the engine loads. Run `spicetify apply` and restart Spotify.

**The hotkeys don't do anything.**
Ctrl+Alt hotkeys only reach Spotify while its window is in front. Click into Spotify first, or use the AutoHotkey script described in the [user guide](user-guide.md#global-hotkeys-and-stream-deck).

**The volume slider moves on its own.**
That's expected. Cue Deck fades and ducks by moving Spotify's volume slider, then puts it back. If you drag the slider during a fade or while ducked, Cue Deck overrides you, so set the PA level before you start.

**My volume is stuck low after Spotify closed or crashed.**
Cue Deck restores your volume the next time Spotify starts.

**A song from a different artist started when my playlist ran out.**
Turn off Autoplay in Spotify's settings.

**Fades sound wrong or doubled.**
Turn off Spotify's crossfade setting. It overlaps with Cue Deck's own fades.

**Fades stutter while Spotify is minimized.**
Windows slows down background apps. Cue Deck works around this, but if fades still stutter, run:
```powershell
spicetify config spotify_launch_flags "--disable-background-timer-throttling|--disable-renderer-backgrounding"
spicetify apply
```

**Playlists don't show up, or tracks won't load, after a Spotify update.**
Cue Deck reads playlists through parts of Spotify that can change between versions. Check for a newer version of Cue Deck, and [open an issue](../CONTRIBUTING.md#reporting-bugs) if there isn't one.

## Known limitations

- **Fades, not crossfades.** Spotify plays one track at a time, so one track fades out and the next fades in; they never overlap.
- **Go after Stop starts a new track by default.** If your breaks are only a few seconds, switch Go to "resumes the paused track" in Settings.
- **Timing is accurate to roughly 50–100 ms.** That's fine for fades but not for beat-matched cuts.
- **Windows only.** Spicetify runs on macOS and Linux too, but Cue Deck has only been tested on Windows, and the global hotkey script is Windows-only.
- **Data stays on one computer.** Fade points, events, and cues are stored in this Spotify installation, not your Spotify account. Use Export to back up fade points.

## Getting logs

If you're reporting a bug, logs help:

1. Run `spicetify enable-devtools`, then restart Spotify.
2. Press Ctrl+Shift+I to open DevTools and pick the **Console** tab.
3. Reproduce the problem and copy the lines that start with `[cue-deck]`.
