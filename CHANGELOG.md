# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [0.1.2] - unreleased

### Added
- Kodi keyboard detection: while Kodi is active and the card is visible, the card polls `GUI.GetProperties(currentwindow)` and listens for `kodi_call_method_result`. The keyboard banner shows for the virtual keyboard (10103) and the numeric input (10109). New options: `keyboard_poll` (ms, default 2000, 0 = off) and `keyboard_poll_during_video` (default false). Polling stops when the card is hidden or removed, another player is active or a video plays.

- `input` trigger `pick`: picking a player in the picker (or with `?player=`) switches the room's AVR/TV to it, skipping inputs that are already right. `on_auto` (default false) also switches when Auto changes player.

### Changed
- Kodi text is sent live (`Input.SendText` with `done: false`), then with `done: true` on Enter. Enter cancels any pending live update.

## [0.1.1] - unreleased

### Added
- Per-player `input:` option to switch an AVR, soundbar or TV input before a key is sent. Options:
  - `entity`, `source`
  - `turn_on` and `turn_on_delay`
  - `triggers` (`home`, `power`, `select`, any key, `any`, `first`)
  - `skip_if_selected`
  - `delay`
  - custom `action` (with `$source`)
  - a list of inputs, handled in order
- The pad's bottom row now matches Apple's remote during playback: sources list | -10 | ... | +10 | CH.
  - **Sources**: a glass picker of the player's or another entity's sources, with the current one ticked. Options: `sources` (`entity`, `include`, `exclude`, `rename`, `action`, `false`), and `select`/`input_select` entities are supported.
  - **More (...)**: info, subtitles, sound mode and per-platform extras (`more` list, custom items, `false`).
  - **CH** up/down for Apple TV and LG; opt in with `channels`.
- Sound mode menu: press and hold the speaker badge (also in More). Options: `sound_mode` (`entity`, `modes`, `exclude`, `rename`, `action`, `false`).
- Helpers `inputSteps`, `sourceMenu`, `soundModeMenu`, `optionSteps`, `moreItems` and `hasChannels`, with tests.
- A test that Apple TV power only uses `media_player.turn_on`/`turn_off`, never a held remote power command.

### Changed
- The "wants text" bar is now an iOS-style keyboard notification. It is a dark glass banner that slides down over the top row, with a Siri Remote app icon and the text "<Device> Keyboard / Keyboard Input / Enter text on ... Press to type."
- Info and subtitles moved from separate icons into the More menu.
- Key sequences now run in order and wait for an input switch to finish.

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

[0.1.2]: https://github.com/evski/ha-glass-remote-card/releases/tag/v0.1.2
[0.1.1]: https://github.com/evski/ha-glass-remote-card/releases/tag/v0.1.1
[0.1.0]: https://github.com/evski/ha-glass-remote-card/releases/tag/v0.1.0
