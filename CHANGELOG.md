# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [0.2.3] - 2026-10-13

### Added
- **`actions.power_on` / `actions.power_off`.** Power can now run a different call depending on whether the player is off or on. Use it for TVs that only wake from Wake-on-LAN: set `power_on` to `wake_on_lan.send_magic_packet` and keep the normal turn-off. Whichever one you leave out uses the built-in power call, and `actions.power` still overrides both.

## [0.2.2] - 2026-10-11

First release since v0.1.13. It also includes 0.2.0 and 0.2.1, which weren't released on their own (their full notes are in [CHANGELOG.md](https://github.com/evski/ha-glass-remote-card/blob/main/CHANGELOG.md)):
- **Shortcuts (0.2.0).** Each player can have its own named service calls in the More (⋯) menu, shown only while that player is active. Use them for things like an add-on search, a favourite list or a scene. A **search** shortcut opens the typing sheet first and puts your text into the call (`{text}`, or URL-encoded `{text_url}`). A **call** shortcut runs straight away. See the README's Shortcuts section.
- **Info button (0.2.1).** On players without a CH control (Kodi by default), the right-hand slot of the pad's bottom row is now an Info (i) button. `info_button: false` hides it.

### Changed
- **No duplicate Info.** While a player shows the Info (i) button on the bottom row (players without CH, such as Kodi), Info is left out of that player's More (⋯) menu. This applies to the default list and to a custom `more:` list. Players with CH (Apple TV, LG webOS) have no Info button, so they keep Info in More. `info_button: false` puts it back in More.

## [0.2.1] - 2026-10-11

### Fixed
- **Info button back on the remote.** Since 0.1.1, Info was only inside the More (⋯) menu, and on players without a CH control (Kodi by default) the right-hand slot of the pad's bottom row sat empty. That slot now holds an **Info** (i) button that sends the player's info key (Kodi `Input.Info`, LG `INFO`, `generic` with a `remote`). Players with CH keep CH there. In 0.2.1 Info also stayed in every player's More menu; 0.2.2 removes that duplicate.
- New player option `info_button: false` hides it.

## [0.2.0] - 2026-10-11

### Added
- **Shortcuts** (`players[].shortcuts`). Each player can have its own named service calls, such as an add-on search, a favourite list or a scene. They appear as the first section of that player's More (⋯) menu, above its usual items, and only while that player is active. No new buttons were added to the remote.
  - **search** shortcuts open the typing sheet (same frosted panel, titled with your `prompt`, with Send reading *Search*). Nothing is sent while you type. On Search the call runs with your text filled in wherever the data says `{text}` / `{{ text }}`, or URL-encoded with `{text_url}` / `{{ text | urlencode }}` (handy for Kodi `plugin://` URLs). An empty search is not sent.
  - **call** shortcuts run straight away.
  - A shortcut is one `{service, data, target}` or a list under `actions:`. `input: false` skips input switching. Otherwise inputs with `triggers: [shortcut]` (or `any`) switch first.
  - `icon` takes an `mdi:` icon or one of the card's icon names. Search shortcuts get a magnifier by default.
  - The More button now also shows when a player has shortcuts but `more: false`.
- New input trigger `shortcut`.
- The README has a Kodi example (movie search, TV search and a list page in a video add-on), plus a screenshot.

### Unchanged
- Everything else, including the picker, typing, the keyboard banner and input switching.

## [0.1.13] - 2026-10-11

First public release. Glass Remote Card is a frosted-glass touchpad remote for Home Assistant that follows whatever you're watching: Kodi, LG webOS, devices from the Apple TV integration, or any `media_player`. It has a touchpad, volume tabs, keyboard and dictation, a keyboard banner, sources, sound mode, a More menu, a CH control and input switching. It's a single file with no dependencies. Everything below was built and tested privately on the same day.

Not affiliated with or endorsed by Apple Inc. Apple TV is a trademark of Apple Inc.

