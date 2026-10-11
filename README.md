# Glass Remote Card

[![HACS Custom](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://hacs.xyz/docs/faq/custom_repositories)
[![GitHub release](https://img.shields.io/github/v/release/evski/ha-glass-remote-card)](https://github.com/evski/ha-glass-remote-card/releases)
[![Tests](https://github.com/evski/ha-glass-remote-card/actions/workflows/test.yml/badge.svg)](https://github.com/evski/ha-glass-remote-card/actions/workflows/test.yml)
[![HACS validation](https://github.com/evski/ha-glass-remote-card/actions/workflows/validate.yml/badge.svg)](https://github.com/evski/ha-glass-remote-card/actions/workflows/validate.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**An Apple TV Remote-style Liquid Glass remote for Home Assistant that follows whatever you're watching.**
One card drives your Apple TVs, Kodi, LG webOS TVs and any other `media_player`: touchpad, volume, keyboard and dictation, with the now-playing artwork on top. Built for the iPhone companion app, full screen, and it works in any browser.

Single JavaScript file. No dependencies: no card-mod, browser_mod, kiosk-mode or template helpers needed.

<p align="center">
  <img src="https://raw.githubusercontent.com/evski/ha-glass-remote-card/main/docs/images/remote-kodi.png" width="240" alt="Remote controlling Kodi, with artwork in the top pill">
  <img src="https://raw.githubusercontent.com/evski/ha-glass-remote-card/main/docs/images/picker.png" width="240" alt="Device picker">
  <img src="https://raw.githubusercontent.com/evski/ha-glass-remote-card/main/docs/images/remote-apple-tv-wants-text.png" width="240" alt="Apple TV asking for text">
</p>

## Features

- **Looks like Apple's Remote app.** Liquid Glass buttons, thin line icons, a big touchpad and Apple's proportions.
- **Full screen with safe areas.** The card fills the screen and respects the notch and home indicator on any phone. There's no hard-coded height. Use `layout: card` to place it inside a normal dashboard instead.
- **Follows what you're watching.** Priority order:
  - A device you picked yourself, kept for a few hours.
  - Your TV's input, mapped to a player. An app running on the TV selects the TV itself.
  - Otherwise playing beats paused, which beats idle, and the most recent change wins.
- **Now-playing pill.** Shows artwork, title and `Device · episode/app/state`. Tap it to open the device picker, which is built in (no browser_mod).
- **Touchpad.** Swipe for arrows; keep holding after a swipe to keep moving. Tap to select, long-press for the context menu.
- **Buttons:**
  - A bottom row inside the pad, like Apple's remote during playback: **sources list | -10 | ⋯ more | +10 | CH**. The CH control only shows on devices with channel keys.
  - **Sources** opens a glass picker with the player's sources, or those of your receiver or TV. The current source is ticked.
  - **More (⋯)** holds info, subtitles, sound mode and each platform's extras.
  - Play/pause, a big Back button and Home underneath. Long-press Back for the top menu and Home for the platform's extra action.
- **Volume tabs on the pad's edge, like the Remote app.** Holding a tab repeats. Press and hold the speaker badge between the tabs to pick the receiver's **sound mode**. Volume can go to a receiver, with a fallback when the receiver is off, or through the Apple TV remote (HDMI-CEC/IR).
- **Keyboard and dictation.**
  - The keyboard and mic buttons open a text box.
  - On iPhone, tap the keyboard's mic key to dictate.
  - Text goes live to an Apple TV, LG or Kodi. Kodi gets `Input.SendText` with `done: false` while you type and `done: true` on Enter, so it lands in an add-on's search box.
- **Keyboard notification.** When the Apple TV's keyboard-focus sensor turns on, an iOS-style banner slides down: "*Living Room Keyboard* / *Keyboard Input* / Enter text on your Apple TV using your iOS keyboard. Press to type." Tap it to type.
- **Input switching.** Before a key is sent, the card can put your AV receiver, soundbar or TV on the right input. By default this happens on Home. See [Input switching](#input-switching).
- **Haptics** in the Home Assistant companion apps.
- **Pairs with [Sidebar Mini Player](https://github.com/evski/ha-sidebar-mini-player).** Its remote button opens this card already set to that player.

## Supported devices

| `platform` | Integration | Arrows, select, back, home | Skip | Info / subtitles | Text | Power |
|---|---|---|---|---|---|---|
| `apple_tv` | [Apple TV](https://www.home-assistant.io/integrations/apple_tv/) (`remote.*` + `media_player.*`) | `remote.send_command` | ±10 s (skip_backward/forward) | Opens tvOS's info panel | Live, via `apple_tv.set_keyboard_text` (needs `config_entry_id`) | Wake / sleep |
| `kodi` | [Kodi](https://www.home-assistant.io/integrations/kodi/) | `kodi.call_method` Input.* | ±10 s (Player.Seek) | Input.Info / show subtitles (hold = next track) | `Input.SendText` on Enter | Kodi shutdown menu |
| `webostv` | [LG webOS TV](https://www.home-assistant.io/integrations/webostv/) | `webostv.button` | Rewind / fast-forward | INFO / CC | Live, via the IME (`webostv.command`) | On / off |
| `generic` | Any `media_player` (and optional `remote.*`) | Via `remote` if you set one | Previous / next track | Via `remote` | Your own `actions.text` | On / off |

Every button can be overridden per player with `actions:` (see below).

## Installation

### HACS (recommended)

1. HACS → ⋮ → **Custom repositories** → add `https://github.com/evski/ha-glass-remote-card` as **Dashboard**.
2. Install **Glass Remote Card**, then reload the browser. In the iOS app, use **Settings → Companion App → Debugging → Reset frontend cache**.

### Manual

Copy `glass-remote-card.js` to `/config/www/`, then add a dashboard resource `/local/glass-remote-card.js` (type: JavaScript module).

## Quick start

Make a new dashboard (e.g. "Remote"). Add a view with **View type: Panel (single card)** and this card:

```yaml
type: custom:glass-remote-card
players:
  - entity: media_player.living_room_apple_tv
    platform: apple_tv
    remote: remote.living_room_apple_tv
  - entity: media_player.kodi
    platform: kodi
```

The card covers the whole screen, including the dashboard header. Its picker has an **Exit remote** entry that goes back to `exit_path`.

## Full example

```yaml
type: custom:glass-remote-card
layout: fullscreen          # or "card" to sit inside a normal dashboard
pick_timeout: 180           # minutes a manual pick is kept
players:
  - entity: media_player.living_room_apple_tv
    name: Living Room
    platform: apple_tv
    remote: remote.living_room_apple_tv
    config_entry_id: 01ABCDEF...          # enables typing (see below)
    keyboard_sensor: binary_sensor.living_room_apple_tv_keyboard_focus
    volume_entity: media_player.receiver  # volume + mute go here...
    volume_fallback: media_player.living_room_tv  # ...or here when the receiver is off
  - entity: media_player.kodi
    platform: kodi
    volume_entity: media_player.receiver
    volume_fallback: media_player.living_room_tv
  - entity: media_player.living_room_tv
    platform: webostv
    volume_entity: media_player.receiver
    volume_fallback: media_player.living_room_tv
  - entity: media_player.bedroom_apple_tv
    name: Bedroom
    platform: apple_tv
    remote: remote.bedroom_apple_tv
    volume_via_remote: true               # Apple TV volume_up/down (CEC/IR); hides mute
source_map:                               # optional: follow the TV's input
  entity: media_player.living_room_tv
  sources:
    "Apple TV": media_player.living_room_apple_tv
    "Kodi": media_player.kodi
  ignore_sources: ["AV Receiver", "HDMI 1"]   # inputs that don't say who's playing
```

## Options

### Card

| Option | Default | Description |
|---|---|---|
| `players` | **required** | List of players (below). A plain entity id string also works. |
| `layout` | `fullscreen` | `fullscreen`: a fixed, full-viewport remote that respects safe areas. `card`: a normal card. |
| `pad_height` | `58dvh` | Touchpad height in full screen (Apple's proportion). It shrinks on small screens. |
| `card_height` | `640px` | Height of the whole card in `card` layout. |
| `pick_timeout` | `180` | Minutes a manual pick is kept before Auto takes over again. |
| `source_map` | – | `entity` (the TV), `sources` (input → player), `ignore_sources` (inputs that fall through to ranking), `default_to_tv` (`true`: any other source selects the TV). |
| `exit_path` | `/` | Where **Exit remote** goes. |
| `show_exit` | `true` | Show **Exit remote** in the picker (full screen only). |
| `url_param` | `player` | URL parameter that pre-selects a player, e.g. `/remote/0?player=media_player.kodi`. |
| `haptics` | `true` | Haptic feedback in the companion apps. |
| `id` | – | Optional key that keeps the manual pick separate when you have several remote cards. |

### Player

| Option | Description |
|---|---|
| `entity` | **Required.** The `media_player`. |
| `platform` | `apple_tv`, `kodi`, `webostv` or `generic`. It's guessed from the entity id if you leave it out. |
| `name`, `icon` | Display name and the icon shown when there's no artwork. |
| `remote` | `remote.*` entity. Required for `apple_tv`; optional for `generic` (arrows, select, back, home, info). |
| `config_entry_id` | Apple TV only: enables typing. Find it in **Settings → Devices & services → Apple TV**: open the entry, and the id is in the URL. |
| `keyboard_sensor` | A `binary_sensor` that is `on` while the device wants text (Apple TV: the *Keyboard focus* sensor). It shows the keyboard notification banner. |
| `volume_entity` | Where volume and mute go, e.g. an AV receiver. |
| `volume_fallback` | Used when `volume_entity` is off or unavailable. |
| `volume_via_remote` | Apple TV: send volume through the remote (`volume_up`/`volume_down`). Mute is hidden. |
| `input` | Switch an AVR, soundbar or TV to this player's input before a key is sent. Takes one input or a list. See [Input switching](#input-switching). |
| `sources` | The sources picker (list button). See [Sources, sound mode, More and CH](#sources-sound-mode-more-and-ch). |
| `sound_mode` | The sound mode menu (hold the speaker badge, or ⋯ → Sound Mode). |
| `more` | Items in the ⋯ menu, or `false` to hide it. |
| `channels` | Show the CH up/down control. |
| `keyboard_poll` | Kodi: how often (ms) to check whether Kodi's on-screen keyboard is open. Default `2000`; `0` turns it off. Also settable on the card. See [Kodi keyboard detection](#kodi-keyboard-detection). |
| `keyboard_poll_during_video` | Kodi: keep checking while a video plays. Default `false`. |
| `actions` | Override any button: `up`, `down`, `left`, `right`, `select`, `select_hold`, `back`, `back_hold`, `home`, `home_hold`, `play_pause`, `skip_back`, `skip_fwd`, `info`, `subtitles`, `channel_up`, `channel_down`, `power`, `volume_up`, `volume_down`, `mute`, `text`. Each takes `{service, data, target}` or a list of them. In `text`, the value `$text` is replaced with what you typed. |

```yaml
    actions:
      power:
        service: script.turn_on
        target: { entity_id: script.living_room_tv_power }
      text:
        service: notify.my_tv
        data: { message: $text }
```

## Sources, sound mode, More and CH

### Sources (list button, bottom left of the pad)

By default the button lists the active player's own `source_list`; on an Apple TV that's its apps. When there's nothing to list, the button is hidden.

| Option | Default | Description |
|---|---|---|
| `sources` | the player | `false` hides the button. A plain entity id is shorthand for `entity`. |
| `sources.entity` | the player | A `media_player` (its `source_list`), or a `select` / `input_select` (its options). For example the AV receiver or the TV. |
| `sources.include` | all | Only these sources, in this order. Items can be `value` or `value: Label`. |
| `sources.exclude` | – | Sources to hide. |
| `sources.rename` | – | A map of `value: Label`. |
| `sources.action` | – | Your own action instead of `media_player.select_source` / `select.select_option`. `$value` is replaced with the chosen source. |

```yaml
  - entity: media_player.kodi
    platform: kodi
    sources:                       # Kodi has no sources, so show the receiver's inputs
      entity: media_player.receiver
      include:
        - UHD: Kodi
        - PVR: Apple TV
        - GAME: Games
  - entity: media_player.living_room_tv
    platform: webostv
    sources:
      exclude: [Live TV, Web Browser]
      rename: { HDMI 2: PlayStation }
```

### Sound mode (hold the speaker badge)

Press and hold the small speaker badge between the volume tabs. A glass menu opens with the receiver's sound modes, and the current one is ticked. The same menu is in ⋯ → **Sound Mode**. The +/- tabs keep hold-to-repeat.

| Option | Default | Description |
|---|---|---|
| `sound_mode` | `volume_entity`, else the player | `false` (or `hide: true`) turns it off. A plain entity id is shorthand for `entity`. |
| `sound_mode.entity` | `volume_entity` | A `media_player` with `sound_mode_list`, or a `select` (e.g. a soundbar's sound-program select). |
| `sound_mode.modes` | all | Only these modes, in this order. Items can be `value` or `value: Label`. `include` works too. |
| `sound_mode.exclude`, `sound_mode.rename` | – | As for sources. |
| `sound_mode.action` | – | Your own action instead of `media_player.select_sound_mode`. `$value` is replaced with the chosen mode. |

```yaml
    volume_entity: media_player.receiver
    sound_mode:
      modes:
        - STEREO: Stereo
        - DOLBY_SURROUND: Dolby Surround
        - DTS_NEURAL_X: DTS Neural:X
        - MCH_STEREO: Multichannel Stereo
```

### More (⋯)

The defaults depend on the platform. Items that don't do anything on the player are left out.

| `platform` | Default `more` |
|---|---|
| `apple_tv` | `info`, `subtitles`, `sound_mode`, `control_center`, `top_menu` |
| `kodi` | `info`, `subtitles`, `subtitles_hold` (next subtitle), `audio_track`, `sound_mode`, `osd`, `context_menu` |
| `webostv` | `info`, `subtitles`, `sound_mode`, `settings`, `exit` |
| `generic` | `info`, `subtitles`, `sound_mode` |

Each item can be:
- any key name, which follows your `actions` overrides;
- `sound_mode` or `sources`, which open those menus;
- your own `{name, icon, service, data, target}`, or `{name, key}`.

Set `more: false` to hide the button.

```yaml
    more:
      - info
      - sound_mode
      - name: Movie lights
        icon: settings          # optional, one of the card's icon names
        service: scene.turn_on
        target: { entity_id: scene.movie_time }
```

### CH (channel up/down)

This is shown for `apple_tv` (pyatv `channel_up`/`channel_down`, for live-TV apps) and `webostv` (`CHANNELUP`/`CHANNELDOWN`). Set `channels: true` to add it for Kodi PVR (or for `generic` with a `remote`), and `channels: false` to remove it. Override the keys with `actions.channel_up` / `actions.channel_down`.

### Power on Apple TV

Power uses `media_player.turn_on` when the Apple TV is off or in standby, and `media_player.turn_off` otherwise. The card never sends `remote.send_command` `turn_off`/`suspend` with `hold_secs`, because pyatv rejects a held power command. There is no long-press action on Power.

## Kodi keyboard detection

Kodi has no "keyboard is open" sensor in Home Assistant, so the card asks Kodi itself. While Kodi is the active player, the card is on screen, and Kodi isn't playing a video, the card calls `kodi.call_method` → `GUI.GetProperties {properties: [currentwindow]}` every `keyboard_poll` ms. It reads the answer from the `kodi_call_method_result` event.

When the current window is the virtual keyboard (`10103`) or the numeric input (`10109`), the keyboard banner slides down. Tap it to type; the banner hides once Kodi closes the keyboard.

- Polling stops when the page or app is in the background, the card is removed, another player is picked, Kodi is off or a video starts. Set `keyboard_poll_during_video: true` to keep it running during video.
- The poll is read-only. It doesn't add logbook entries, but each poll and its result are stored as events by the recorder. If you don't want them in your database, exclude `call_service` / `kodi_call_method_result` in `recorder:` or raise `keyboard_poll`.
- It needs a Home Assistant user that may call `kodi.call_method`, as for every other Kodi button.

```yaml
  - entity: media_player.kodi
    platform: kodi
    keyboard_poll: 1500            # ms; 0 = off
    keyboard_poll_during_video: false
```

## Input switching

Say Kodi plays through the receiver's `UHD` input, and the receiver is still on the Apple TV's input. Pressing Home on Kodi would then do nothing you can see. With `input:`, the card first switches the receiver to `UHD` and then sends Home. If the receiver is already on `UHD`, only Home is sent.

```yaml
  - entity: media_player.kodi
    platform: kodi
    input:
      entity: media_player.receiver   # AVR, soundbar or TV
      source: UHD                     # must match the entity's source list
```

| Option | Default | Description |
|---|---|---|
| `entity` | **required** | The `media_player` whose input is switched: an AV receiver, soundbar or TV. |
| `source` | **required** unless `action` is set | Source name to select. It must match the entity's `source_list` exactly. |
| `triggers` | `[home]` | Which buttons switch the input first. You can use any key name (`home`, `power`, `select`, `back`, `play_pause`, `up`, `down`, `left`, `right`, `skip_back`, `skip_fwd`, `info`, `subtitles`, `volume_up`, `volume_down`, `mute`, `text`). `any` means every button. `first` means the first button pressed after the card starts controlling this player. `pick` means when you pick this player in the picker (or open the card with `?player=`). Long presses (`home_hold`) count as their button. |
| `skip_if_selected` | `true` | Do nothing if the entity is already on `source`. Set `false` to send the switch every time. |
| `turn_on` | `false` | If the entity is off or in standby, turn it on first. When this is `false` and the entity is off, the switch is skipped, because selecting a source on an off receiver does nothing. |
| `turn_on_delay` | `1500` | Milliseconds to wait after `turn_on` before selecting the source. Receivers often ignore commands while they boot. |
| `delay` | `0` | Milliseconds to wait after switching and before sending the key. |
| `on_auto` | `false` | With `pick`: also switch when **Auto** moves to this player by itself. Off by default, so Auto never fights you. |
| `action` | – | A custom action (or a list) used **instead of** `media_player.select_source`, e.g. a script. Takes `{service, data, target}`. `$source` in the data is replaced with `source`. |

Notes:
- An `unavailable` or `unknown` entity is skipped and the key is still sent.
- While a switch is running, another press doesn't start a second switch.
- With a list of inputs, they run in order. For example: the receiver first, then the TV's HDMI input.

**Switch the room when you pick a player** (and keep Home switching too):

```yaml
  - entity: media_player.living_room_apple_tv
    input:
      - entity: media_player.receiver
        source: PVR
        triggers: [pick, home]
      - entity: media_player.living_room_tv     # TV on the receiver's HDMI
        source: AV Receiver
        triggers: [pick]
  - entity: media_player.kodi
    input:
      entity: media_player.receiver
      source: UHD
      triggers: [pick, home]
      # on_auto: true    # also when Auto picks Kodi by itself (off by default)
```

**AV receiver, powered on when needed:**

```yaml
    input:
      entity: media_player.receiver
      source: UHD
      turn_on: true
      turn_on_delay: 4000      # this receiver needs ~4 s to wake
      delay: 500               # let HDMI settle before Home
      triggers: [home, power]
```

**Soundbar, switching on any button:**

```yaml
    input:
      entity: media_player.soundbar
      source: HDMI ARC
      triggers: [any]
```

**TV HDMI input, on the first press only:**

```yaml
  - entity: media_player.games_console
    platform: generic
    input:
      entity: media_player.living_room_tv
      source: HDMI 2
      triggers: [first]
```

**Receiver and TV together, or your own script:**

```yaml
    input:
      - entity: media_player.receiver
        source: UHD
      - entity: media_player.living_room_tv
        source: HDMI 1
        action:                          # your own script instead of select_source
          service: script.tv_input
          data: { input: $source }
```

## Open it from iPhone Control Center

- **iOS 18+:** in Control Center, tap **+** → **Add a Control** → **Home Assistant** → **Open Page**, and pick your remote dashboard.
- **Older iOS:** use a Shortcut with **Open URL** `homeassistant://navigate/<dashboard>/<view>`, then add the Shortcut to Control Center.

## With Sidebar Mini Player

[Sidebar Mini Player](https://github.com/evski/ha-sidebar-mini-player) shows what's playing in the sidebar. Set its `remote_path` option so its remote icon opens this card already set to that player:

```js
// sidebar mini player config
remote_path: "/dashboard-remote/0?player={entity}",
remote_players: ["media_player.living_room_*", "media_player.kodi"],
```

`{entity}` becomes the player's entity id, and this card reads it from `?player=` (see `url_param`). No `input_select` is needed. *(The `remote_path` option is coming in the next mini player release.)*

## Hiding the header another way

`layout: fullscreen` already covers the header and sidebar. If you prefer `layout: card` on a normal view and still want the header gone, [kiosk-mode](https://github.com/NemesisRE/kiosk-mode) works well:

```yaml
kiosk_mode:
  hide_header: true
  hide_sidebar: true
```

## Limits

- **Siri can't be triggered** from Home Assistant on an Apple TV. Use the mic button and your keyboard's dictation instead.
- **A web page can't open the phone keyboard without a tap.** That's why the keyboard notification needs one tap.
- **Apple TV info and subtitles both open tvOS's info panel.** There are no separate keys for them.
- **LG rewind/fast-forward** change playback speed; they don't jump 10 seconds.
- **The manual pick is stored per device** (local storage), not shared between phones.

## Development

```bash
npm ci
npm test                    # jsdom suite with fake hass; nothing touches a real device
python scripts/screenshots.py  # re-render docs/images from docs/demo/demo.html (Playwright)
```

Licence: [MIT](LICENSE).
