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
  - Back and forward 10 seconds, info and subtitles inside the pad.
  - Play/pause, a big Back button and Home underneath. Long-press Back for the top menu and Home for the platform's extra action.
- **Volume tabs on the pad's edge, like the Remote app.** Holding a tab repeats. Volume can go to a receiver, with a fallback when the receiver is off, or through the Apple TV remote (HDMI-CEC/IR).
- **Keyboard and dictation.**
  - The keyboard and mic buttons open a text box.
  - On iPhone, tap the keyboard's mic key to dictate.
  - Text goes live to an Apple TV or LG, and is sent with Enter to Kodi.
- **"Wants text" bar.** It appears by itself when the Apple TV's keyboard-focus sensor turns on.
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
| `keyboard_sensor` | A `binary_sensor` that is `on` while the device wants text (Apple TV: the *Keyboard focus* sensor). It shows the "wants text" bar. |
| `volume_entity` | Where volume and mute go, e.g. an AV receiver. |
| `volume_fallback` | Used when `volume_entity` is off or unavailable. |
| `volume_via_remote` | Apple TV: send volume through the remote (`volume_up`/`volume_down`). Mute is hidden. |
| `actions` | Override any button: `up`, `down`, `left`, `right`, `select`, `select_hold`, `back`, `back_hold`, `home`, `home_hold`, `play_pause`, `skip_back`, `skip_fwd`, `info`, `subtitles`, `power`, `volume_up`, `volume_down`, `mute`, `text`. Each takes `{service, data, target}` or a list of them. In `text`, the value `$text` is replaced with what you typed. |

```yaml
    actions:
      power:
        service: script.turn_on
        target: { entity_id: script.living_room_tv_power }
      text:
        service: notify.my_tv
        data: { message: $text }
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
- **A web page can't open the phone keyboard without a tap.** That's why the "wants text" bar is one tap.
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