### Changed
- The device picker looks like 0.1.11 again: plain rows on the dark blurred shade, with the same colours, row spacing, icons, hairline dividers, tick and fonts. The 0.1.12 glass panel (rounded card and shadow) is gone.
- The dark shade now ends just below the last row (Exit remote), fading out over its last 28 px, instead of covering the whole page. It is sized to the list when the picker opens and is capped at the bottom of the screen.

### Kept from 0.1.12
- No close button. Tap the pill again, tap outside, or press Escape to close the picker. The slide-down animation is unchanged.

## [0.1.12] - 2026-10-11

### Changed
- The device picker under the top pill is now a compact floating frosted-glass panel with rounded corners and a soft shadow. It is only as tall as its rows (Auto, your devices, Exit remote) and slides down from the pill. Before, the open dropdown darkened the whole page below the pill like a full-height sheet. The panel keeps the same width, the hairline dividers and the tick on the selected row, and it scrolls only if the rows would run past the bottom of the screen.
- Tapping outside still closes the picker (a transparent full-screen catcher), but the page is no longer dimmed.

### Removed
- The picker's close button. Tap the pill again, tap outside, or press Escape to close it.

### Unchanged
- The sources, sound mode and More menus were already compact floating panels without a close button. The typing sheet keeps its close button.

## [0.1.11] - 2026-10-11

