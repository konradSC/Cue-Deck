# Cue Deck user guide

This guide is for whoever runs the music at a game or event. It covers installing Cue Deck, setting up your playlists before the day, and running it live.

- [Install](#install)
- [A tour of the app](#a-tour-of-the-app)
- [Before the game: events and cues](#before-the-game-events-and-cues)
- [During the game](#during-the-game)
- [Global hotkeys and Stream Deck](#global-hotkeys-and-stream-deck)
- [Fade points: trimming and fading tracks](#fade-points-trimming-and-fading-tracks)
- [Explicit tracks](#explicit-tracks)
- [Settings](#settings)
- [Backing up and moving to another computer](#backing-up-and-moving-to-another-computer)
- [Checklist for the field](#checklist-for-the-field)

If something isn't working, see [Troubleshooting](troubleshooting.md).

## Install

Cue Deck runs inside the Spotify desktop app on Windows, using [Spicetify](https://spicetify.app). You'll need [Node.js](https://nodejs.org) (the LTS version) to build it.

1. **Use Spotify from spotify.com.** Spicetify doesn't support the Microsoft Store version. If that's the one you have, uninstall it and install from spotify.com.
2. **Install Spicetify** and apply it once. Open PowerShell (not as administrator) and run:
   ```powershell
   iwr -useb https://raw.githubusercontent.com/spicetify/cli/main/install.ps1 | iex
   spicetify backup apply
   ```
3. **Build and install Cue Deck.** In PowerShell, from the Cue Deck folder:
   ```powershell
   npm install
   npm run build
   spicetify config custom_apps cue-deck
   spicetify apply
   ```

Spotify restarts, and a megaphone button for **Cue Deck** appears at the left of the top bar, after the back and forward arrows. (On older versions of Spotify it appears in the left sidebar instead.)

> **After a Spotify update**, Spotify sometimes removes Spicetify. If the Cue Deck button disappears, run `spicetify backup apply` again.

## A tour of the app

Click the **Cue Deck** megaphone button. It has two tabs:

- **Live** is where you run the game. It has the Go, Stop, and Duck buttons, a clock, and the table of cues for the current event.
- **Fade points** is where you prepare tracks: trim where each one starts and ends, and add fade-ins and fade-outs.

The page title is the name of the active event. Click it to switch to another event. The circular arrow next to it is **Reset event**; see [Resetting before an event](#resetting-before-an-event).

The top of the Live tab shows which cue is playing (for example **Cue: Breaks**), the current song and playlist, and a clock. Below the controls, **Up next** lists the songs coming up; see [Up next](#up-next). The clock shows the halftime countdown when one is running, otherwise the time left before break music fades out, otherwise the current state.

## Before the game: events and cues

A **cue** is the music for one moment of the game, ready to start with one press: a playlist plus a few rules for how it plays. For example, "Breaks: play 45 seconds of the Timeout playlist, shuffled." Cues are grouped into **events**, such as Basketball, Lacrosse, or Graduation, so each sport or occasion can have its own lineup.

The first time you open Cue Deck, there's one event called **Default** with four cues: Pregame, Breaks, Halftime, and Postgame.

### Editing cues

The cues table is locked by default so nothing changes by accident during a game. Click **Edit cues** to unlock it. While editing you can:

- rename the event, or add, duplicate, or delete events
- add, rename, reorder (▲ ▼), or delete cues

Click **Done** to lock the table again.

### Cue options

For each cue, choose:

| Option | What it does |
|---|---|
| **Playlist** | Which playlist the cue plays from. |
| **Shuffle** | Plays the playlist in random order. |
| **Stop after** | How many seconds the music plays after each Go, then fades out automatically. Use this for timeouts and short breaks. **0** means it plays until you press Stop. |
| **Countdown** | For halftime or intermissions, in minutes. Starting the cue starts the countdown on the clock. **0** means no countdown. |
| **Stop music _s_ early** | When there's a countdown, how many seconds before it ends the music fades out, so the floor is quiet when teams come back. |

Starting a different cue cancels any running countdown.

## During the game

| Control | Hotkey | What it does |
|---|---|---|
| **Play a cue** | Ctrl+Alt+1 to 9 | Fades out whatever is playing and starts that cue. The number is the cue's position in the active event's table. |
| **Restart a cue** | Ctrl+Alt+Shift+1 to 9 | Starts that cue's playlist over from the first song (or a fresh shuffle), even if it's already loaded. |
| **Go** | Ctrl+Alt+G | Starts the next song in whatever is loaded, with a short fade-in. If music is already playing, it fades that out first. Restarts the cue's "Stop after" timer. |
| **Stop** | Ctrl+Alt+S | Fades out and pauses. |
| **Duck** | Ctrl+Alt+D | Lowers the music for announcements. Press again to bring it back up. Go also brings it back. |

You can also start a cue with its **Play** button in the table. Once a cue's playlist is loaded, its button changes to **Next**, and a **Restart** button appears beside it.

**Pressing the same cue again moves on to its next song.** If you press Breaks at every timeout, each timeout gets a new song, in order or shuffled, without repeats until the playlist has been through once. A cue starts its playlist from the top (or a fresh shuffle) only when you switch to it from a different cue, or when it has reached the end of the playlist.

**To start a playlist from the beginning,** for example after testing it before the game, press **Restart** on that cue (or Ctrl+Alt+Shift and its number). Restart also clears any songs you marked to skip.

A typical game looks like this: start **Pregame** during warmups, **Stop** for the anthem and introductions, press **Breaks** at each timeout (it fades out by itself), start **Halftime** at the half, go back to **Breaks** for the second half's timeouts, and start **Postgame** at the end. Use **Duck** whenever the announcer needs to talk over music.

Go is for when you want the next song in whatever is loaded, without thinking about which cue it is: for example, skipping a song that isn't working.

### Resetting before an event

If you've been testing before an event, click the circular arrow next to the event name (**Reset event**), then click **Reset?** to confirm. It takes two clicks so a stray click during a game can't stop the music. Reset event:

- fades out and stops the music
- makes every cue start its playlist from the first song (or a fresh shuffle) the next time you press it
- clears the countdown, the break timer, Duck, and any songs marked to skip

Your cues and their settings, fade points, and Settings aren't changed.

### Up next

The **Up next** list on the Live tab shows the songs coming up in the playlist that's loaded, in the order they'll play, shuffled or not. To keep the cues table in view, it normally shows only the song that plays next. Click **Show 5** to see the next five, and **Show less** to fold it back; Cue Deck remembers which you chose. Songs you've added with Spotify's *Add to queue* play first and are labelled **Added to queue**.

- **Plays next** marks the song that will play next. When a cue has a "Stop after" time, that's the song for the next break.
- Each song shows its length, or how much of it plays if it has fade points (for example "0:45 of 3:12").
- **Play** switches to that song now, for when the current one doesn't fit the mood. It fades out what's playing, then fades the new song in, using its in point and fades. It restarts the cue's "Stop after" timer, like Go. Songs between the current one and the one you picked are passed over, as when you click a song in Spotify's queue.
- **Skip** marks a song to be skipped silently when it comes up. Press **Undo** to change your mind. Skips apply to the current run through the playlist and are forgotten when a different playlist starts.
- If **Skip explicit tracks during play** is on, explicit songs are shown as **Skipped: explicit**.

> **The hotkeys above only work while Spotify is the active window.** To use them from any window, or from a Stream Deck, see the next section.

## Global hotkeys and Stream Deck

The `tools/game-hotkeys.ahk` script makes hotkeys that work no matter which window is in front.

1. Install [AutoHotkey v2](https://www.autohotkey.com).
2. Double-click `tools/game-hotkeys.ahk` to run it. A green **H** icon appears in the system tray.

It maps:

| Key | Action |
|---|---|
| F13 | Go |
| F14 | Stop |
| F15 | Duck |
| F16 to F20 | Cues 1 to 5 |

Most keyboards don't have F13 to F20, but a Stream Deck or macro pad can send them, which keeps them from clashing with anything else. To use other keys, open the script in a text editor and change the key names on the left of each `::` line.

Each press briefly brings Spotify to the front, sends the shortcut, and switches back to the window you were in.

## Fade points: trimming and fading tracks

Fade points let you skip a long intro, cut a song before a slow ending, or fade a track in and out. They're set per track.

### On the Fade points tab

1. Pick a playlist.
2. For each track, fill in any of:
   - **In**: where the track starts playing
   - **Out**: where it stops (the next track then starts)
   - **Fade in** and **Fade out**: in seconds

Times can be typed as `1:23.4` or `83.4` (seconds). Leave a field blank to use the track's natural start or end.

The **⌖** button next to In or Out sets that point to the current playback position, if that track is playing.

The **envelope bar** under each track shows what will play. You can:

- drag its In and Out handles to set the points
- nudge a selected handle with the arrow keys (0.1 s), or Shift+arrow (1 s)
- drag a handle all the way to the edge to clear that point
- click the bar to seek, if the track is playing; otherwise the click moves the nearer handle

**Add fades to tracks without them** gives every track in the playlist the Fade in and Fade out lengths typed next to the button (2 s and 3 s to start with). It doesn't change tracks that already have fades.

### While listening

- **Playbar buttons:** *Mark in point* and *Mark out point*, next to Spotify's playback controls, set a point at the current position. Hover them to see whether the point will be for this song in this playlist, or for this song wherever it plays. *Clear fade points* removes the playing track's points (the ones shown on the progress bar); it's greyed out when the track has none.
- **Progress bar markers:** Spotify's progress bar shows the playing track's points. Green ticks mark the in and out points, the parts that will be skipped are dimmed, and fades are shaded.
- **Right-click a track** anywhere in Spotify and choose **Edit fade points** or **Clear fade points**.

### Which points apply where

Points you set while playing from a **playlist** apply only in that playlist. That way the same song can have a short cut in Breaks and play in full in Pregame.

Points set while playing from an **album, artist, or radio** are global. They apply wherever that track plays, unless a playlist has its own points for it.

When you first set a point for a song in a playlist, Cue Deck starts from the song's global points and changes only the one you set. For example, if a song has a global out point and fade-out, marking an in point in Breaks keeps that out point and fade-out in Breaks too. After that, changes to the song's global points no longer affect it in Breaks.

## Explicit tracks

Explicit tracks show an **E** badge on the Fade points tab. Click the **_N_ explicit tracks** button to list only those tracks, so you can remove them or find clean versions. Click **Show all tracks** to go back.

The cues table on the Live tab shows how many explicit tracks each cue's playlist has.

To have Cue Deck skip explicit tracks silently, turn on **Skip explicit tracks during play** in Settings. This applies to everything Spotify plays, not just Cue Deck cues.

## Settings

Open **Settings** at the bottom of the Live tab. These apply to every event.

| Setting | Default | What it does |
|---|---|---|
| Stop fade | 2 s | How long Stop takes to fade out. |
| Go fade | 1 s | How long Go takes to fade in. |
| Duck to | 20% | How loud the music is while ducked. |
| Go starts the next track / Go resumes the paused track | Next track | Whether Go after a Stop skips to a fresh track or carries on from where it paused. "Resumes" is handy when breaks are only a few seconds. |
| Skip explicit tracks during play | Off | See [Explicit tracks](#explicit-tracks). |

## Backing up and moving to another computer

Cue Deck keeps everything inside this Spotify installation on this computer. Nothing is synced to your Spotify account.

To back up your fade points, or copy them to another computer, use **Export** on the Fade points tab. It copies them to the clipboard as text; paste that into a file and keep it somewhere safe. On the other computer, paste the text into **Import**. Imported points are merged with what's already there; where both have points for the same track, the imported ones win.

Events and cues aren't included in the export, so set those up again on a new computer.

## Checklist for the field

Before you leave:

- [ ] Download every playlist your cues use.
- [ ] In Spotify's settings, turn **off Autoplay**, so similar songs don't start when a playlist ends.
- [ ] Turn **on volume normalization**, so tracks play at similar loudness through the PA.
- [ ] Turn **off crossfade**, which interferes with Cue Deck's fades.

At the venue:

- [ ] Switch Spotify to **Offline mode** (File menu) so a weak signal can't cause buffering.
- [ ] Set the PA level with Spotify's volume slider before you start.
- [ ] Test Go, Stop, and Duck through the actual speakers before warmups.
- [ ] After testing, press **Reset event** (the circular arrow next to the event name) so everything starts fresh.
- [ ] If you use global hotkeys, check the AutoHotkey script is running.
