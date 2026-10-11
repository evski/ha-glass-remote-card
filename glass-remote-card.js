/*!
 * Glass Remote Card for Home Assistant
 * A frosted-glass touchpad remote that follows whatever you're watching.
 * Kodi, LG webOS, the Apple TV integration and any media_player. Single file, no dependencies.
 * Not affiliated with or endorsed by Apple Inc. Apple TV is a trademark of Apple Inc.
 *
 * https://github.com/evski/ha-glass-remote-card
 * MIT licence.
 *
 * 0.1.4 (Grok Bot, 11 Oct 2026): the pad's bottom row (sources | -10 | more | +10 | CH) is always shown,
 * Only the CH control changes: a compact "CH" with thin caps above and below
 * sits in the row; tapping it animates the caps out into an up/down chevron stack (channel up/down).
 * Tap CH again, or leave it ~5 s (`channel_timeout`), and it folds back. Replaces 0.1.3's hidden row.
 * 0.1.6 (Grok Bot, 11 Oct 2026): the mic button is gone by default (it did the same as the keyboard
 * button); `show_mic: true` brings it back.
 * 0.1.7 (Grok Bot, 11 Oct 2026): the typing sheet (keyboard button) now matches the frosted glass look and
 * the keyboard banner: same frosted glass panel and app-icon header, thin close icon in a glass circle,
 * glass pill Clear/Send buttons (no accent-coloured text links), shorter placeholder, no hint line.
 * 0.1.8 (Grok Bot, 11 Oct 2026): every sheet and menu (device picker, sources, sound mode, More) uses that
 * same glass panel (PANEL): picker header like the typing sheet, thin close in a glass circle, white ticks
 * and a soft glass highlight for the selected row instead of accent-coloured text.
 * 0.1.8 keyboard focus: when the player can tell us a text field is focused (a keyboard_sensor such as the
 * apple_tv integration's, or Kodi's keyboard window seen by the poll), the keyboard button only opens the typing sheet
 * while a field is focused; otherwise it shows a short glass hint. The sheet closes when focus drops.
 * Text service calls are made with HA's error toast turned off; a failure shows one glass hint instead.
 * 0.1.9 (Grok Bot, 11 Oct 2026): tablet / wide layout. On wide screens the full-screen
 * remote is a centred column with phone proportions (width = column_ratio x height, capped by max_width),
 * the touchpad grows to fill the height and the bottom three buttons cluster in the middle. Phones unchanged.
 * 0.1.10 (Grok Bot, 11 Oct 2026): neutral naming and wording ("frosted glass"), a generic remote glyph,
 * banner text without platform trademarks, system-ui font stack, trademark notice.
 * 0.1.10 device picker: a dropdown anchored under the top pill that grows downward (never a bottom sheet).
 * The pill's chevron turns from > to v; rows are plain (tick, small device icon, name) with hairline dividers;
 * Auto and Exit remote stay as rows; tapping outside or on the pill closes it (0.1.10 also had a close button,
 * removed in 0.1.12). The list spans the top row (the column on tablets).
 * 0.1.11 (Grok Bot, 11 Oct 2026): the whole top pill is one tap target. A live test showed taps on the
 * middle of the pill and on its chevron did not open the picker; only a click on the button's exact centre
 * did. Root cause: the card's full-screen layer and the picker backdrop are stacked inside the dashboard
 * view, so a layer above the card (and, while open, our own backdrop) received taps over the top row.
 * Fix: the pill's children (artwork, title, subtitle, chevron) never take pointer events, so the button
 * itself is always the target; the picker now lives inside the card's own layer with the top row raised
 * above its backdrop, so tapping the pill toggles it closed; and taps that land on a foreign layer over the
 * pill's area are routed to the pill. One button (aria-haspopup, aria-expanded, aria-controls); Escape closes.
 * 0.1.12 (Grok Bot, 11 Oct 2026): the device picker is a compact floating frosted-glass panel that is only as
 * tall as its rows (Auto, the devices, Exit remote) and grows down from the pill, with rounded corners and a
 * soft shadow. Why: feedback that the open dropdown covered the whole page as a dark full-height sheet. The
 * full-page shade is gone; a transparent full-screen tap-catcher stays, so tapping outside still closes it.
 * The panel scrolls only when the rows would run past the bottom of the screen. The close button is removed:
 * tapping the pill, tapping outside or pressing Escape closes it. The sources, sound mode and More menus were
 * already compact floating panels without a close button, so they are unchanged.
 * 0.1.13 (Grok Bot, 11 Oct 2026): the picker's look is back to 0.1.11 (plain rows on the dark blurred shade,
 * same colours, row padding, icons, hairlines, tick and fonts; no glass card, rounded panel or shadow). Why:
 * Evan wanted the earlier styling kept. Only two 0.1.12 behaviour changes stay: the dark shade now ends just
 * below the last row (Exit remote) with a short fade instead of covering the whole page, and there is still no
 * close button (pill, outside tap or Escape close it). The slide-down animation is unchanged.
 * 0.2.0 (Grok Bot, 11 Oct 2026): per-player shortcuts (`players[].shortcuts`). What: a list of named
 * service calls shown as their own section at the top of the existing More (...) menu, only while that player
 * is the one being controlled. A "search" shortcut first opens the typing sheet (same frosted panel, titled
 * with its prompt, Send becomes Search) and puts what you typed into the call wherever the data says {text}
 * ({text_url} / {{ text | urlencode }} = URL-encoded, for plugin URLs). A "call" shortcut runs straight away.
 * Why: Evan wanted add-on searches and list shortcuts on the remote for Kodi, configurable rather than built
 * in, and without new buttons on the remote. Nothing in the code knows about any particular add-on.
 */