### Fixed
- The whole top pill (artwork, title, subtitle, chevron and padding) is now one tap target that opens the device picker. Before, on a real dashboard only a tap at the button's exact centre worked: the card's full-screen layer and the picker's backdrop are stacked inside the dashboard view, so another page layer above the card could take taps over the top row. The pill's children no longer take pointer events (the button is always the target, and the artwork can't be dragged), and a tap that lands on another page layer over the pill's area is routed to the pill (full-screen layout only; dialogs, links and form fields are left alone).
- Tapping the pill while the picker is open now closes it, and the chevron turns back. The picker sits inside the card's own layer, and the top row is raised above its backdrop while it is open. Tapping outside the list and the close button still close it.

### Added
- Keyboard: the pill stays a single button with `aria-haspopup`, `aria-expanded` and `aria-controls` pointing at the list, and Escape closes the picker and returns focus to the pill.

### Docs
- Neutral wording for phones and browsers in the README (control centre setup), the bug-report template, comments and tests. A test now checks every text file in the repository for other companies' product names; "Apple TV" stays only as the device or integration name and in the trademark notice.

## [0.1.10] - 2026-10-11

### Changed
- Neutral naming throughout. The style is now called "frosted glass", and comparisons to other companies' designs are gone from the code, docs and tests.
- A generic TV-remote glyph replaces the old app icon in the keyboard banner and typing sheet.
- The banner text no longer names platforms: "Enter text on <player> using your keyboard. Press to type."
- The Apple TV platform's picker icon is now `mdi:television-box`.
- The font stack is now `system-ui`.
- The device picker is now a dropdown anchored under the top pill. It grows downward, never as a bottom sheet, and the pill's chevron turns from > to v. Rows are plain, with a tick on the left of the selected row, a small generic device icon, the name and hairline dividers. Auto and Exit remote stay as rows, and a thin close button sits at the top right. Tapping outside the list or on the pill closes it. The list spans the top row (the column on tablets).
- README: a trademark notice, and relative image paths, so the images show while the repository is private.

## [0.1.9] - 2026-10-11

### Added
- Tablet and wide-screen layout. On screens wider than 3:5 the full-screen remote keeps phone proportions in a centred column. The column is `column_ratio` × the screen height wide (default 0.52, at least 320 px), and `max_width` can cap it. The touchpad grows to fill the height, the top row and the volume tabs sit at the column's edges, and play/pause, Back and Home cluster under the pad. Phones are unchanged.

### Docs
- README: screen recordings from a real phone (Kodi in use, and opening the remote from the phone's control centre, with personal items blurred) next to the demo GIF.

## [0.1.8] - 2026-10-11

### Changed
- Every overlay now uses the same frosted glass panel as the typing sheet and keyboard banner: the device picker, the sources list, the sound mode menu and the More menu.
- The device picker's header matches the typing sheet, with the title and a thin close icon in a glass circle. The selected row gets a soft glass highlight and a white tick instead of accent-coloured text.

### Fixed
- The keyboard button no longer opens the typing sheet when nothing on the TV is asking for text. Previously every keystroke made Home Assistant show "No text input field is currently focused on the Apple TV", and those toasts piled up. When the player can report keyboard focus (a `keyboard_sensor`, such as the Apple TV integration's, or Kodi's keyboard window seen by the poll), the sheet only opens while a text field is focused; otherwise a small glass hint says "No text field selected on <player>" for about 2 seconds. The sheet closes if focus drops while it's open. Players that can't report focus (LG webOS, or Kodi while video plays) behave as before.
- Text service calls now turn off Home Assistant's own error toast. A failure shows a single glass hint instead.

## [0.1.7] - 2026-10-11

### Changed
- The typing sheet (keyboard button) now matches the rest of the card: the same frosted glass panel and app-icon header as the keyboard banner, a thin close icon in a glass circle, and glass pill Clear and Send buttons instead of coloured text links. The placeholder is shorter ("Type or dictate") and the extra hint line is gone.
- README: says plainly that no other custom cards or add-ons are needed, only Home Assistant's built-in integrations.
- README: a demo GIF at the top, and step-by-step instructions for opening the remote from the phone's control centre with a Home Assistant **Open Page** shortcut (and why URL shortcuts and the phone's volume buttons don't work).
- Screenshots and the social preview re-rendered from 0.1.7 (no mic button, new typing sheet).

## [0.1.6] - 2026-10-11

### Changed
- The mic button on the touchpad is removed by default. It opened the same text box as the keyboard button. The keyboard button and the automatic keyboard banner are unchanged. Set `show_mic: true` to bring the mic button back.

## [0.1.5] - 2026-10-11

### Fixed
- The collapsed CH control (CH with its caps) sat a few pixels below the list, -10, ⋯ and +10 icons. The row's buttons are now fixed 44 px boxes with their icons centred, the same as the CH slot, so everything shares one centre line. The row sits about 38 px above the pad's bottom edge.

## [0.1.4] - 2026-10-11

### Changed
- The pad's bottom row (sources | -10 | ⋯ | +10 | CH) is always shown again. 0.1.3's hide/show toggle and its `bottom_row` option are gone.
- New CH control. Collapsed, it is a compact "CH" in line with the row, with thin caps above and below. Tapping it expands it into a stack that rises above the row: up chevron, CH, down chevron. The caps slide outward and turn into the chevrons in about 200 ms (CSS transitions, so it works in mobile browsers).
- Collapsed, a tap only expands the stack and sends no command. Expanded, the chevrons send channel up/down. Tap CH again to fold it back; it also folds back after 5 s without use.
- Players without channel keys (e.g. Kodi) hide the CH slot again.
- Row positions tuned on a real phone.

### Added
- `channel_timeout`: how long, in ms, before an open CH stack folds back (default `5000`; `0` = never).

## [0.1.3] - 2026-10-11 (superseded by 0.1.4)

### Changed
- The pad's bottom row (sources | -10 | ⋯ | +10 | CH) is hidden by default, so the touchpad is clear. Tap **CH** in the bottom-right corner of the pad to show it, and tap CH again to hide it. Players without channel keys (e.g. Kodi) get a small chevron in the same spot instead.
- The CH up/down chevrons appear above and below the CH label when the row is open. They are now sharp chevrons, and the row's icons and positions were re-tuned.
- The row only catches taps on its own buttons, so taps and swipes anywhere else on the pad still work while it is open.

### Added
- `bottom_row: always` keeps the 0.1.2 always-visible row (default `toggle`).

## [0.1.2] - 2026-10-11

### Added
- Kodi keyboard detection: while Kodi is active and the card is visible, the card polls `GUI.GetProperties(currentwindow)` and listens for `kodi_call_method_result`. The keyboard banner shows for the virtual keyboard (10103) and the numeric input (10109). New options: `keyboard_poll` (ms, default 2000, 0 = off) and `keyboard_poll_during_video` (default false). Polling stops when the card is hidden or removed, another player is active or a video plays.

- `input` trigger `pick`: picking a player in the picker (or with `?player=`) switches the room's AVR/TV to it, skipping inputs that are already right. `on_auto` (default false) also switches when Auto changes player.

### Changed
- Kodi text is sent live (`Input.SendText` with `done: false`), then with `done: true` on Enter. Enter cancels any pending live update.

## [0.1.1] - 2026-10-11

### Added
- Per-player `input:` option to switch an AVR, soundbar or TV input before a key is sent. Options:
  - `entity`, `source`
  - `turn_on` and `turn_on_delay`
  - `triggers` (`home`, `power`, `select`, any key, `any`, `first`)
  - `skip_if_selected`
  - `delay`
  - custom `action` (with `$source`)
  - a list of inputs, handled in order
- The pad's bottom row during playback: sources list | -10 | ... | +10 | CH.
  - **Sources**: a glass picker of the player's or another entity's sources, with the current one ticked. Options: `sources` (`entity`, `include`, `exclude`, `rename`, `action`, `false`), and `select`/`input_select` entities are supported.
  - **More (...)**: info, subtitles, sound mode and per-platform extras (`more` list, custom items, `false`).
  - **CH** up/down for `apple_tv` and LG; opt in with `channels`.
- Sound mode menu: press and hold the speaker badge (also in More). Options: `sound_mode` (`entity`, `modes`, `exclude`, `rename`, `action`, `false`).
- Helpers `inputSteps`, `sourceMenu`, `soundModeMenu`, `optionSteps`, `moreItems` and `hasChannels`, with tests.
- A test that `apple_tv` power only uses `media_player.turn_on`/`turn_off`, never a held remote power command.

### Changed
- The "wants text" bar is now a notification-style keyboard banner. It is a dark glass banner that slides down over the top row, with a remote app icon and the text "<Device> Keyboard / Keyboard Input / Enter text on ... Press to type."
- Info and subtitles moved from separate icons into the More menu.
- Key sequences now run in order and wait for an input switch to finish.

## [0.1.0] - 2026-10-11

### Added
- First version of Glass Remote Card: a single-file, dependency-free Lovelace card.
- Platforms: `apple_tv`, `kodi`, `webostv`, `generic`, plus per-button `actions` overrides.
- Layout: full-screen layout with safe areas and phone proportions; `card` layout for normal dashboards.
- Picking the player:
  - Built-in device picker.
  - Automatic player choice: a manual pick (kept for `pick_timeout`), then the TV input via `source_map`, then ranking.
  - `?player=` URL parameter, used by Sidebar Mini Player's remote button.
- Controls:
  - Touchpad: swipe, swipe-and-hold to repeat, tap, long-press.
  - Side volume tabs with hold-to-repeat; receiver volume with fallback, or volume through the player's `remote` entity.
- Text: keyboard and dictation text box, and the automatic "wants text" bar.
- Look and feel: frosted glass styling, thin line icons, haptics.

[0.2.3]: https://github.com/evski/ha-glass-remote-card/releases/tag/v0.2.3
[0.2.2]: https://github.com/evski/ha-glass-remote-card/releases/tag/v0.2.2
[0.1.13]: https://github.com/evski/ha-glass-remote-card/releases/tag/v0.1.13
