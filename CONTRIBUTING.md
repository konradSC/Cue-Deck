# Contributing to Cue Deck

Thanks for helping out. Cue Deck is a small project, so the process is light.

## Reporting bugs

Open an issue and include:

- what you did, what you expected, and what happened
- your Spotify version (Settings → About) and Spicetify version (`spicetify -v`)
- any `[cue-deck]` lines from the DevTools console (see [Getting logs](docs/troubleshooting.md#getting-logs))

Spotify updates break Spicetify customizations fairly often. If something stopped working right after an update, say so.

## Making changes

See [How it works](docs/how-it-works.md) for the architecture and development setup.

Before opening a pull request:

1. Run `npm run typecheck`.
2. Test the change in Spotify, including Go, Stop, and Duck if you touched the engine.
3. Update the [user guide](docs/user-guide.md) if you changed anything a user would notice.

Keep pull requests focused on one change.
