# Cue Deck

Game-day music control for the Spotify desktop app on Windows, built on [Spicetify](https://spicetify.app).

Cue Deck turns Spotify into a simple console for whoever runs music at a game or event:

- **One-tap Go and Stop** with smooth fades, from buttons, hotkeys, or a Stream Deck
- **Duck** the music for announcements, and bring it back with one press
- **Cues** for each part of the game (Pregame, Breaks, Halftime, Postgame), grouped by event, with break music that fades out by itself and a halftime countdown
- **Per-track in and out points** with fade-ins and fade-outs, so every song starts on the hook and ends cleanly
- **Explicit-track flagging**, with an option to skip them during play
- **Works offline** with downloaded playlists, because playback stays in the official Spotify client

## Quick start

You need Windows, Spotify from spotify.com (not the Microsoft Store version), and [Node.js](https://nodejs.org).

```powershell
# Install Spicetify and apply it once (PowerShell, not as admin)
iwr -useb https://raw.githubusercontent.com/spicetify/cli/main/install.ps1 | iex
spicetify backup apply

# Build and install Cue Deck
npm install
npm run build
spicetify config custom_apps cue-deck
spicetify apply
```

Then click the **Cue Deck** megaphone button at the left of Spotify's top bar, after the back and forward arrows.

## Documentation

- **[User guide](docs/user-guide.md)**: setting up events and cues, running a game, hotkeys, fade points, and a field checklist
- **[Troubleshooting](docs/troubleshooting.md)**: common problems and known limitations
- **[How it works](docs/how-it-works.md)**: architecture, the fade engine, data format, and development setup

## Contributing

Bug reports and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)

Cue Deck is an independent project and isn't affiliated with or endorsed by Spotify. It's a Spicetify customization of your own Spotify client and doesn't download or redistribute music.
