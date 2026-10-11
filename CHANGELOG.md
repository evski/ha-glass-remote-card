# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [0.1.0] - unreleased

### Added
- First version of Glass Remote Card: a single-file, dependency-free Lovelace card.
- Platforms: `apple_tv`, `kodi`, `webostv`, `generic`, plus per-button `actions` overrides.
- Layout: full-screen layout with safe areas and Apple's proportions; `card` layout for normal dashboards.
- Picking the player:
  - Built-in device picker.
  - Automatic player choice: a manual pick (kept for `pick_timeout`), then the TV input via `source_map`, then ranking.
  - `?player=` URL parameter, used by Sidebar Mini Player's remote button.
- Controls:
  - Touchpad: swipe, swipe-and-hold to repeat, tap, long-press.
  - Side volume tabs with hold-to-repeat; receiver volume with fallback, or volume through the Apple TV remote.
- Text: keyboard and dictation text box, and the automatic "wants text" bar.
- Look and feel: Liquid Glass styling, thin line icons, haptics.

[0.1.0]: https://github.com/evski/ha-glass-remote-card/releases/tag/v0.1.0