(() => {
  "use strict";

  const VERSION = "0.2.0";
  const TAG = "glass-remote-card";
  const PICK_KEY = "glass-remote-card:pick:";

  // ---------------------------------------------------------------------------
  // Icons: thin-stroke 24x24 line icons with rounded caps and joins.
  // ---------------------------------------------------------------------------
  const svg = (body, sw = 1.6) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" ` +
    `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  const BACK10 = '<path d="M4.5 12A7.5 7.5 0 1 0 12 4.5"/><path d="M13.6 2.6 11.6 4.5 13.6 6.4"/>';
  const TEN = '<path d="M9.4 10.1 10.6 9.3V15.3" stroke-width="1.4"/><ellipse cx="14.3" cy="12.3" rx="1.75" ry="3" stroke-width="1.4"/>';
  const ICONS = {
    play_pause: svg('<path d="M3.5 6.5v11l8.2-5.5z"/><path d="M15.5 6.5v11M20 6.5v11"/>'),
    back: svg('<path d="M15.5 3.5 7 12l8.5 8.5"/>', 1.4),
    home: svg('<rect x="2.8" y="4.3" width="18.4" height="12.4" rx="2"/><path d="M8.5 20h7"/>'),
    power: svg('<path d="M12 3.2v8.3"/><path d="M7.1 6.3a7.6 7.6 0 1 0 9.8 0"/>', 1.7),
    mute: svg('<path d="M4 9.3h3.2L11.5 5.7v12.6L7.2 14.7H4z"/><path d="M15.2 9.2a4 4 0 0 1 .9 4.6M18 6.6a7.6 7.6 0 0 1 1.3 8.6"/><path d="M3.5 3.5l17 17"/>'),
    unmuted: svg('<path d="M4 9.3h3.2L11.5 5.7v12.6L7.2 14.7H4z"/><path d="M15.2 9.2a4 4 0 0 1 0 5.6M18 6.6a7.6 7.6 0 0 1 0 10.8"/>'),
    mic: svg('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.7 11.3a6.3 6.3 0 0 0 12.6 0M12 17.6V21"/>'),
    speaker: svg('<path d="M3.5 9.3h3.2L11 5.7v12.6L6.7 14.7H3.5z"/><path d="M14.8 9.2a4 4 0 0 1 0 5.6M17.6 6.6a7.6 7.6 0 0 1 0 10.8"/>', 1.8),
    skip_back: svg(BACK10 + TEN),
    skip_fwd: svg('<g transform="translate(24 0) scale(-1 1)">' + BACK10 + "</g>" + TEN),
    rewind: svg('<path d="M11.5 7v10L4 12zM20 7v10l-7.5-5z"/>'),
    ffwd: svg('<path d="M12.5 7v10L20 12zM4 7v10l7.5-5z"/>'),
    prev: svg('<path d="M18 6.5v11L9.5 12zM6 6.5v11"/>'),
    next: svg('<path d="M6 6.5v11l8.5-5.5zM18 6.5v11"/>'),
    info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M10.4 11H12M10.4 17h3.2"/><circle cx="12" cy="7.7" r="0.4"/>'),
    subtitles: svg('<path d="M5 4.8h14a2 2 0 0 1 2 2v8.3a2 2 0 0 1-2 2h-8l-4 3.4v-3.4H5a2 2 0 0 1-2-2V6.8a2 2 0 0 1 2-2z"/><path d="M6.8 9.7h3M12 9.7h5.2M6.8 13h6M15 13h2.2"/>', 1.4),
    keyboard: svg('<rect x="2.3" y="6" width="19.4" height="12" rx="2"/><path d="M6 9.5h0M9 9.5h0M12 9.5h0M15 9.5h0M18 9.5h0M6 12.4h0M9 12.4h0M12 12.4h0M15 12.4h0M18 12.4h0M8 15.3h8" stroke-width="1.5"/>', 1.4),
    list: svg('<path d="M8.6 6.5h12M8.6 12h12M8.6 17.5h12" stroke-width="1.5"/><circle cx="4" cy="6.5" r=".55" fill="currentColor"/><circle cx="4" cy="12" r=".55" fill="currentColor"/><circle cx="4" cy="17.5" r=".55" fill="currentColor"/>'),
    more: svg('<circle cx="12" cy="12" r="9.2"/><circle cx="7.9" cy="12" r=".45" fill="currentColor"/><circle cx="12" cy="12" r=".45" fill="currentColor"/><circle cx="16.1" cy="12" r=".45" fill="currentColor"/>', 1.5),
    // sharp chevrons for the CH stack (Grok Bot, 11 Oct 2026)
    chev_up: '<svg viewBox="4 4.5 16 9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.5 12.5 12 6l6.5 6.5"/></svg>',
    chev_down: '<svg viewBox="4 4.5 16 9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.5 6 12 12.5 18.5 6"/></svg>',
    sound_mode: svg('<path d="M4 9.5v5M8 6.5v11M12 4v16M16 7.5v9M20 10v4"/>', 1.6),
    control_center: svg('<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="3.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="3.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>', 1.4),
    settings: svg('<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>', 1.4),
    audio: svg('<path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>', 1.4),
    plus: svg('<path d="M12 7v10M7 12h10"/>', 2),
    minus: svg('<path d="M7 12h10"/>', 2),
    chevron: svg('<path d="M9 5.5 15.5 12 9 18.5"/>', 2),
    tv: svg('<rect x="2.8" y="4.3" width="18.4" height="12.4" rx="2"/><path d="M8.5 20h7"/>'),
    auto: svg('<circle cx="12" cy="12" r="8.5"/><path d="M8.3 15.5 12 7.5l3.7 8M9.6 12.8h4.8"/>'),
    exit: svg('<path d="M14 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2H14M10 12h10M16.5 8.5 20 12l-3.5 3.5"/>'),
    close: svg('<path d="M6 6l12 12M18 6 6 18"/>', 1.8),
    // 0.2.0 (Grok Bot, 11 Oct 2026): default icon for search shortcuts in the More menu
    search: svg('<circle cx="10.5" cy="10.5" r="6.2"/><path d="M15.2 15.2 20.5 20.5"/>', 1.7),
  };

  // CH control (0.1.4, Grok Bot 11 Oct 2026): each glyph holds the collapsed thin cap and the open
  // chevron; CSS cross-fades and moves them, so it works in mobile browsers without CSS path morphing.
  const CH_UP = '<svg viewBox="4 4.5 16 9" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path class="cap" stroke-width="1.6" d="M6.2 10.6 10.8 8.4Q12 7.8 13.2 8.4L17.8 10.6"/><path class="chev" stroke-width="2" d="M6.5 12 12 6.5l5.5 5.5"/></svg>';
  const CH_DOWN = '<svg viewBox="4 4.5 16 9" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path class="cap" stroke-width="1.6" d="M6.2 7.4 10.8 9.6Q12 10.2 13.2 9.6L17.8 7.4"/><path class="chev" stroke-width="2" d="M6.5 6.5 12 12l5.5-5.5"/></svg>';

  // Generic TV-remote glyph for the keyboard banner's and typing sheet's app icon (0.1.10, Grok Bot 11 Oct 2026):
  // body, power dot, ring d-pad and a 3x3 key grid.
  const REMOTE_GLYPH = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="1.6" width="10" height="20.8" rx="3" fill="#fff"/>' +
    '<circle cx="14.6" cy="4.2" r="0.8" fill="#2c2c2e"/>' +
    '<circle cx="12" cy="8.9" r="2.7" fill="none" stroke="#2c2c2e" stroke-width="1.1"/><circle cx="12" cy="8.9" r="1" fill="#2c2c2e"/>' +
    [13.8, 16.4, 19].map((y) => [9.3, 11.3, 13.3].map((x) => `<rect x="${x}" y="${y}" width="1.4" height="1.4" rx=".35" fill="#2c2c2e"/>`).join("")).join("") +
    '</svg>';

  /** Banner text for the "wants text" notification. 0.1.10: neutral wording, the player's own name. */
  function bannerText(p, name) {
    const where = { kodi: "Kodi", webostv: "your LG TV" }[p.platform] || name;
    return { title: `${name} Keyboard`, line2: "Keyboard Input", body: `Enter text on ${where} using your keyboard. Press to type.` };
  }

  /** Keyboard focus, 0.1.8 (Grok Bot, 11 Oct 2026): true/false when the player can report whether a text
   *  field is focused (a keyboard_sensor, or Kodi's keyboard window seen by the poll); null when it can't
   *  (e.g. LG webOS), so the keyboard button keeps working as before. `kodi` = { polling, open }. */
  function kbFocus(p, st, kodi) {
    if (!p) return null;
    if (p.keyboard_sensor) { const s = st[p.keyboard_sensor]; return !!(s && s.state === "on"); }
    if (p.platform === "kodi" && kodi && kodi.polling) return !!kodi.open;
    return null;
  }
  const NOT_FOCUSED = /not? .*focus|no text input/i;

  const OFF_STATES = ["off", "unavailable", "unknown", "standby"];
  const RANK = { playing: 3, paused: 2, on: 1, idle: 1, buffering: 1 };

  // ---------------------------------------------------------------------------
  // Platforms: how each logical button maps to Home Assistant services.
  // A step is [domain, service, data]. `p` is the normalised player config.
  // ---------------------------------------------------------------------------
  const rc = (p, command, extra = {}) => ["remote", "send_command", { entity_id: p.remote, command, ...extra }];
  const mp = (p, service, extra = {}) => ["media_player", service, { entity_id: p.entity, ...extra }];
  const kodi = (p, method, params = {}) => ["kodi", "call_method", { entity_id: p.entity, method, ...params }];
  const lg = (p, button) => ["webostv", "button", { entity_id: p.entity, button }];
  const isOff = (st) => !st || OFF_STATES.includes(st.state);

  const PLATFORMS = {
    apple_tv: {
      label: "Apple TV",
      icon: "mdi:television-box",
      icons: {},
      keys: {
        up: (p) => rc(p, "up"), down: (p) => rc(p, "down"), left: (p) => rc(p, "left"), right: (p) => rc(p, "right"),
        select: (p) => rc(p, "select"), select_hold: (p) => rc(p, "select", { hold_secs: 1 }),
        back: (p) => rc(p, "menu"), back_hold: (p) => rc(p, "top_menu"),
        home: (p) => rc(p, "home"), home_hold: (p) => rc(p, "home", { hold_secs: 1 }),
        play_pause: (p) => rc(p, "play_pause"),
        skip_back: (p) => rc(p, "skip_backward"), skip_fwd: (p) => rc(p, "skip_forward"),
        // the device has no separate info/subtitle key: swipe-down opens the info panel (Info / Subtitles / Audio).
        info: (p) => rc(p, "down"), subtitles: (p) => rc(p, "down"),
        // Power: media_player.turn_on/turn_off (pyatv's power API). Never remote.send_command
        // turn_off/suspend: with hold_secs that raises "turn_off() got an unexpected keyword argument 'action'".
        power: (p, st) => mp(p, isOff(st) ? "turn_on" : "turn_off"),
        channel_up: (p) => rc(p, "channel_up"), channel_down: (p) => rc(p, "channel_down"),
        control_center: (p) => rc(p, "control_center"), top_menu: (p) => rc(p, "top_menu"),
        remote_volume_up: (p) => rc(p, "volume_up"), remote_volume_down: (p) => rc(p, "volume_down"),
      },
      text: (p, text) => p.config_entry_id
        ? [["apple_tv", "set_keyboard_text", { config_entry_id: p.config_entry_id, text }]] : [],
      textLive: true,
      needsRemote: true,
      channels: true,
      more: ["info", "subtitles", "sound_mode", "control_center", "top_menu"],
    },
    kodi: {
      label: "Kodi",
      icon: "mdi:kodi",
      icons: {},
      keys: {
        up: (p) => kodi(p, "Input.Up"), down: (p) => kodi(p, "Input.Down"),
        left: (p) => kodi(p, "Input.Left"), right: (p) => kodi(p, "Input.Right"),
        select: (p) => kodi(p, "Input.Select"), select_hold: (p) => kodi(p, "Input.ContextMenu"),
        back: (p) => kodi(p, "Input.Back"), home: (p) => kodi(p, "Input.Home"),
        home_hold: (p) => kodi(p, "Input.ContextMenu"),
        play_pause: (p) => mp(p, "media_play_pause"),
        skip_back: (p) => kodi(p, "Player.Seek", { playerid: 1, value: { seconds: -10 } }),
        skip_fwd: (p) => kodi(p, "Player.Seek", { playerid: 1, value: { seconds: 10 } }),
        info: (p) => kodi(p, "Input.Info"),
        subtitles: (p) => kodi(p, "Input.ExecuteAction", { action: "showsubtitles" }),
        subtitles_hold: (p) => kodi(p, "Input.ExecuteAction", { action: "nextsubtitle" }),
        power: (p) => kodi(p, "GUI.ActivateWindow", { window: "shutdownmenu" }),
        audio_track: (p) => kodi(p, "Input.ExecuteAction", { action: "audionextlanguage" }),
        context_menu: (p) => kodi(p, "Input.ContextMenu"),
        osd: (p) => kodi(p, "Input.ShowOSD"),
        // only shown with `channels: true` (Kodi PVR)
        channel_up: (p) => kodi(p, "Input.ExecuteAction", { action: "channelup" }),
        channel_down: (p) => kodi(p, "Input.ExecuteAction", { action: "channeldown" }),
      },
      // Input.SendText replaces the keyboard's text: sent live with done=false, then done=true on Enter.
      text: (p, text, done) => [kodi(p, "Input.SendText", { text, done: !!done })],
      textLive: true,
      kbPoll: true,
      channels: false,
      more: ["info", "subtitles", "subtitles_hold", "audio_track", "sound_mode", "osd", "context_menu"],
    },
    webostv: {
      label: "LG webOS",
      icon: "mdi:television",
      icons: { skip_back: "rewind", skip_fwd: "ffwd" },
      keys: {
        up: (p) => lg(p, "UP"), down: (p) => lg(p, "DOWN"), left: (p) => lg(p, "LEFT"), right: (p) => lg(p, "RIGHT"),
        select: (p) => lg(p, "ENTER"), select_hold: (p) => lg(p, "MENU"),
        back: (p) => lg(p, "BACK"), home: (p) => lg(p, "HOME"), home_hold: (p) => lg(p, "MENU"),
        play_pause: (p) => mp(p, "media_play_pause"),
        skip_back: (p) => lg(p, "REWIND"), skip_fwd: (p) => lg(p, "FASTFORWARD"),
        info: (p) => lg(p, "INFO"), subtitles: (p) => lg(p, "CC"),
        power: (p, st) => mp(p, isOff(st) ? "turn_on" : "turn_off"),
        channel_up: (p) => lg(p, "CHANNELUP"), channel_down: (p) => lg(p, "CHANNELDOWN"),
        settings: (p) => lg(p, "MENU"), exit: (p) => lg(p, "EXIT"),
      },
      text: (p, text, done) => done
        ? [["webostv", "command", { entity_id: p.entity, command: "com.webos.service.ime/sendEnterKey" }]]
        : [["webostv", "command", { entity_id: p.entity, command: "com.webos.service.ime/insertText", payload: { text, replace: 1 } }]],
      textLive: true,
      channels: true,
      more: ["info", "subtitles", "sound_mode", "settings", "exit"],
    },
    generic: {
      label: "Media player",
      icon: "mdi:play-box-outline",
      icons: { skip_back: "prev", skip_fwd: "next" },
      keys: {
        up: (p) => p.remote ? rc(p, "up") : null, down: (p) => p.remote ? rc(p, "down") : null,
        left: (p) => p.remote ? rc(p, "left") : null, right: (p) => p.remote ? rc(p, "right") : null,
        select: (p) => p.remote ? rc(p, "select") : mp(p, "media_play_pause"),
        back: (p) => p.remote ? rc(p, "back") : null, home: (p) => p.remote ? rc(p, "home") : null,
        play_pause: (p) => mp(p, "media_play_pause"),
        skip_back: (p) => mp(p, "media_previous_track"), skip_fwd: (p) => mp(p, "media_next_track"),
        info: (p) => p.remote ? rc(p, "info") : null, subtitles: () => null,
        power: (p, st) => mp(p, isOff(st) ? "turn_on" : "turn_off"),
        channel_up: (p) => p.remote ? rc(p, "channel_up") : null, channel_down: (p) => p.remote ? rc(p, "channel_down") : null,
      },
      text: () => [],
      textLive: false,
      channels: false,
      more: ["info", "subtitles", "sound_mode"],
    },
  };

  // ---------------------------------------------------------------------------
  // Pure helpers (exported on the class for tests).
  // ---------------------------------------------------------------------------
  function normaliseConfig(config) {
    if (!config || typeof config !== "object") throw new Error("glass-remote-card: invalid configuration");
    let players = config.players || (config.entity ? [{ entity: config.entity }] : null);
    if (!Array.isArray(players) || !players.length) throw new Error("glass-remote-card: add at least one player under `players:`");
    players = players.map((raw, i) => {
      const p = typeof raw === "string" ? { entity: raw } : { ...raw };
      if (!p.entity || !String(p.entity).startsWith("media_player."))
        throw new Error(`glass-remote-card: players[${i}].entity must be a media_player entity`);
      p.platform = p.platform || guessPlatform(p);
      if (!PLATFORMS[p.platform]) throw new Error(`glass-remote-card: players[${i}].platform must be one of ${Object.keys(PLATFORMS).join(", ")}`);
      if (PLATFORMS[p.platform].needsRemote && !p.remote)
        throw new Error(`glass-remote-card: players[${i}] (apple_tv) needs a remote: entity (remote.xxx)`);
      if (p.input) p.input = normaliseInputs(p.input, i);
      for (const k of ["sources", "sound_mode"]) if (p[k] !== undefined) p[k] = normaliseOptionMenu(p[k], `players[${i}].${k}`);
      if (p.more !== undefined && p.more !== false && p.more !== true) {
        if (!Array.isArray(p.more)) throw new Error(`glass-remote-card: players[${i}].more must be a list (or false)`);
        p.more.forEach((m, j) => {
          if (typeof m === "string") return;
          if (!m || typeof m !== "object" || !m.name || !(m.key || m.service || m.action))
            throw new Error(`glass-remote-card: players[${i}].more[${j}] needs a name and a key or service`);
        });
      }
      if (p.keyboard_poll !== undefined && (typeof p.keyboard_poll !== "number" || p.keyboard_poll < 0))
        throw new Error(`glass-remote-card: players[${i}].keyboard_poll must be milliseconds (0 = off)`);
      if (p.channels !== undefined && typeof p.channels !== "boolean") throw new Error(`glass-remote-card: players[${i}].channels must be true or false`);
      if (p.shortcuts !== undefined) p.shortcuts = normaliseShortcuts(p.shortcuts, i); // 0.2.0 (Grok Bot, 11 Oct 2026)
      return p;
    });
    const out = {
      layout: "fullscreen", haptics: true, pick_timeout: 180, exit_path: "/", show_exit: true,
      pad_height: "58dvh", card_height: "640px", column_ratio: 0.52, max_width: "100vw", ...config, players,
    };
    // 0.1.9 (Grok Bot, 11 Oct 2026): wide-screen column. column_ratio = column width / screen height (~0.51 suits a tablet);
    // max_width caps it (any CSS length, or a number of px).
    if (typeof out.column_ratio !== "number" || !(out.column_ratio > 0) || out.column_ratio > 2) throw new Error("glass-remote-card: column_ratio must be a number between 0 and 2 (e.g. 0.52)");
    if (typeof out.max_width === "number") out.max_width = out.max_width + "px";
    if (typeof out.max_width !== "string" || !out.max_width) throw new Error("glass-remote-card: max_width must be a CSS length like 560px");
    if (!["fullscreen", "card"].includes(out.layout)) throw new Error("glass-remote-card: layout must be fullscreen or card");
    // show_mic (0.1.6, Grok Bot 11 Oct 2026): the mic button opened the same text box as the keyboard button
    if (out.show_mic === undefined) out.show_mic = false;
    if (typeof out.show_mic !== "boolean") throw new Error("glass-remote-card: show_mic must be true or false");
    // channel_timeout (0.1.4, Grok Bot 11 Oct 2026): ms before an expanded CH stack folds back; 0 = never
    if (out.channel_timeout === undefined) out.channel_timeout = 5000;
    if (typeof out.channel_timeout !== "number" || out.channel_timeout < 0) throw new Error("glass-remote-card: channel_timeout must be milliseconds (0 = never)");
    return out;
  }

  // ---------------------------------------------------------------------------
  // Input switching: put an AVR / soundbar / TV on the right input before a key is sent.
  // ---------------------------------------------------------------------------
  const INPUT_KEYS = ["home", "power", "select", "back", "play_pause", "up", "down", "left", "right",
    "skip_back", "skip_fwd", "info", "subtitles", "channel_up", "channel_down", "volume_up", "volume_down", "mute", "text",
    "shortcut"]; // 0.2.0 (Grok Bot, 11 Oct 2026): `shortcut` = before a More-menu shortcut runs
  const INPUT_DEFAULTS = { turn_on: false, turn_on_delay: 1500, triggers: ["home"], skip_if_selected: true, delay: 0, on_auto: false };

  function normaliseInputs(raw, i) {
    const list = Array.isArray(raw) ? raw : [raw];
    return list.map((inp, j) => {
      const where = `glass-remote-card: players[${i}].input${Array.isArray(raw) ? `[${j}]` : ""}`;
      if (!inp || typeof inp !== "object" || !inp.entity) throw new Error(`${where}.entity is required`);
      if (inp.source == null && !inp.action) throw new Error(`${where} needs a source (or a custom action)`);
      const o = { ...INPUT_DEFAULTS, ...inp };
      o.triggers = (Array.isArray(o.triggers) ? o.triggers : [o.triggers]).map(String);
      for (const t of o.triggers) {
        if (!INPUT_KEYS.includes(t) && t !== "any" && t !== "first" && t !== "pick")
          throw new Error(`${where}.triggers: "${t}" isn't one of ${INPUT_KEYS.join(", ")}, any, first, pick`);
      }
      if (typeof o.on_auto !== "boolean") throw new Error(`${where}.on_auto must be true or false`);
      for (const k of ["turn_on_delay", "delay"]) {
        if (typeof o[k] !== "number" || o[k] < 0) throw new Error(`${where}.${k} must be a number of milliseconds`);
      }
      return o;
    });
  }

  /**
   * Steps that switch inputs before `key` on player `p`. A ["wait", ms] step pauses the sequence.
   * firstPress = this is the first button pressed since the card started controlling this player.
   */
  function inputSteps(p, key, states, firstPress = false, opts = {}) {
    const out = [];
    const base = String(key).replace(/_hold$/, "");
    for (const inp of p.input || []) {
      const t = inp.triggers;
      if (base === "pick") { // the player was picked (or, with on_auto, Auto switched to it)
        if (!t.includes("pick") || (opts.auto && !inp.on_auto)) continue;
      } else if (!(t.includes(base) || t.includes("any") || (t.includes("first") && firstPress))) continue;
      const st = states[inp.entity];
      if (!st || st.state === "unavailable" || st.state === "unknown") continue; // nothing we can do
      const off = OFF_STATES.includes(st.state);
      if (off && !inp.turn_on) continue; // switching an off device does nothing; enable turn_on for that
      if (!off && inp.skip_if_selected && inp.source != null && st.attributes && st.attributes.source === inp.source) continue;
      if (off) {
        out.push(["media_player", "turn_on", { entity_id: inp.entity }]);
        if (inp.turn_on_delay) out.push(["wait", inp.turn_on_delay]);
      }
      if (inp.action) {
        const acts = Array.isArray(inp.action) ? inp.action : [inp.action];
        for (const a of acts) {
          const [domain, service] = String(a.service || a.action || "").split(".");
          out.push([domain, service, substSource({ ...(a.data || a.service_data || {}), ...(a.target || {}) }, inp.source)]);
        }
      } else {
        out.push(["media_player", "select_source", { entity_id: inp.entity, source: inp.source }]);
      }
      if (inp.delay) out.push(["wait", inp.delay]);
    }
    return out;
  }
  const substSource = (v, src) => v === "$source" ? src : Array.isArray(v) ? v.map((x) => substSource(x, src))
    : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, substSource(x, src)])) : v;

  // ---------------------------------------------------------------------------
  // Option menus: sources (list button) and sound modes (speaker badge / More menu).
  // ---------------------------------------------------------------------------
  function normaliseOptionMenu(raw, where) {
    if (raw === false) return { hide: true };
    if (raw === true || raw == null) return {};
    if (typeof raw === "string") return { entity: raw };
    if (typeof raw !== "object") throw new Error(`glass-remote-card: ${where} must be an entity id, an object or false`);
    const o = { ...raw };
    if (o.modes && !o.include) o.include = o.modes; // `modes:` reads better for sound modes
    delete o.modes;
    for (const k of ["include", "exclude"]) if (o[k] != null && !Array.isArray(o[k])) throw new Error(`glass-remote-card: ${where}.${k} must be a list`);
    if (o.rename != null && (typeof o.rename !== "object" || Array.isArray(o.rename))) throw new Error(`glass-remote-card: ${where}.rename must be a map of value: label`);
    if (o.include) { // allow `- STEREO: Stereo` items as include + rename in one
      o.rename = { ...(o.rename || {}) };
      o.include = o.include.map((x) => {
        if (x && typeof x === "object") { const [k, v] = Object.entries(x)[0] || []; if (k != null) o.rename[k] = v; return k; }
        return String(x);
      });
    }
    return o;
  }

  /** Build a menu {entity, current, options:[{value,name}]} from an entity's list attribute, or null. */
  function optionMenu(cfg, entity, states, listAttr, curAttr) {
    if (!cfg || cfg.hide || !entity) return null;
    const st = states[entity];
    const isSelect = /^(input_)?select\./.test(entity);
    const a = (st && st.attributes) || {};
    let list = isSelect ? a.options : a[listAttr];
    list = Array.isArray(list) ? list.map(String) : [];
    if (cfg.include) list = cfg.include.slice();
    if (cfg.exclude) list = list.filter((v) => !cfg.exclude.includes(v));
    if (!list.length) return null;
    const ren = cfg.rename || {};
    return {
      entity, current: st ? (isSelect ? st.state : a[curAttr]) : undefined,
      options: list.map((v) => ({ value: v, name: ren[v] != null ? String(ren[v]) : v })),
    };
  }
  const sourceMenu = (p, states) => optionMenu(p.sources || {}, (p.sources && p.sources.entity) || p.entity, states, "source_list", "source");
  const soundModeMenu = (p, states) => optionMenu(p.sound_mode || {}, (p.sound_mode && p.sound_mode.entity) || p.volume_entity || p.entity, states, "sound_mode_list", "sound_mode");

  /** Steps to choose `value` in a menu. kind: "source" | "sound_mode". */
  function optionSteps(cfg, entity, kind, value) {
    cfg = cfg || {};
    if (cfg.action) {
      const acts = Array.isArray(cfg.action) ? cfg.action : [cfg.action];
      return acts.map((a) => {
        const [domain, service] = String(a.service || a.action || "").split(".");
        const sub = (v) => v === "$value" || v === "$source" || v === "$mode" ? value : Array.isArray(v) ? v.map(sub)
          : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, sub(x)])) : v;
        return [domain, service, sub({ ...(a.data || a.service_data || {}), ...(a.target || {}) })];
      });
    }
    if (/^input_select\./.test(entity)) return [["input_select", "select_option", { entity_id: entity, option: value }]];
    if (/^select\./.test(entity)) return [["select", "select_option", { entity_id: entity, option: value }]];
    return kind === "source"
      ? [["media_player", "select_source", { entity_id: entity, source: value }]]
      : [["media_player", "select_sound_mode", { entity_id: entity, sound_mode: value }]];
  }

  const MORE_LABELS = {
    info: ["Info", "info"], subtitles: ["Subtitles", "subtitles"], subtitles_hold: ["Next subtitle", "subtitles"],
    sound_mode: ["Sound Mode", "sound_mode"], sources: ["Sources", "list"], control_center: ["Control Center", "control_center"],
    top_menu: ["Top Menu", "home"], audio_track: ["Audio Track", "audio"], osd: ["Player Controls", "play_pause"],
    context_menu: ["Context Menu", "list"], settings: ["Settings", "settings"], exit: ["Exit App", "back"],
  };
  /** Items of the "..." menu: [{id, name, icon, steps?, open?}], only those that do something on this player. */
  function moreItems(p, states) {
    if (p.more === false) return [];
    const list = Array.isArray(p.more) ? p.more : PLATFORMS[p.platform].more || [];
    const out = [];
    list.forEach((m, i) => {
      if (typeof m === "string") {
        const [name, ic] = MORE_LABELS[m] || [m.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()), null];
        if (m === "sound_mode" || m === "sources") {
          if ((m === "sound_mode" ? soundModeMenu : sourceMenu)(p, states)) out.push({ id: m, name, icon: ic, open: m });
          return;
        }
        const steps = stepsFor(p, m, states);
        if (steps.length) out.push({ id: m, name, icon: ic, steps });
        return;
      }
      const steps = m.key ? stepsFor(p, m.key, states) : stepsFor({ ...p, actions: { __more: m } }, "__more", states);
      if (steps.length) out.push({ id: "custom" + i, name: String(m.name), icon: m.icon || null, steps });
    });
    return out;
  }
  // ---------------------------------------------------------------------------
  // Shortcuts (0.2.0, Grok Bot 11 Oct 2026). What: players[].shortcuts, a list of named service calls shown as a
  // section of the More menu while that player is active. Why: one-tap add-on searches / lists on the remote,
  // set in YAML so nothing add-on specific lives in the code.
  //   - name: Search Movies           # required
  //     icon: mdi:movie-search        # optional: an mdi: icon or one of the card's icon names
  //     action: search                # search (ask for text first) | call (run now); default: search if the
  //                                   # data uses {text}, else call
  //     prompt: Search movies         # search: typing sheet title (placeholder: `placeholder`, default "Search")
  //     service: kodi.call_method     # one call ({service, data, target}) or `actions: [ ... ]` for several
  //     data: { ... "{text_url}" ... }
  //     input: true                   # run this player's input switching (triggers: [shortcut] or [any]) first
  // In any string of data/target: {text} or {{ text }} = what was typed, {text_url} or {{ text | urlencode }} =
  // URL-encoded (for plugin:// URLs). A value of exactly "$text" is replaced too, like the `text` action.
  // ---------------------------------------------------------------------------
  const TEXT_RE = /\{\{\s*text\s*(\|\s*urlencode\s*)?\}\}|\{text(_url)?\}/g;
  const usesText = (v) => typeof v === "string" ? v === "$text" || new RegExp(TEXT_RE.source).test(v)
    : Array.isArray(v) ? v.some(usesText) : v && typeof v === "object" ? Object.values(v).some(usesText) : false;
  function fillText(v, text) {
    if (v === "$text") return text;
    if (typeof v === "string") return v.replace(TEXT_RE, (m, j, u) => (j || u) ? encodeURIComponent(text) : text);
    if (Array.isArray(v)) return v.map((x) => fillText(x, text));
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fillText(x, text)]));
    return v;
  }
  function normaliseShortcuts(raw, i) {
    if (raw === false || raw == null) return [];
    if (!Array.isArray(raw)) throw new Error(`glass-remote-card: players[${i}].shortcuts must be a list`);
    return raw.map((sc, j) => {
      const where = `glass-remote-card: players[${i}].shortcuts[${j}]`;
      if (!sc || typeof sc !== "object" || !sc.name) throw new Error(`${where} needs a name`);
      // `action` is the shortcut kind (search | call); an HA-style "domain.service" there is taken as the service
      let kind = sc.action, svc = sc.service;
      if (typeof kind === "string" && kind.includes(".")) { svc = svc || kind; kind = undefined; }
      const list = sc.actions || sc.sequence || (svc ? [{ service: svc, data: sc.data, target: sc.target }] : null);
      if (!Array.isArray(list) || !list.length) throw new Error(`${where} needs a service (or a list under actions)`);
      const steps = list.map((a, k) => {
        const name = String((a && (a.service || a.action)) || "");
        if (!/^[a-z0-9_]+\.[a-z0-9_]+$/i.test(name)) throw new Error(`${where}: "${name}" isn't a domain.service${list.length > 1 ? ` (actions[${k}])` : ""}`);
        return { service: name, data: a.data || a.service_data || {}, target: a.target || {} };
      });
      const needsText = steps.some((st) => usesText(st.data) || usesText(st.target));
      if (kind === undefined) kind = needsText ? "search" : "call";
      if (kind !== "search" && kind !== "call") throw new Error(`${where}.action must be search or call`);
      if (kind === "search" && !needsText) throw new Error(`${where} is a search but its data has no {text} placeholder`);
      if (sc.input !== undefined && typeof sc.input !== "boolean") throw new Error(`${where}.input must be true or false`);
      return { name: String(sc.name), icon: sc.icon || (kind === "search" ? "search" : null), kind,
        prompt: sc.prompt ? String(sc.prompt) : null, placeholder: sc.placeholder ? String(sc.placeholder) : null,
        input: sc.input !== false, steps };
    });
  }
  /** Service-call steps for a shortcut, with the typed text put in ("" for call shortcuts). */
  function shortcutSteps(sc, text = "") {
    return sc.steps.map((a) => {
      const [domain, service] = a.service.split(".");
      return [domain, service, fillText({ ...a.data, ...a.target }, text)];
    });
  }
  const shortcutsFor = (p) => (p && Array.isArray(p.shortcuts) ? p.shortcuts : []);

  const hasChannels = (p) => !!(p.channels === undefined ? PLATFORMS[p.platform].channels : p.channels) &&
    !!(PLATFORMS[p.platform].keys.channel_up || (p.actions && p.actions.channel_up));

  // ---------------------------------------------------------------------------
  // Kodi keyboard detection: poll GUI.GetProperties(currentwindow) and read the
  // kodi_call_method_result event. 10103 = virtual keyboard, 10109 = numeric input.
  // ---------------------------------------------------------------------------
  const KODI_KB_WINDOWS = [10103, 10109];
  /** ms between polls for this player (0 = don't poll right now). */
  function kbPollInterval(p, st, config = {}) {
    if (!PLATFORMS[p.platform].kbPoll) return 0;
    const ms = p.keyboard_poll !== undefined ? p.keyboard_poll : config.keyboard_poll !== undefined ? config.keyboard_poll : 2000;
    if (!ms) return 0;
    const always = p.keyboard_poll_during_video !== undefined ? p.keyboard_poll_during_video : !!config.keyboard_poll_during_video;
    if (!always && st && st.state === "playing" && (st.attributes || {}).media_content_type !== "music") return 0;
    if (!st || st.state === "unavailable" || st.state === "off") return 0;
    return Math.max(500, ms);
  }
  /** From a kodi_call_method_result event: true/false = keyboard open/closed, null = not ours. */
  function kodiKeyboardFromEvent(data, entity) {
    if (!data || data.entity_id !== entity || !data.input || data.input.method !== "GUI.GetProperties") return null;
    const w = data.result && data.result.currentwindow;
    if (!w) return null;
    return KODI_KB_WINDOWS.includes(Number(w.id)) || /virtual keyboard|numeric input/i.test(String(w.label || ""));
  }

  function guessPlatform(p) {
    if (p.remote && /apple|atv/i.test(p.entity + p.remote)) return "apple_tv";
    if (/kodi|coreelec|libreelec|osmc/i.test(p.entity)) return "kodi";
    if (/lg|webos/i.test(p.entity)) return "webostv";
    return p.remote ? "apple_tv" : "generic";
  }

  /**
   * Which player the remote should control right now.
   * 1) a manual pick from the picker wins for `pick_timeout` minutes;
   * 2) optional `source_map` (a TV and its inputs): a mapped input -> that player; an input listed in
   *    `ignore_sources` (AVR/passthrough/HDMI you don't map) -> fall through to ranking; any other
   *    source (a TV app) -> the TV itself, if it's one of the players;
   * 3) rank the other players: playing > paused > on/idle, most recent state change wins;
   * 4) nothing active -> the TV if on, else the first player.
   */
  function choosePlayer(config, states, pick, now = Date.now()) {
    const ids = config.players.map((p) => p.entity);
    if (pick && pick.entity && ids.includes(pick.entity) && now - pick.ts < config.pick_timeout * 60000) return pick.entity;
    const sm = config.source_map;
    const tv = sm && sm.entity;
    const tvOn = !!(tv && states[tv] && !isOff(states[tv]));
    if (tvOn) {
      const src = (states[tv].attributes && states[tv].attributes.source) || "";
      const mapped = sm.sources ? sm.sources[src] : undefined;
      if (mapped && ids.includes(mapped)) return mapped;
      const ignored = !src || (sm.ignore_sources || []).includes(src);
      if (!ignored && sm.default_to_tv !== false && ids.includes(tv)) return tv;
    }
    let best = null, bestRank = 0, bestTs = -1;
    for (const id of ids) {
      if (id === tv) continue; // the TV is chosen by its source, not by ranking
      const st = states[id];
      const r = st ? RANK[st.state] || 0 : 0;
      const ts = st ? Date.parse(st.last_changed || st.last_updated || 0) || 0 : 0;
      if (r > bestRank || (r === bestRank && r > 0 && ts > bestTs)) { best = id; bestRank = r; bestTs = ts; }
    }
    if (best) return best;
    if (tvOn && ids.includes(tv)) return tv;
    return ids[0];
  }

  /** Where volume goes for this player: an entity id, "remote", or null. */
  function volumeTarget(p, states) {
    for (const id of [p.volume_entity, p.volume_fallback]) {
      if (id && states[id] && !OFF_STATES.includes(states[id].state)) return id;
    }
    if (p.volume_via_remote && p.remote) return "remote";
    if (p.volume_entity || p.volume_fallback) return p.volume_fallback || p.volume_entity;
    return p.entity;
  }

  /** Two-line now-playing text for the pill. */
  function nowPlaying(p, st) {
    const name = p.name || (st && st.attributes && st.attributes.friendly_name) || p.entity;
    if (!st) return { title: name, subtitle: "unavailable", art: null };
    const a = st.attributes || {};
    const t = a.media_series_title || a.media_title;
    const ep = a.media_series_title && a.media_title;
    const shown = t || a.app_name || a.source;
    const sub = ep || (t ? a.app_name : "") || String(st.state).replace(/_/g, " ");
    let subtitle = shown ? `${name} \u00b7 ${sub}` : sub;
    if (st.state === "paused" && sub !== "paused") subtitle += " \u00b7 paused";
    return { title: shown ? t || a.app_name || a.source : name, subtitle, art: a.entity_picture || null };
  }

  /** Steps (service calls) for a logical button on a player. */
  // In a user action, any string value "$text" becomes the typed text (for the `text` action).
  const subst = (v, text) => v === "$text" ? text : Array.isArray(v) ? v.map((x) => subst(x, text))
    : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, subst(x, text)])) : v;

  function stepsFor(p, key, states, text) {
    const user = p.actions && p.actions[key];
    if (user) return (Array.isArray(user) ? user : [user]).map((a) => {
      const [domain, service] = String(a.service || a.action || "").split(".");
      return [domain, service, subst({ ...(a.data || a.service_data || {}), ...(a.target || {}) }, text)];
    });
    const st = states[p.entity];
    if (key === "volume_up" || key === "volume_down" || key === "mute") {
      const tgt = volumeTarget(p, states);
      if (tgt === "remote") {
        if (key === "mute") return [];
        const f = PLATFORMS[p.platform].keys["remote_" + key];
        return f ? [f(p)] : [rc(p, key)];
      }
      if (key === "mute") {
        const muted = !!(states[tgt] && states[tgt].attributes && states[tgt].attributes.is_volume_muted);
        return [["media_player", "volume_mute", { entity_id: tgt, is_volume_muted: !muted }]];
      }
      return [["media_player", key, { entity_id: tgt }]];
    }
    const f = PLATFORMS[p.platform].keys[key];
    const step = f ? f(p, st) : null;
    return step ? [step] : [];
  }

  function swipeDirection(dx, dy, threshold = 28) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return null;
    return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
  }

  // ---------------------------------------------------------------------------
  // Styles
  // ---------------------------------------------------------------------------
  const GLASS = `
    background: linear-gradient(180deg, rgba(255,255,255,.10) 0%, rgba(255,255,255,.05) 40%, rgba(255,255,255,.035) 100%);
    border: 1px solid rgba(255,255,255,.08);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.22), inset 0 -1px 1px rgba(0,0,0,.4), 0 8px 24px rgba(0,0,0,.6), 0 1px 2px rgba(0,0,0,.5);
    -webkit-backdrop-filter: blur(24px) saturate(150%); backdrop-filter: blur(24px) saturate(150%);`;

  // 0.1.8 (Grok Bot, 11 Oct 2026): one frosted panel for the keyboard banner, the typing sheet, the device
  // picker and the pop-up menus, so every overlay looks the same.
  const PANEL = `
    color: #fff; background: rgba(58,58,62,.72); border: 1px solid rgba(255,255,255,.10);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.14), 0 18px 48px rgba(0,0,0,.6);
    -webkit-backdrop-filter: blur(30px) saturate(180%); backdrop-filter: blur(30px) saturate(180%);`;

  const CSS = `
    :host { display: block; color: rgba(255,255,255,.95); font-family: system-ui, var(--paper-font-body1_-_font-family, Roboto), sans-serif; --grc-fg: rgba(255,255,255,.95); --grc-dim: rgba(255,255,255,.55);
      --grc-pad: #1c1c1e; --grc-bg: #000; --grc-accent: var(--primary-color, #0a84ff); }
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    .root { color: var(--grc-fg); background: var(--grc-bg); font-family: system-ui, var(--paper-font-body1_-_font-family, Roboto), sans-serif;
      display: flex; flex-direction: column; user-select: none; -webkit-user-select: none; touch-action: manipulation; }
    .root.fullscreen { position: fixed; inset: 0; z-index: 7;
      padding: calc(max(env(safe-area-inset-top, 0px), 8px) + 6px) calc(16px + env(safe-area-inset-right, 0px))
               calc(max(env(safe-area-inset-bottom, 0px), 6px) + 18px) calc(16px + env(safe-area-inset-left, 0px)); }
    .root.card { height: var(--grc-card-height); padding: 16px; border-radius: var(--ha-card-border-radius, 24px); overflow: hidden; }
    button { font: inherit; color: inherit; border: 0; background: none; padding: 0; margin: 0; cursor: pointer; }
    .glass { ${GLASS} transition: transform .12s ease, filter .12s ease; }
    .glass:active, .glass.pressed { transform: scale(.94); filter: brightness(1.35); }
    .icon { display: inline-flex; width: var(--s, 26px); height: var(--s, 26px); }
    .icon svg { width: 100%; height: 100%; }

    .top { display: flex; align-items: center; gap: 10px; flex: 0 0 auto; height: 64px; }
    .circle { flex: 0 0 auto; width: 56px; height: 56px; border-radius: 50%; display: grid; place-items: center; --s: 26px; }
    .circle.hidden { visibility: hidden; }
    .pill { flex: 1 1 auto; min-width: 0; height: 64px; border-radius: 32px; display: flex; align-items: center; gap: 12px;
      padding: 0 16px 0 10px; text-align: left; }
    .art { flex: 0 0 auto; width: 44px; height: 44px; border-radius: 50%; overflow: hidden; display: grid; place-items: center;
      background: rgba(255,255,255,.08); color: var(--grc-fg); --mdc-icon-size: 24px; }
    .art img { width: 100%; height: 100%; object-fit: cover; }
    .lines { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .l1 { font-size: 16px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .l2 { font-size: 13px; color: var(--grc-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .pill .chev { --s: 14px; color: rgba(255,255,255,.45); }

    .pad-wrap { position: relative; margin-top: 18px; flex: 0 1 auto; height: var(--grc-pad-height); min-height: 0; }
    .root.card .pad-wrap { flex: 1 1 auto; height: auto; }
    .pad { position: absolute; inset: 0; border-radius: 32px; background: var(--grc-pad);
      border: 1px solid rgba(255,255,255,.05); box-shadow: inset 0 1px 0 rgba(255,255,255,.05); touch-action: none; overflow: hidden; }
    .pad .ripple { position: absolute; width: 80px; height: 80px; margin: -40px 0 0 -40px; border-radius: 50%;
      background: radial-gradient(circle, rgba(255,255,255,.18), rgba(255,255,255,0) 70%); pointer-events: none; opacity: 0; transition: opacity .35s; }
    .pad .ripple.on { opacity: 1; transition: none; }
    .kbd { position: absolute; top: 10px; right: 12px; padding: 8px; opacity: .7; --s: 26px; z-index: 2; }
    .vol { position: absolute; left: -9px; top: 10%; display: flex; flex-direction: column; align-items: flex-start; gap: 6px; z-index: 2; }
    .tab { width: 22px; height: 58px; border-radius: 12px; display: grid; place-items: center; --s: 13px; }
    .tab .icon { opacity: .6; }
    .badge { width: 30px; height: 30px; margin-left: 17px; border-radius: 50%; display: grid; place-items: center; --s: 15px; -webkit-touch-callout: none; user-select: none; }
    .badge.inert { pointer-events: none; }
    .mic { position: absolute; right: 10px; top: calc(10% + 54px); width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center; --s: 19px; z-index: 2; }
    /* bottom row inside the pad, always shown: sources | -10 | (...) | +10 | CH.
       The row only catches taps on its own buttons, so the rest of the pad stays a touchpad.
       0.1.4/0.1.5 (Grok Bot, 11 Oct 2026): proportions tuned on a phone (five equal columns, icons ~27px
       centred ~35px above the pad's bottom edge). CH: collapsed = "CH" in the row with thin caps hugging it;
       open = the caps slide out and turn into chevrons, CH rises: up chevron, CH, down chevron (~33px pitch). */
    .inner { position: absolute; left: 6px; right: 6px; bottom: 16px; display: grid; grid-template-columns: repeat(5, 1fr);
      justify-items: center; align-items: end; z-index: 2; pointer-events: none; }
    .inner > button { width: 44px; height: 44px; padding: 0; display: grid; place-items: center; --s: 28px; pointer-events: auto; } /* 0.1.5: fixed 44px boxes so every slot shares one centre line (Grok Bot, 11 Oct 2026) */
    .inner .src, .inner .more { --s: 27px; opacity: .92; }
    .inner .gone { visibility: hidden; pointer-events: none; }
    .ch { position: relative; width: 44px; height: 44px; pointer-events: none; --ch-ease: cubic-bezier(.3,.9,.3,1.06); }
    .ch > button { position: absolute; left: 50%; top: 50%; padding: 0; display: grid; place-items: center;
      transition: transform .22s var(--ch-ease); }
    .ch .chl { width: 44px; height: 36px; margin: -18px 0 0 -22px; z-index: 1; pointer-events: auto;
      font-size: 15px; font-weight: 600; letter-spacing: .3px; line-height: 1; }
    .ch .chl:active { opacity: .6; }
    .ch .chb { width: 44px; height: 30px; margin: -15px 0 0 -22px; pointer-events: none; }
    .ch .chb svg { width: 22px; height: 12px; display: block; overflow: visible; }
    .ch .chb path { transition: opacity .2s ease, transform .22s var(--ch-ease); transform-origin: 12px 9px; }
    .ch .chb .chev { opacity: 0; transform: scale(.85, .5); }
    .ch .chb.up { transform: translateY(-14px); }
    .ch .chb.dn { transform: translateY(14px); }
    .ch.open .chl { transform: translateY(-40px); }
    .ch.open .chb { pointer-events: auto; }
    .ch.open .chb.up { transform: translateY(-73px); }
    .ch.open .chb.dn { transform: translateY(-7px); }
    .ch.open .chb .cap { opacity: 0; transform: scale(.85, 1.6); }
    .ch.open .chb .chev { opacity: 1; transform: none; }
    .ch.open .chb:active { opacity: .6; }

    /* glass pop-up menu (sources, sound mode, more) */
    .menu-bg { position: fixed; inset: 0; z-index: 30; display: none; }
    .menu-bg.show { display: block; }
    .menu { position: fixed; width: min(270px, calc(100vw - 20px)); max-height: 56vh; overflow-y: auto; overscroll-behavior: contain;
      border-radius: 22px; padding: 6px 0; ${PANEL}
      transform: scale(.85); opacity: 0; transition: transform .22s cubic-bezier(.2,.9,.3,1.15), opacity .15s; }
    .menu-bg.show .menu.in { transform: none; opacity: 1; }
    .menu .mt { padding: 8px 16px 6px; font-size: 13px; font-weight: 600; color: rgba(235,235,245,.6); }
    .menu .mi { width: 100%; display: flex; align-items: center; gap: 10px; padding: 11px 16px; font-size: 16px; text-align: left; --s: 20px;
      border-top: .5px solid rgba(255,255,255,.08); }
    .menu .mt + .mi, .menu .mi:first-child { border-top: none; }
    .menu .mi:active { background: rgba(255,255,255,.10); }
    .menu .mi .ck { width: 16px; flex: 0 0 16px; font-weight: 600; }
    .menu .mi .nm { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .menu .mi .icon { opacity: .9; }
    /* 0.2.0 (Grok Bot, 11 Oct 2026): shortcuts are the More menu's first section; a thicker gap separates
       them from the player's own items. mdi: icons on shortcuts render with HA's ha-icon at the same size. */
    .menu .mi.grp { border-top: 6px solid rgba(0,0,0,.24); }
    .menu .mi .icon ha-icon { --mdc-icon-size: 20px; width: 20px; height: 20px; display: block; }

    .bottom { flex: 0 0 auto; margin-top: auto; padding-top: 28px; display: flex; align-items: center; justify-content: space-between; padding-left: 4px; padding-right: 4px; }
    .bottom .side { width: 82px; height: 82px; border-radius: 50%; display: grid; place-items: center; --s: 34px; }
    .bottom .big { width: 106px; height: 106px; border-radius: 50%; display: grid; place-items: center; --s: 44px; }

    /* 0.1.9 tablet / wide layout (Grok Bot, 11 Oct 2026): when the screen is wider than
       3:5, keep phone proportions in a centred column (width = column_ratio x height, at least 320px, capped by
       max_width), let the pad fill the height, and cluster the bottom three buttons under it. Phones (narrower
       than 3:5) never match, so they are unchanged. The volume tabs hang off the pad, so they follow the column. */
    @media (min-aspect-ratio: 3/5) {
      .root.fullscreen {
        --grc-col: min(calc(100vw - 32px), max(320px, calc(100dvh * var(--grc-col-ratio, .52))), var(--grc-max-w, 100vw));
        padding-left: max(calc(16px + env(safe-area-inset-left, 0px)), calc((100vw - var(--grc-col)) / 2));
        padding-right: max(calc(16px + env(safe-area-inset-right, 0px)), calc((100vw - var(--grc-col)) / 2)); }
      .root.fullscreen .pad-wrap { flex: 1 1 auto; height: auto; min-height: 240px; }
      .root.fullscreen .bottom { margin-top: 0; justify-content: center; gap: clamp(24px, 4.5vw, 40px); }
      .root.fullscreen .wants { left: calc((100vw - var(--grc-col)) / 2); right: calc((100vw - var(--grc-col)) / 2); }
    }

    /* glass hint, 0.1.8 (Grok Bot, 11 Oct 2026): one small toast in the card's own glass, replaces HA's grey toasts for text errors */
    .toast { position: fixed; z-index: 40; left: 50%; top: 42%; width: max-content; max-width: calc(100vw - 72px);
      padding: 12px 18px; border-radius: 20px; font-size: 15px; font-weight: 500; line-height: 1.3; text-align: center; pointer-events: none; ${PANEL}
      opacity: 0; transform: translate(-50%, -50%) scale(.92); transition: opacity .2s ease, transform .25s cubic-bezier(.2,.9,.3,1.15); }
    .toast.show { opacity: 1; transform: translate(-50%, -50%); }
    .root.card ~ .toast { position: absolute; }

    /* "wants text": a notification-style banner that slides down over the top row */
    .wants { position: absolute; z-index: 6; left: calc(10px + env(safe-area-inset-left, 0px)); right: calc(10px + env(safe-area-inset-right, 0px));
      top: calc(max(env(safe-area-inset-top, 0px), 8px) + 2px); display: flex; align-items: center; gap: 12px; text-align: left;
      padding: 12px 16px 12px 12px; border-radius: 24px; ${PANEL}
      transform: translateY(calc(-100% - 80px)); opacity: 0; visibility: hidden;
      transition: transform .45s cubic-bezier(.2,.9,.25,1.12), opacity .25s ease, visibility 0s linear .45s; }
    .wants.show { transform: none; opacity: 1; visibility: visible; transition: transform .45s cubic-bezier(.2,.9,.25,1.12), opacity .2s ease; }
    .wants:active { filter: brightness(1.15); }
    .root.card .wants { top: 8px; left: 8px; right: 8px; }
    .root.card { position: relative; }
    .wants .appicon { flex: 0 0 auto; width: 44px; height: 44px; border-radius: 11px; background: #1c1c1e; display: grid; place-items: center;
      box-shadow: inset 0 0 0 .5px rgba(255,255,255,.18); }
    .wants .appicon svg { width: 34px; height: 34px; }
    .wants .txt { min-width: 0; display: flex; flex-direction: column; font-size: 15px; line-height: 1.25; }
    .wants .t1, .wants .t2 { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .wants .t3 { font-weight: 400; color: rgba(255,255,255,.92); }

    .sheet-bg { position: fixed; inset: 0; z-index: 20; background: rgba(0,0,0,.55); display: none; align-items: flex-end; justify-content: center;
      -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); }
    .sheet-bg.show { display: flex; }
    .sheet { width: min(520px, 100%); margin: 0 8px calc(max(env(safe-area-inset-bottom, 0px), 8px) + 8px); border-radius: 28px; padding: 12px; ${PANEL} }
    /* picker header, 0.1.8: same layout as the typing sheet's header (title + thin close in a glass circle) */
    .sheet h3 { margin: 0; padding: 2px 0 10px 6px; font-size: 15px; font-weight: 600; color: #fff; display: flex; justify-content: space-between; align-items: center; }
    /* device picker, 0.1.10 (Grok Bot, 11 Oct 2026): dropdown anchored under the pill, grows downward.
       Transparent full-screen catcher (tap anywhere outside the list, pill included, closes it); the shade starts
       below the top row so the pill stays visible; rows are plain with hairline dividers and a left tick.
       0.1.13 (Grok Bot, 11 Oct 2026): 0.1.11 look restored (0.1.12's glass panel dropped at Evan's request).
       What changed vs 0.1.11: the shade is only as tall as the list (--dd-shade-h, measured on open) and fades out
       over its last 28px instead of running to the bottom of the page; the close button is gone.
       Why: the open dropdown covered the whole page; it should stop at its last row without looking cut off. */
    .dd-bg { position: fixed; inset: 0; z-index: 20; visibility: hidden; pointer-events: none; transition: visibility 0s linear .28s; }
    .dd-bg.show { visibility: visible; pointer-events: auto; transition: none; }
    .dd-shade { position: fixed; left: 0; right: 0; top: var(--dd-top, 80px); height: var(--dd-shade-h, 340px);
      max-height: calc(100dvh - var(--dd-top, 80px)); background: rgba(0,0,0,.86);
      -webkit-mask-image: linear-gradient(to bottom, #000 calc(100% - 28px), transparent); mask-image: linear-gradient(to bottom, #000 calc(100% - 28px), transparent);
      -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px); opacity: 0; transition: opacity .22s ease; pointer-events: none; }
    .dd-bg.show .dd-shade { opacity: 1; }
    .dd { position: fixed; top: var(--dd-top, 80px); left: var(--dd-left, 16px); width: var(--dd-width, calc(100vw - 32px));
      max-height: calc(100dvh - var(--dd-top, 80px) - 16px); overflow-y: auto; overscroll-behavior: contain; padding: 2px 0 6px;
      transform-origin: 50% 0; transform: translateY(-14px) scaleY(.7); opacity: 0;
      transition: transform .28s cubic-bezier(.2,.9,.3,1.08), opacity .18s ease; }
    .dd-bg.show .dd { transform: none; opacity: 1; }
    .opt { width: 100%; display: flex; align-items: center; gap: 12px; padding: 0 44px 0 6px; min-height: 48px; text-align: left; font-size: 15px;
      border-top: .5px solid rgba(255,255,255,.14); transition: background .15s; }
    .opt:first-child { border-top: none; }
    .opt:active { background: rgba(255,255,255,.07); }
    .opt .tick { flex: 0 0 16px; width: 16px; text-align: center; color: #fff; font-size: 14px; font-weight: 600; }
    .opt .art { flex: 0 0 auto; width: 22px; height: 22px; border-radius: 0; background: none; --s: 20px; --mdc-icon-size: 20px; color: rgba(255,255,255,.92); }
    .opt .lines { flex: 1 1 auto; min-width: 0; }
    .opt .l1 { font-size: 15px; font-weight: 500; }
    .opt .l2 { display: none; }
    .pill .chev { transition: transform .25s cubic-bezier(.2,.9,.3,1.1); }
    .pill.open .chev { transform: rotate(90deg); }
    /* 0.1.11 (Grok Bot, 11 Oct 2026): the whole pill is one tap target. Children (artwork img / ha-icon, title,
       subtitle, chevron svg) never take pointer events, so every tap anywhere on the pill hits the button itself
       (no image drag or long-press callout, no inner element eating the tap). While the picker is open the
       top row sits above the picker's backdrop, so tapping the pill toggles it closed. */
    .pill > *, .pill * { pointer-events: none; }
    .pill img { -webkit-user-drag: none; user-drag: none; -webkit-touch-callout: none; }
    .top { position: relative; z-index: 1; }
    .top.dd-open { z-index: 21; }
    .top.dd-open, .top.dd-open .circle { pointer-events: none; } /* mute / power / gaps fall through to the backdrop (closes) while open */
    .top.dd-open .pill { pointer-events: auto; }
    /* typing sheet, 0.1.7 (Grok Bot, 11 Oct 2026): same frosted glass as the keyboard banner and menus,
       banner-style header, thin close icon, glass pill buttons, no accent-coloured text links */
    .kb-head { display: flex; align-items: center; gap: 12px; padding: 0 0 12px; }
    .kb-head .appicon { flex: 0 0 auto; width: 40px; height: 40px; border-radius: 10px; background: #1c1c1e; display: grid; place-items: center;
      box-shadow: inset 0 0 0 .5px rgba(255,255,255,.18); }
    .kb-head .appicon svg { width: 30px; height: 30px; }
    .kb-txt { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; font-size: 15px; line-height: 1.25; }
    .kb-title { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .kb-sub { color: rgba(235,235,245,.6); font-size: 13px; }
    .kb-x { flex: 0 0 auto; width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; --s: 15px; }
    .kb-x .icon { opacity: .8; }
    .kb textarea { display: block; width: 100%; min-height: 84px; resize: none; border-radius: 20px; padding: 13px 16px; font: inherit; font-size: 19px; line-height: 1.3;
      color: #fff; background: rgba(0,0,0,.28); border: 1px solid rgba(255,255,255,.08); box-shadow: inset 0 1px 2px rgba(0,0,0,.35); outline: none;
      caret-color: #fff; user-select: text; -webkit-user-select: text; }
    .kb textarea::placeholder { color: rgba(235,235,245,.38); }
    .kb .row { display: flex; gap: 10px; margin-top: 12px; }
    .kb .row button { flex: 1 1 0; height: 46px; border-radius: 23px; font-size: 16px; font-weight: 600; color: #fff; }
    .kb .row .send { background: rgba(255,255,255,.88); color: #000; border-color: rgba(255,255,255,.5); }
  `;

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const icon = (name) => `<span class="icon">${ICONS[name] || ""}</span>`;

  // ---------------------------------------------------------------------------
  // The card
  // ---------------------------------------------------------------------------
  class GlassRemoteCard extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this._timers = new Set();
      this._kbText = "";
    }

    static getStubConfig(hass) {
      const mps = Object.keys((hass && hass.states) || {}).filter((e) => e.startsWith("media_player.")).slice(0, 2);
      return { layout: "card", players: mps.length ? mps.map((entity) => ({ entity, platform: "generic" })) : [{ entity: "media_player.living_room", platform: "generic" }] };
    }

    setConfig(config) {
      this._config = normaliseConfig(config);
      this._built = false;
      if (this.isConnected) this._build();
    }

    getCardSize() { return 12; }
    getGridOptions() { return { columns: "full", rows: "auto", min_columns: 6 }; }

    set hass(hass) {
      this._hass = hass;
      if (!this._built) this._build();
      this._takeUrlPick();
      this._update();
    }
    get hass() { return this._hass; }

    connectedCallback() {
      if (this._config && !this._built) this._build();
      if (!this._onVis) { this._onVis = () => this._syncKbPoll(); }
      document.addEventListener("visibilitychange", this._onVis);
      if (!this._onStrayTap) this._onStrayTap = (e) => this._routeStrayTap(e);
      window.addEventListener("click", this._onStrayTap, true);
      if (this._hass) this._update();
    }
    disconnectedCallback() {
      document.removeEventListener("visibilitychange", this._onVis);
      window.removeEventListener("click", this._onStrayTap, true);
      this._stopKbPoll();
      for (const t of this._timers) { clearTimeout(t); clearInterval(t); } this._timers.clear();
    }

    // ---- Kodi keyboard detection ------------------------------------------------
    /** Start, retarget or stop the poll to match the current state. Safe to call often. */
    _syncKbPoll() {
      if (this._kbSyncing) return; // _stopKbPoll -> _update -> here
      this._kbSyncing = true;
      try { this._syncKbPollInner(); } finally { this._kbSyncing = false; }
    }
    _syncKbPollInner() {
      const p = this._hass && this._config && this.activePlayer;
      const visible = this.isConnected && (typeof document === "undefined" || document.visibilityState !== "hidden");
      const conn = this._hass && this._hass.connection;
      const ms = p && visible && conn && conn.subscribeEvents ? kbPollInterval(p, this._states[p.entity], this._config) : 0;
      const key = ms ? p.entity + "|" + ms : null;
      if (key === this._kbKey) return;
      this._stopKbPoll();
      if (!key) return;
      this._kbKey = key; this._kbEntity = p.entity;
      const gen = this._kbGen = (this._kbGen || 0) + 1;
      conn.subscribeEvents((ev) => {
        const open = kodiKeyboardFromEvent(ev && ev.data, this._kbEntity);
        if (open === null || open === this._kbOpen) return;
        this._kbOpen = open; this._update();
      }, "kodi_call_method_result").then((unsub) => {
        if (gen !== this._kbGen) { try { unsub(); } catch (_) { /* gone */ } } else this._kbUnsub = unsub;
      }, (e) => console.warn(TAG, "kodi keyboard events", e));
      const tick = () => {
        if (this._kbTimer) { this._timers.delete(this._kbTimer); this._kbTimer = null; } // fired: forget its handle
        if (gen !== this._kbGen) return;
        try {
          const r = this._hass.callService("kodi", "call_method", { entity_id: this._kbEntity, method: "GUI.GetProperties", properties: ["currentwindow"] });
          if (r && r.catch) r.catch(() => {});
        } catch (_) { /* ignore */ }
        this._kbTimer = setTimeout(tick, ms); this._timers.add(this._kbTimer);
      };
      tick();
    }
    _stopKbPoll() {
      this._kbGen = (this._kbGen || 0) + 1; this._kbKey = null;
      if (this._kbTimer) { clearTimeout(this._kbTimer); this._timers.delete(this._kbTimer); this._kbTimer = null; }
      if (this._kbUnsub) { try { this._kbUnsub(); } catch (_) { /* gone */ } this._kbUnsub = null; }
      if (this._kbOpen) { this._kbOpen = false; if (this._built && this._hass) this._update(); }
    }

    // ---- state -------------------------------------------------------------
    get _states() { return (this._hass && this._hass.states) || {}; }
    _pickKey() { return PICK_KEY + (this._config.id || this._config.players.map((p) => p.entity).join(",")); }
    _readPick() { try { return JSON.parse(localStorage.getItem(this._pickKey()) || "null"); } catch (e) { return null; } }
    _writePick(entity) {
      try { if (entity) localStorage.setItem(this._pickKey(), JSON.stringify({ entity, ts: Date.now() })); else localStorage.removeItem(this._pickKey()); } catch (e) { /* private mode */ }
    }
    /** `?player=media_player.x` in the page URL (e.g. from the Sidebar Mini Player's remote button)
     *  picks that player, as if chosen in the picker. Read once per URL. */
    _takeUrlPick() {
      let href; try { href = window.location.href; } catch (e) { return; }
      if (href === this._seenHref) return;
      this._seenHref = href;
      const param = this._config.url_param || "player";
      const want = new URL(href).searchParams.get(param);
      if (want && this._config.players.some((p) => p.entity === want)) { this._writePick(want); this._urlPicked = want; }
    }
    _manualPick() { const k = this._readPick(); return !!(k && k.entity && Date.now() - k.ts < this._config.pick_timeout * 60000); }
    get activeEntity() { return choosePlayer(this._config, this._states, this._readPick()); }
    get activePlayer() { const id = this.activeEntity; return this._config.players.find((p) => p.entity === id); }

    // ---- actions -----------------------------------------------------------
    _haptic(kind = "light") {
      if (!this._config.haptics) return;
      window.dispatchEvent(new CustomEvent("haptic", { detail: kind })); // picked up by the HA companion apps
    }
    /** Run steps in order. Waits (["wait", ms]) and input switches are awaited so the key lands
     *  after the receiver has changed input; plain key presses don't wait on each other. */
    _call(steps, opts = {}) {
      if (!this._hass || !steps || !steps.length) return Promise.resolve();
      // opts.quiet (0.1.8): ask HA not to show its own error toast (5th callService arg, notifyOnError) and hand errors to opts.onError
      const callSvc = (domain, service, data) => opts.quiet ? this._hass.callService(domain, service, data, undefined, false) : this._hass.callService(domain, service, data);
      const fail = (domain, service) => (e) => { console.warn(TAG, domain + "." + service, e); if (opts.onError) opts.onError(e); };
      const hasWait = steps.some((s) => s[0] === "wait");
      const run = async () => {
        for (const [domain, service, data] of steps) {
          if (domain === "wait") { await new Promise((r) => { const t = setTimeout(() => { this._timers.delete(t); r(); }, service); this._timers.add(t); }); continue; }
          if (!domain || !service) continue;
          try {
            const r = callSvc(domain, service, data);
            if (r && r.catch) { if (hasWait) await r.catch(fail(domain, service)); else r.catch(fail(domain, service)); }
          } catch (e) { fail(domain, service)(e); }
        }
      };
      return run();
    }
    press(key) {
      const p = this.activePlayer; if (!p) return Promise.resolve();
      this._haptic(key.endsWith("_hold") ? "medium" : "light");
      const keySteps = stepsFor(p, key, this._states);
      if (!keySteps.length) return Promise.resolve();
      const first = this._lastTarget !== p.entity || !this._pressedSinceTarget;
      this._lastTarget = p.entity; this._pressedSinceTarget = true;
      // while a switch is in flight, don't queue another one
      const sw = this._switching ? [] : inputSteps(p, key, this._states, first);
      if (!sw.length) return this._call(keySteps);
      this._switching = true;
      return this._call([...sw, ...keySteps]).finally(() => { this._switching = false; });
    }
    sendText(text, done) {
      const p = this.activePlayer; if (!p) return;
      const steps = (p.actions && p.actions.text) ? stepsFor(p, "text", this._states, text) : PLATFORMS[p.platform].text(p, text, done);
      const sw = done || PLATFORMS[p.platform].textLive ? inputSteps(p, "text", this._states, false) : [];
      // 0.1.8: no HA toast per keystroke; one glass hint, and close the sheet if the player says nothing is focused
      return this._call([...sw, ...steps], { quiet: true, onError: (e) => this._textError(p, e) });
    }
    /** 0.2.0 (Grok Bot, 11 Oct 2026): run a shortcut of player p. Search shortcuts ask for text first (typing
     *  sheet in search mode); call shortcuts run now. Input switching runs first unless the shortcut says input: false. */
    runShortcut(p, sc, text) {
      if (!p || !sc) return Promise.resolve();
      if (sc.kind === "search" && text === undefined) { this._openSearch(p, sc); return Promise.resolve(); }
      const sw = sc.input && !this._switching ? inputSteps(p, "shortcut", this._states, false) : [];
      const steps = [...sw, ...shortcutSteps(sc, text || "")];
      if (!sw.length) return this._call(steps);
      this._switching = true;
      return this._call(steps).finally(() => { this._switching = false; });
    }
    /** The typing sheet as a search box for shortcut sc: its prompt as the title, nothing sent while typing. */
    _openSearch(p, sc) {
      const r = this.shadowRoot;
      this._kbSearch = { entity: p.entity, sc }; this._kbSheetFor = null;
      this._kbLabels(sc.prompt || sc.name, this._friendly(p), sc.placeholder || "Search", "Search", "search");
      const ta = r.querySelector(".kb textarea"); ta.value = ""; this._kbText = "";
      r.querySelector(".kb").classList.add("show");
      ta.focus(); // inside the menu tap, so mobile browsers raise the keyboard
    }
    _kbLabels(title, sub, placeholder, send, hint) {
      const r = this.shadowRoot, ta = r.querySelector(".kb textarea");
      r.querySelector(".kb-title").textContent = title; r.querySelector(".kb-sub").textContent = sub;
      ta.placeholder = placeholder; ta.setAttribute("enterkeyhint", hint); ta.setAttribute("aria-label", send === "Search" ? "Search for" : "Text to send");
      r.querySelector('[data-act="kb-send"]').textContent = send;
    }
    _textError(p, e) {
      const msg = String((e && (e.message || e.error || e.code)) || "");
      if (NOT_FOCUSED.test(msg)) { this._closeKb(); this._toast(`No text field selected on ${this._friendly(p)}`); }
      else this._toast(`Couldn't send text to ${this._friendly(p)}`);
    }
    /** Keyboard focus for the active player (true/false), or null when it can't be detected. */
    _focus(p) {
      return kbFocus(p, this._states, { polling: !!this._kbKey && this._kbEntity === (p && p.entity), open: this._kbOpen && this._kbEntity === (p && p.entity) });
    }
    _closeKb() { const kb = this.shadowRoot && this.shadowRoot.querySelector(".kb"); if (kb) kb.classList.remove("show"); this._kbSheetFor = null; this._kbSearch = null; }
    /** A small glass hint; only one at a time, hides itself after `ms`. */
    _toast(text, ms = 2000) {
      const t = this.shadowRoot && this.shadowRoot.querySelector(".toast"); if (!t) return;
      t.textContent = text; t.classList.add("show");
      clearTimeout(this._toastT); this._timers.delete(this._toastT);
      this._toastT = setTimeout(() => { this._timers.delete(this._toastT); this._toastT = null; t.classList.remove("show"); }, ms);
      this._timers.add(this._toastT);
    }

    // ---- build -------------------------------------------------------------
    _build() {
      if (!this._config) return;
      const c = this._config;
      const root = this.shadowRoot;
      root.innerHTML = `<style>${CSS}</style>
        <div class="root ${c.layout}" style="--grc-pad-height:${esc(c.pad_height)};--grc-card-height:${esc(c.card_height)};--grc-col-ratio:${esc(c.column_ratio)};--grc-max-w:${esc(c.max_width)}">
          <button class="wants" data-act="keyboard" aria-live="polite">
            <span class="appicon">${REMOTE_GLYPH}</span>
            <span class="txt"><span class="t1"></span><span class="t2">Keyboard Input</span><span class="t3"></span></span>
          </button>
          <div class="top">
            <button class="circle glass" data-key="mute" aria-label="Mute">${icon("mute")}</button>
            <button type="button" class="pill glass" data-act="picker" aria-label="Choose device" aria-haspopup="listbox" aria-expanded="false" aria-controls="grc-picker">
              <span class="art"></span>
              <span class="lines"><span class="l1"></span><span class="l2"></span></span>
              <span class="icon chev">${ICONS.chevron}</span>
            </button>
            <button class="circle glass" data-key="power" aria-label="Power">${icon("power")}</button>
          </div>
          <div class="pad-wrap">
            <div class="pad" aria-label="Touchpad"><div class="ripple"></div></div>
            <button class="kbd" data-act="keyboard" aria-label="Keyboard">${icon("keyboard")}</button>
            <div class="vol">
              <button class="tab glass" data-key="volume_up" data-repeat aria-label="Volume up">${icon("plus")}</button>
              <button class="badge glass" aria-label="Sound mode (press and hold)">${icon("speaker")}</button>
              <button class="tab glass" data-key="volume_down" data-repeat aria-label="Volume down">${icon("minus")}</button>
            </div>
            <button class="mic glass" data-act="keyboard" aria-label="Dictate">${icon("mic")}</button>
            <div class="inner">
              <button class="src" data-act="sources" aria-label="Sources">${icon("list")}</button>
              <button data-key="skip_back" aria-label="Back 10 seconds"><span class="icon ib"></span></button>
              <button class="more" data-act="more" aria-label="More">${icon("more")}</button>
              <button data-key="skip_fwd" aria-label="Forward 10 seconds"><span class="icon if"></span></button>
              <div class="ch"><button class="chb up" data-key="channel_up" aria-label="Channel up" tabindex="-1">${CH_UP}</button><button class="chl" data-act="ch" aria-expanded="false" aria-label="Channels">CH</button><button class="chb dn" data-key="channel_down" aria-label="Channel down" tabindex="-1">${CH_DOWN}</button></div>
            </div>
          </div>
          <div class="bottom">
            <button class="side glass" data-key="play_pause" aria-label="Play or pause">${icon("play_pause")}</button>
            <button class="big glass" data-key="back" aria-label="Back">${icon("back")}</button>
            <button class="side glass" data-key="home" aria-label="Home">${icon("home")}</button>
          </div>
          <!-- 0.1.11 (Grok Bot, 11 Oct 2026): picker inside the card's layer so the raised top row can sit above its backdrop -->
          <!-- 0.1.13 (Grok Bot, 11 Oct 2026): 0.1.11 shade + plain rows; the shade stops at the last row; no close button -->
          <div class="dd-bg picker"><div class="dd-shade"></div><div class="dd" id="grc-picker" role="listbox" aria-label="Choose device"><div class="opts"></div></div></div>
        </div>
        <div class="menu-bg"><div class="menu" role="menu"></div></div>
        <div class="toast" role="status" aria-live="polite"></div>
        <div class="sheet-bg kb"><div class="sheet">
          <div class="kb-head"><span class="appicon">${REMOTE_GLYPH}</span>
            <span class="kb-txt"><span class="kb-title">Type</span><span class="kb-sub">Keyboard Input</span></span>
            <button class="kb-x glass" data-act="close" aria-label="Close">${icon("close")}</button></div>
          <textarea rows="2" placeholder="Type or dictate" aria-label="Text to send" autocapitalize="off" autocomplete="off" enterkeyhint="send"></textarea>
          <div class="row"><button class="glass" data-act="kb-clear">Clear</button><button class="glass send" data-act="kb-send">Send</button></div></div></div>`;
      this._wire();
      this._built = true;
    }

    /** 0.1.11 (Grok Bot, 11 Oct 2026): full-screen layout only. A tap that lands on some other page layer
     *  stacked over the pill's area (the card's layer sits inside the dashboard view, so a header or overlay
     *  above it can take the hit) is routed to the pill. Taps inside the card, dialogs and controls are left alone. */
    _routeStrayTap(e) {
      if (!this._built || !this._config || this._config.layout !== "fullscreen" || !this.isConnected) return;
      const path = e.composedPath ? e.composedPath() : [];
      if (path.includes(this)) return; // the card handles its own taps
      const busy = path.some((n) => n && n.nodeType === 1 && (/^(DIALOG|HA-DIALOG|HA-MORE-INFO-DIALOG|HA-MD-DIALOG|INPUT|TEXTAREA|SELECT|A)$/.test(n.tagName) ||
        (n.getAttribute && /^(dialog|alertdialog)$/.test(n.getAttribute("role") || ""))));
      if (busy) return;
      const pill = this.shadowRoot.querySelector(".pill");
      const b = pill && pill.getBoundingClientRect ? pill.getBoundingClientRect() : null;
      if (!b || !b.width || !b.height) return;
      if (e.clientX < b.left || e.clientX > b.right || e.clientY < b.top || e.clientY > b.bottom) return;
      e.preventDefault(); e.stopPropagation();
      this._act("picker");
    }

    _wire() {
      const r = this.shadowRoot;
      // 0.1.11: Escape closes the picker and gives focus back to the pill
      r.querySelector(".root").addEventListener("keydown", (e) => {
        if (e.key === "Escape" && r.querySelector(".picker").classList.contains("show")) { e.preventDefault(); this._closeSheets(); r.querySelector(".pill").focus(); }
      });
      // Buttons with a key: tap; data-repeat = hold to repeat; long press = <key>_hold if the platform has it.
      r.querySelectorAll("[data-key]").forEach((b) => this._wireButton(b, b.dataset.key, b.hasAttribute("data-repeat")));
      r.querySelectorAll("[data-act]").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); this._act(b.dataset.act); }));
      r.querySelectorAll(".sheet-bg, .dd-bg").forEach((bg) => bg.addEventListener("click", (e) => { if (e.target === bg) this._closeSheets(); }));
      const ta = r.querySelector(".kb textarea");
      ta.addEventListener("input", () => {
        this._kbText = ta.value;
        if (this._kbSearch) return; // 0.2.0: a shortcut search sends nothing until Search
        const p = this.activePlayer;
        if (p && PLATFORMS[p.platform].textLive) this._debounce("kb", () => this.sendText(this._kbText, false), 250);
      });
      ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); this._act("kb-send"); } });
      this._wirePad(r.querySelector(".pad"));
      // CH chevrons: each use restarts the fold-back timer (0.1.4, Grok Bot 11 Oct 2026)
      r.querySelectorAll(".ch .chb").forEach((b) => b.addEventListener("pointerdown", () => { if (this._chOpen) this._setChOpen(true); }));
      // speaker badge: press and hold = sound mode menu (the +/- tabs keep hold-to-repeat)
      const badge = r.querySelector(".badge");
      let bt = null;
      const bclear = () => { clearTimeout(bt); this._timers.delete(bt); bt = null; badge.classList.remove("pressed"); };
      badge.addEventListener("pointerdown", (e) => {
        if (e.button > 0) return;
        badge.classList.add("pressed");
        bt = setTimeout(() => { bclear(); this._haptic("medium"); this._openMenu("sound_mode", badge); }, 500);
        this._timers.add(bt);
      });
      ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => badge.addEventListener(ev, bclear));
      badge.addEventListener("contextmenu", (e) => e.preventDefault());
      badge.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this._openMenu("sound_mode", badge); } });
      const mbg = r.querySelector(".menu-bg");
      mbg.addEventListener("click", (e) => { if (e.target === mbg) this._closeMenu(); });
    }

    // ---- glass pop-up menus -------------------------------------------------
    _menuModel(kind) {
      const p = this.activePlayer; if (!p) return null;
      const st = this._states;
      if (kind === "sources" || kind === "sound_mode") {
        const m = kind === "sources" ? sourceMenu(p, st) : soundModeMenu(p, st);
        if (!m) return null;
        const cfg = kind === "sources" ? p.sources : p.sound_mode;
        return { title: kind === "sources" ? "Sources" : "Sound Mode", items: m.options.map((o) => ({
          name: o.name, sel: o.value === m.current,
          run: () => this._call(optionSteps(cfg, m.entity, kind === "sources" ? "source" : "sound_mode", o.value)),
        })) };
      }
      if (kind === "more") {
        // 0.2.0 (Grok Bot, 11 Oct 2026): this player's shortcuts first, then its own More items
        const sc = shortcutsFor(p).map((s) => ({ name: s.name, icon: s.icon, shortcut: true, run: () => this.runShortcut(p, s) }));
        const items = moreItems(p, st).map((it, i) => ({
          name: it.name, icon: it.icon, grp: i === 0 && sc.length > 0,
          run: it.open ? () => this._openMenu(it.open, this.shadowRoot.querySelector(".more")) : () => this._call(it.steps),
        }));
        if (!sc.length && !items.length) return null;
        return { title: null, items: [...sc, ...items] };
      }
      return null;
    }
    _openMenu(kind, anchor) {
      const model = this._menuModel(kind); if (!model) return;
      this._menu = model; this._menuKind = kind;
      const r = this.shadowRoot, bg = r.querySelector(".menu-bg"), menu = r.querySelector(".menu");
      const hasTick = model.items.some((i) => i.sel !== undefined);
      menu.innerHTML = (model.title ? `<div class="mt">${esc(model.title)}</div>` : "") + model.items.map((it, i) =>
        `<button class="mi${it.grp ? " grp" : ""}${it.shortcut ? " sc" : ""}" role="menuitem" data-i="${i}">${hasTick ? `<span class="ck">${it.sel ? "\u2713" : ""}</span>` : ""}<span class="nm">${esc(it.name)}</span>${this._menuIcon(it.icon)}</button>`).join("");
      menu.querySelectorAll(".mi").forEach((b) => b.addEventListener("click", (e) => {
        e.stopPropagation();
        const it = this._menu && this._menu.items[+b.dataset.i]; if (!it) return;
        this._haptic(); this._closeMenu(); it.run();
      }));
      menu.classList.remove("in");
      bg.classList.add("show");
      // place it next to the button: above it in the lower half of the screen, below it otherwise
      const vw = window.innerWidth || 390, vh = window.innerHeight || 800;
      const a = anchor ? anchor.getBoundingClientRect() : { left: vw / 2, right: vw / 2, top: vh / 2, bottom: vh / 2, width: 0 };
      const mw = Math.min(270, vw - 20);
      const left = Math.max(10, Math.min(vw - mw - 10, a.left + a.width / 2 - mw / 2));
      menu.style.left = left + "px"; menu.style.top = ""; menu.style.bottom = "";
      if (anchor && anchor.classList.contains("badge")) {
        // beside the speaker badge, clear of the volume tabs
        const mh = menu.offsetHeight || 200;
        menu.style.left = Math.min(vw - mw - 10, a.right + 10) + "px";
        menu.style.top = Math.max(10, Math.min(vh - mh - 10, a.top + a.height / 2 - mh / 2)) + "px";
        menu.style.transformOrigin = "0 50%";
      } else if (a.top > vh / 2) { menu.style.bottom = (vh - a.top + 8) + "px"; menu.style.transformOrigin = `${a.left + a.width / 2 - left}px 100%`; }
      else { menu.style.top = (a.bottom + 8) + "px"; menu.style.transformOrigin = `${a.left + a.width / 2 - left}px 0`; }
      const sel = menu.querySelector(".ck:not(:empty)");
      if (sel && sel.parentElement.scrollIntoView) try { sel.parentElement.scrollIntoView({ block: "center" }); } catch (_) { /* jsdom */ }
      requestAnimationFrame(() => menu.classList.add("in"));
    }
    /** Menu row icon: one of the card's icons, or (0.2.0, Grok Bot 11 Oct 2026) an mdi: icon via HA's ha-icon. */
    _menuIcon(ic) {
      if (!ic) return "";
      if (ICONS[ic]) return icon(ic);
      if (/^mdi:/.test(ic) && customElements.get("ha-icon")) return `<span class="icon"><ha-icon icon="${esc(ic)}"></ha-icon></span>`;
      return "";
    }
    _closeMenu() {
      const r = this.shadowRoot; r.querySelector(".menu-bg").classList.remove("show"); r.querySelector(".menu").classList.remove("in");
      this._menu = null; this._menuKind = null;
    }

    _debounce(name, fn, ms) {
      clearTimeout(this["_db_" + name]);
      const t = setTimeout(() => { this._timers.delete(t); fn(); }, ms);
      this._timers.add(t); this["_db_" + name] = t;
    }

    _wireButton(b, key, repeat) {
      let holdT = null, repT = null, held = false;
      const clear = () => { clearTimeout(holdT); clearInterval(repT); this._timers.delete(holdT); this._timers.delete(repT); holdT = repT = null; b.classList.remove("pressed"); };
      b.addEventListener("pointerdown", (e) => {
        if (e.button > 0) return;
        held = false; b.classList.add("pressed");
        if (repeat) {
          this.press(key); held = true;
          holdT = setTimeout(() => { repT = setInterval(() => this.press(key), 160); this._timers.add(repT); }, 450);
        } else {
          holdT = setTimeout(() => {
            const p = this.activePlayer;
            if (p && (PLATFORMS[p.platform].keys[key + "_hold"] || (p.actions && p.actions[key + "_hold"]))) { held = true; this.press(key + "_hold"); }
          }, 550);
        }
        this._timers.add(holdT);
      });
      ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => b.addEventListener(ev, (e) => {
        const wasDown = holdT !== null || repT !== null;
        clear();
        if (ev === "pointerup" && wasDown && !held) this.press(key);
      }));
      b.addEventListener("contextmenu", (e) => e.preventDefault());
      b.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this.press(key); } });
    }

    _wirePad(pad) {
      const ripple = pad.querySelector(".ripple");
      let start = null, longT = null, repT = null, fired = false;
      const stop = () => { clearTimeout(longT); clearInterval(repT); this._timers.delete(longT); this._timers.delete(repT); longT = repT = null; };
      const show = (x, y) => { const b = pad.getBoundingClientRect(); ripple.style.left = (x - b.left) + "px"; ripple.style.top = (y - b.top) + "px"; ripple.classList.add("on"); };
      pad.addEventListener("pointerdown", (e) => {
        start = { x: e.clientX, y: e.clientY }; fired = false; show(e.clientX, e.clientY);
        try { pad.setPointerCapture(e.pointerId); } catch (_) { /* jsdom */ }
        longT = setTimeout(() => { fired = true; this.press("select_hold"); }, 600);
        this._timers.add(longT);
      });
      pad.addEventListener("pointermove", (e) => {
        if (!start) return;
        const dir = swipeDirection(e.clientX - start.x, e.clientY - start.y);
        if (!dir) return;
        clearTimeout(longT);
        if (!fired) {
          fired = true; this.press(dir); show(e.clientX, e.clientY);
          // keep holding after a swipe = keep moving
          repT = setTimeout(() => { repT = setInterval(() => this.press(dir), 180); this._timers.add(repT); }, 500);
          this._timers.add(repT);
        }
      });
      const end = (e) => {
        if (!start) return;
        stop(); ripple.classList.remove("on");
        if (!fired && e.type === "pointerup") this.press("select");
        start = null;
      };
      pad.addEventListener("pointerup", end);
      pad.addEventListener("pointercancel", end);
      pad.addEventListener("contextmenu", (e) => e.preventDefault());
    }

    _act(act) {
      const r = this.shadowRoot;
      if (act === "picker") {
        this._haptic();
        if (r.querySelector(".picker").classList.contains("show")) { this._closeSheets(); return; } // tapping the pill again closes it
        this._renderPicker(); this._placePicker();
        r.querySelector(".picker").classList.add("show"); r.querySelector(".pill").classList.add("open");
        r.querySelector(".top").classList.add("dd-open"); // 0.1.11: pill stays above the backdrop
        r.querySelector(".pill").setAttribute("aria-expanded", "true");
        this._sizeShade(); // 0.1.13: shade only as tall as the list
      }
      else if (act === "close") this._closeSheets();
      else if (act === "ch") { this._haptic(); this._setChOpen(!this._chOpen); }
      else if (act === "sources" || act === "more") { this._haptic(); this._openMenu(act, r.querySelector(act === "sources" ? ".src" : ".more")); }
      else if (act === "keyboard") {
        this._haptic();
        const p = this.activePlayer;
        // 0.1.8: only while a text field is focused, when the player can tell us (keyboard_sensor, Kodi poll)
        if (this._focus(p) === false) { this._toast(`No text field selected on ${this._friendly(p)}`); return; }
        this._kbSheetFor = p ? p.entity : null;
        this._kbSearch = null; // 0.2.0: back from search mode to normal typing labels
        this._kbLabels(p ? (p.name || this._friendly(p)) : "Type", "Keyboard Input", "Type or dictate", "Send", "send"); // 0.1.7: banner-style header (name / "Keyboard Input")
        const ta = r.querySelector(".kb textarea"); ta.value = ""; this._kbText = "";
        r.querySelector(".kb").classList.add("show");
        ta.focus(); // some mobile browsers only raise the keyboard if this runs inside the tap, which it does
      }
      else if (act === "kb-clear") { const ta = r.querySelector(".kb textarea"); ta.value = ""; this._kbText = ""; if (!this._kbSearch) this.sendText("", false); ta.focus(); }
      else if (act === "kb-send" && this._kbSearch) { // 0.2.0 (Grok Bot, 11 Oct 2026): run the search shortcut with the typed text
        const text = this._kbText.trim();
        if (!text) { this._toast("Type something to search for"); r.querySelector(".kb textarea").focus(); return; }
        const { entity, sc } = this._kbSearch;
        const p = this._config.players.find((x) => x.entity === entity);
        this._closeSheets();
        this.runShortcut(p, sc, text);
      }
      else if (act === "kb-send") {
        const p = this.activePlayer;
        clearTimeout(this._db_kb); // no stale live update after Enter
        if (p && (!PLATFORMS[p.platform].textLive || p.platform === "kodi")) this.sendText(this._kbText, true);
        else if (p && p.platform === "webostv") { this.sendText(this._kbText, false); this.sendText(this._kbText, true); }
        else this.sendText(this._kbText, false);
        this._closeSheets();
      }
      else if (act.startsWith("pick:")) {
        const id = act.slice(5);
        this._writePick(id === "auto" ? null : id);
        this._closeSheets();
        if (id !== "auto") this._pickInputs(id, false);
        this._update();
      }
      else if (act === "exit") {
        this._closeSheets();
        history.pushState(null, "", this._config.exit_path);
        window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
      }
    }
    /** Switch the room's AVR/TV to `entity`'s input (inputs with triggers: [pick]). auto = Auto chose it. */
    _pickInputs(entity, auto) {
      const p = this._config.players.find((x) => x.entity === entity);
      if (!p || !p.input || this._switching) return;
      const steps = inputSteps(p, "pick", this._states, false, { auto });
      if (!steps.length) return;
      this._switching = true;
      this._call(steps).finally(() => { this._switching = false; });
    }
    /** CH control (0.1.4, Grok Bot 11 Oct 2026): collapsed "CH" in the row <-> chevron stack.
     *  Collapsed, a tap only expands (no command). Folds back after channel_timeout ms without use. */
    _setChOpen(open) {
      this._chOpen = !!open;
      const ch = this.shadowRoot.querySelector(".ch"), chl = this.shadowRoot.querySelector(".chl");
      ch.classList.toggle("open", this._chOpen);
      chl.setAttribute("aria-expanded", String(this._chOpen));
      ch.querySelectorAll(".chb").forEach((b) => (b.tabIndex = this._chOpen ? 0 : -1));
      clearTimeout(this._db_ch); this._timers.delete(this._db_ch); this._db_ch = null;
      if (this._chOpen && this._config.channel_timeout > 0) this._debounce("ch", () => this._setChOpen(false), this._config.channel_timeout);
    }
    _closeSheets() {
      const r = this.shadowRoot;
      r.querySelectorAll(".sheet-bg, .dd-bg").forEach((s) => s.classList.remove("show")); this._kbSheetFor = null; this._kbSearch = null;
      const pill = r.querySelector(".pill"); if (pill) { pill.classList.remove("open"); pill.setAttribute("aria-expanded", "false"); }
      const top = r.querySelector(".top"); if (top) top.classList.remove("dd-open"); // 0.1.11
    }
    /** 0.1.10: put the dropdown straight under the top row, spanning it (the column on tablets). */
    _placePicker() {
      const r = this.shadowRoot, top = r.querySelector(".top"), bg = r.querySelector(".picker");
      if (!top || !bg || !top.getBoundingClientRect) return;
      const b = top.getBoundingClientRect();
      if (!b.width) return; // not laid out (tests): CSS defaults apply
      bg.style.setProperty("--dd-top", Math.round(b.bottom + 8) + "px");
      bg.style.setProperty("--dd-left", Math.round(b.left) + "px");
      bg.style.setProperty("--dd-width", Math.round(b.width) + "px");
    }
    /** 0.1.13 (Grok Bot, 11 Oct 2026): size the dark shade to the list (plus a 28px fade) so it ends at the last
     *  row instead of covering the page. Measured after opening; 48px per row if not laid out (tests). */
    _sizeShade() {
      const r = this.shadowRoot, bg = r.querySelector(".picker"), dd = r.querySelector(".dd");
      if (!bg || !dd) return;
      const h = dd.offsetHeight || (r.querySelectorAll(".picker .opt").length * 48 + 8);
      bg.style.setProperty("--dd-shade-h", Math.round(h + 28) + "px");
    }
    _friendly(p) { const st = this._states[p.entity]; return p.name || (st && st.attributes && st.attributes.friendly_name) || p.entity; }

    _artHtml(p, art) {
      if (art) return `<img src="${esc(art)}" alt="" draggable="false">`;
      const ic = p.icon || PLATFORMS[p.platform].icon;
      return customElements.get("ha-icon") ? `<ha-icon icon="${esc(ic)}"></ha-icon>` : icon("tv");
    }

    _renderPicker() {
      const pick = this._readPick();
      const manual = pick && pick.entity && Date.now() - pick.ts < this._config.pick_timeout * 60000;
      const active = this.activeEntity;
      // 0.1.10: tick on the left, small generic device icon, name (state kept for screen readers only)
      const opt = (id, artHtml, l1, l2, sel) => `<button class="opt${sel ? " sel" : ""}" role="option" aria-selected="${sel ? "true" : "false"}" data-act="pick:${esc(id)}">
          <span class="tick">${sel ? "\u2713" : ""}</span><span class="art">${artHtml}</span><span class="lines"><span class="l1">${esc(l1)}</span><span class="l2">${esc(l2)}</span></span></button>`;
      let html = opt("auto", icon("auto"), "Auto", "Follows what you're watching", !manual);
      for (const p of this._config.players) {
        const st = this._states[p.entity];
        html += opt(p.entity, icon("tv"), this._friendly(p), st ? st.state.replace(/_/g, " ") : "unavailable", manual && p.entity === active);
      }
      if (this._config.layout === "fullscreen" && this._config.show_exit)
        html += `<button class="opt" data-act="exit"><span class="tick"></span><span class="art">${icon("exit")}</span><span class="lines"><span class="l1">Exit remote</span><span class="l2">Back to your dashboard</span></span></button>`;
      const box = this.shadowRoot.querySelector(".opts");
      box.innerHTML = html;
      box.querySelectorAll("[data-act]").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); this._act(b.dataset.act); }));
    }

    // ---- update ------------------------------------------------------------
    _update() {
      if (!this._built || !this._hass) return;
      const r = this.shadowRoot;
      const p = this.activePlayer;
      if (!p) return;
      if (this._lastTarget !== p.entity) this._pressedSinceTarget = false;
      if (this._urlPicked) { const u = this._urlPicked; this._urlPicked = null; this._pickInputs(u, false); }
      else if (this._prevActive && this._prevActive !== p.entity && !this._manualPick()) this._pickInputs(p.entity, true);
      this._prevActive = p.entity;
      this._syncKbPoll();
      const st = this._states[p.entity];
      const np = nowPlaying({ ...p, name: this._friendly(p) }, st);
      const sig = [p.entity, np.title, np.subtitle, np.art].join("|");
      if (sig !== this._sig) {
        this._sig = sig;
        r.querySelector(".l1").textContent = np.title;
        r.querySelector(".l2").textContent = np.subtitle;
        r.querySelector(".pill .art").innerHTML = this._artHtml(p, np.art);
      }
      const pl = PLATFORMS[p.platform];
      r.querySelector(".ib").innerHTML = ICONS[pl.icons.skip_back || "skip_back"];
      r.querySelector(".if").innerHTML = ICONS[pl.icons.skip_fwd || "skip_fwd"];
      // mute: hidden when volume goes through the remote (no mute there); icon shows the state
      const vt = volumeTarget(p, this._states);
      const mute = r.querySelector('[data-key="mute"]');
      mute.classList.toggle("hidden", vt === "remote" && !(p.actions && p.actions.mute));
      const muted = vt !== "remote" && this._states[vt] && this._states[vt].attributes && this._states[vt].attributes.is_volume_muted;
      mute.innerHTML = icon(muted ? "mute" : "unmuted");
      // "wants text" bar (keyboard focus sensor, or any binary_sensor you point at)
      const ks = p.keyboard_sensor && this._states[p.keyboard_sensor];
      const wants = !!(ks && ks.state === "on") || !!(this._kbOpen && this._kbEntity === p.entity);
      const bt = bannerText(p, this._friendly(p));
      r.querySelector(".wants .t1").textContent = bt.title;
      r.querySelector(".wants .t2").textContent = bt.line2;
      r.querySelector(".wants .t3").textContent = bt.body;
      r.querySelector(".wants").classList.toggle("show", wants);
      // 0.1.8: focus dropped (or another player took over) while the typing sheet is open -> close it
      if (this._kbSheetFor && (this._kbSheetFor !== p.entity || this._focus(p) === false)) this._closeKb();
      const textable = !!(PLATFORMS[p.platform].text(p, "x", false).length || (p.actions && p.actions.text));
      r.querySelector(".mic").style.display = textable && this._config.show_mic ? "" : "none"; // 0.1.6: off by default
      r.querySelector(".kbd").style.display = textable ? "" : "none";
      // bottom row: sources | -10 | ... | +10 | CH (each slot keeps its place when hidden)
      r.querySelector(".src").classList.toggle("gone", !sourceMenu(p, this._states));
      r.querySelector(".more").classList.toggle("gone", !moreItems(p, this._states).length && !shortcutsFor(p).length); // 0.2.0: shortcuts alone keep it
      const chOk = hasChannels(p);
      r.querySelector(".ch").classList.toggle("gone", !chOk);
      if (!chOk && this._chOpen) this._setChOpen(false);
      r.querySelector(".badge").classList.toggle("inert", !soundModeMenu(p, this._states));
      if (this._menu && (this._menuKind === "sources" || this._menuKind === "sound_mode")) {
        // keep the tick on the live value while open
        const m = this._menuKind === "sources" ? sourceMenu(p, this._states) : soundModeMenu(p, this._states);
        if (m) r.querySelectorAll(".menu .mi").forEach((b, i) => { const ck = b.querySelector(".ck"); const o = m.options[i]; if (ck && o) ck.textContent = o.value === m.current ? "\u2713" : ""; });
      }
    }
  }

  // Exposed for tests and power users.
  GlassRemoteCard.VERSION = VERSION;
  GlassRemoteCard.helpers = { kbFocus, kbPollInterval, kodiKeyboardFromEvent, sourceMenu, soundModeMenu, optionSteps, moreItems, hasChannels, bannerText, normaliseShortcuts, shortcutSteps, fillText, normaliseConfig, inputSteps, choosePlayer, volumeTarget, nowPlaying, stepsFor, swipeDirection, guessPlatform, PLATFORMS, ICONS };

  if (!customElements.get(TAG)) customElements.define(TAG, GlassRemoteCard);
  window.customCards = window.customCards || [];
  if (!window.customCards.some((c) => c.type === TAG)) {
    window.customCards.push({
      type: TAG, name: "Glass Remote Card", preview: false,
      description: "Frosted-glass touchpad remote that follows whatever you're watching (Kodi, LG webOS, Apple TV integration, any media_player).",
      documentationURL: "https://github.com/evski/ha-glass-remote-card",
    });
  }
  console.info(`%c GLASS-REMOTE-CARD %c ${VERSION} `, "color:#fff;background:#1c1c1e;font-weight:700", "color:#1c1c1e;background:#e5e5ea");
})();
