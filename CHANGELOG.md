# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [0.1.6] - unreleased

### Changed
- The mic button on the touchpad is removed by default. It opened the same text box as the keyboard button. The keyboard button and the automatic keyboard banner are unchanged. Set `show_mic: true` to bring the mic button back.

## [0.1.5] - unreleased

### Fixed
- The collapsed CH control (CH with its caps) sat a few pixels below the list, -10, ⋯ and +10 icons. The row's buttons are now fixed 44 px boxes with their icons centred, the same as the CH slot, so everything shares one centre line, as on Apple's remote. The row sits about 38 px above the pad's bottom edge, as on Apple's.

## [0.1.4] - unreleased

### Changed
- The pad's bottom row (sources | -10 | ⋯ | +10 | CH) is always shown again, as on Apple's iOS Remote. 0.1.3's hide/show toggle and its `bottom_row` option are gone.
- The CH control now works like Apple's. Collapsed, it is a compact "CH" in line with the row, with thin caps above and below. Tapping it expands it into a stack that rises above the row: up chevron, CH, down chevron. The caps slide outward and turn into the chevrons in about 200 ms (CSS transitions, so it works on iOS).
- Collapsed, a tap only expands the stack and sends no command. Expanded, the chevrons send channel up/down. Tap CH again to fold it back; it also folds back after 5 s without use.
- Players without channel keys (e.g. Kodi) hide the CH slot again.
- Row positions match Apple's screenshots.

### Added
- `channel_timeout`: how long, in ms, before an open CH stack folds back (default `5000`; `0` = never).

## [0.1.3] - unreleased (superseded by 0.1.4)

### Changed
- The pad's bottom row (sources | -10 | ⋯ | +10 | CH) now works like Apple's iOS Remote: it is hidden by default, so the touchpad is clear. Tap **CH** in the bottom-right corner of the pad to show it, and tap CH again to hide it. Players without channel keys (e.g. Kodi) get a small chevron in the same spot instead.
- The CH up/down chevrons appear above and below the CH label when the row is open. They are now sharp chevrons with Apple's spacing, and the row's icons and positions match Apple's proportions.
- The row only catches taps on its own buttons, so taps and swipes anywhere else on the pad still work while it is open.

### Added
- `bottom_row: always` keeps the 0.1.2 always-visible row (default `toggle`).

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
