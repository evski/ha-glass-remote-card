// test/test.js - offline test suite for glass-remote-card.js. Run with `npm test`.
// jsdom + a fake `hass` object with made-up entities. No network, no Home Assistant needed.
// Every service call goes to a recorder, never to a real device.
"use strict";
const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const SRC = fs.readFileSync(path.join(ROOT, "glass-remote-card.js"), "utf8");
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const SRC_NOW = () => fs.readFileSync(path.join(ROOT, "glass-remote-card.js"), "utf8");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0, passes = 0;
const check = (name, ok, extra = "") => { ok ? passes++ : fails++; console.log(`${ok ? "PASS" : "FAIL"} ${name}${!ok && extra ? "  -> " + JSON.stringify(extra) : ""}`); };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function load() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { runScripts: "outside-only", url: "http://ha.local/remote", pretendToBeVisual: true });
  const w = dom.window;
  w.console.info = () => {};
  w.eval(SRC);
  return w;
}

const T0 = "2026-01-01T10:00:00Z", T1 = "2026-01-01T11:00:00Z";
function states(over = {}) {
  const s = {
    "media_player.lr_appletv": { state: "idle", attributes: { friendly_name: "Living Room Apple TV", app_name: "YouTube" }, last_changed: T0 },
    "media_player.kodi": { state: "playing", attributes: { friendly_name: "Kodi", media_series_title: "Space Show", media_title: "Pilot", entity_picture: "/api/media_player_proxy/media_player.kodi?token=x" }, last_changed: T1 },
    "media_player.lr_tv": { state: "on", attributes: { friendly_name: "Living Room TV", source: "AV Receiver", is_volume_muted: false }, last_changed: T0 },
    "media_player.bed_appletv": { state: "off", attributes: { friendly_name: "Bedroom Apple TV" }, last_changed: T0 },
    "media_player.avr": { state: "on", attributes: { friendly_name: "AVR", is_volume_muted: false }, last_changed: T0 },
    "binary_sensor.lr_keyboard": { state: "off", attributes: {}, last_changed: T0 },
  };
  for (const [k, v] of Object.entries(over)) s[k] = v === null ? undefined : { ...s[k], ...v, attributes: { ...(s[k] || {}).attributes, ...(v.attributes || {}) } };
  return s;
}
const CONFIG = () => ({
  players: [
    { entity: "media_player.lr_appletv", platform: "apple_tv", remote: "remote.lr_appletv", config_entry_id: "ENTRY1", volume_entity: "media_player.avr", volume_fallback: "media_player.lr_tv", keyboard_sensor: "binary_sensor.lr_keyboard" },
    { entity: "media_player.kodi", platform: "kodi", volume_entity: "media_player.avr", volume_fallback: "media_player.lr_tv" },
    { entity: "media_player.lr_tv", platform: "webostv", volume_entity: "media_player.avr", volume_fallback: "media_player.lr_tv" },
    { entity: "media_player.bed_appletv", name: "Bedroom", platform: "apple_tv", remote: "remote.bed_appletv", volume_via_remote: true },
  ],
  source_map: { entity: "media_player.lr_tv", sources: { "Apple TV": "media_player.lr_appletv", "Kodi box": "media_player.kodi" }, ignore_sources: ["AV Receiver", "HDMI 1"] },
});
function fakeHass(st, withConn = false) {
  const calls = [];
  const h = { states: st, calls, callService: (d, s, data) => { calls.push([d, s, data]); return Promise.resolve(); } };
  if (withConn) {
    h.subs = []; h.unsubs = 0;
    h.connection = { subscribeEvents: (cb, type) => { const sub = { cb, type, live: true }; h.subs.push(sub); return Promise.resolve(() => { sub.live = false; h.unsubs++; }); } };
    h.fire = (data) => h.subs.filter((x) => x.live && x.type === "kodi_call_method_result").forEach((x) => x.cb({ event_type: "kodi_call_method_result", data }));
  }
  return h;
}
function mount(w, config, st, withConn = false) {
  const card = w.document.createElement("glass-remote-card");
  card.setConfig(config);
  w.document.body.appendChild(card);
  const hass = fakeHass(st, withConn);
  card.hass = hass;
  return { card, hass, $: (q) => card.shadowRoot.querySelector(q) };
}
function ptr(w, el, type, x = 100, y = 100) {
  const e = new w.MouseEvent(type, { bubbles: true, composed: true, clientX: x, clientY: y, button: 0 });
  Object.defineProperty(e, "pointerId", { value: 1 });
  el.dispatchEvent(e);
}

(async () => {
  const w = load();
  const C = w.customElements.get("glass-remote-card");
  const H = C.helpers;

  // ---- P: packaging -------------------------------------------------------
  check("P1 element registered", !!C);
  check("P2 VERSION matches package.json", C.VERSION === PKG.version, [C.VERSION, PKG.version]);
  check("P3 window.customCards entry", (w.customCards || []).some((c) => c.type === "glass-remote-card"));
  const hacs = JSON.parse(fs.readFileSync(path.join(ROOT, "hacs.json"), "utf8"));
  check("P4 hacs.json filename exists", fs.existsSync(path.join(ROOT, hacs.filename)), hacs);
  check("P5 CHANGELOG has this version", fs.readFileSync(path.join(ROOT, "CHANGELOG.md"), "utf8").includes(`## [${PKG.version}]`));
  check("P6 no external imports", !/\bimport\s|require\(|https?:\/\/(?!github\.com)[^\s"'`]+\.js/.test(SRC.replace(/\/\*![\s\S]*?\*\//, "")));
  check("P7 getStubConfig picks media players", eq(C.getStubConfig({ states: states() }).players.map((p) => p.entity), ["media_player.lr_appletv", "media_player.kodi"]));

  // ---- C: config -----------------------------------------------------------
  const bad = (cfg) => { try { H.normaliseConfig(cfg); return false; } catch (e) { return true; } };
  check("C1 no players rejected", bad({}));
  check("C2 non media_player rejected", bad({ players: [{ entity: "light.x" }] }));
  check("C3 apple_tv without remote rejected", bad({ players: [{ entity: "media_player.a", platform: "apple_tv" }] }));
  check("C4 unknown platform rejected", bad({ players: [{ entity: "media_player.a", platform: "roku9" }] }));
  check("C5 bad layout rejected", bad({ players: ["media_player.a"], layout: "huge" }));
  const n = H.normaliseConfig({ players: ["media_player.kodi_box", { entity: "media_player.lg_oled" }, { entity: "media_player.den", remote: "remote.den_appletv" }] });
  check("C6 string players + platform guess", eq(n.players.map((p) => p.platform), ["kodi", "webostv", "apple_tv"]), n.players);
  check("C7 defaults", n.layout === "fullscreen" && n.pick_timeout === 180 && n.pad_height === "58dvh");
  check("C8 single `entity` shorthand", H.normaliseConfig({ entity: "media_player.x" }).players.length === 1);

  // ---- A: active player ------------------------------------------------------
  const cfg = H.normaliseConfig(CONFIG());
  check("A1 ignored TV input -> ranking -> playing Kodi", H.choosePlayer(cfg, states(), null) === "media_player.kodi");
  check("A2 mapped TV input wins", H.choosePlayer(cfg, states({ "media_player.lr_tv": { attributes: { source: "Apple TV" } } }), null) === "media_player.lr_appletv");
  check("A3 TV app source -> TV", H.choosePlayer(cfg, states({ "media_player.lr_tv": { attributes: { source: "Netflix" } } }), null) === "media_player.lr_tv");
  check("A4 TV off -> ranking", H.choosePlayer(cfg, states({ "media_player.lr_tv": { state: "off", attributes: { source: "Netflix" } } }), null) === "media_player.kodi");
  const now = Date.parse("2026-01-01T12:00:00Z");
  check("A5 manual pick wins", H.choosePlayer(cfg, states(), { entity: "media_player.bed_appletv", ts: now - 60000 }, now) === "media_player.bed_appletv");
  check("A6 manual pick expires", H.choosePlayer(cfg, states(), { entity: "media_player.bed_appletv", ts: now - 181 * 60000 }, now) === "media_player.kodi");
  check("A7 paused beats idle", H.choosePlayer(cfg, states({ "media_player.kodi": { state: "idle" }, "media_player.lr_appletv": { state: "paused" } }), null) === "media_player.lr_appletv");
  check("A8 same rank -> most recent", H.choosePlayer(cfg, states({ "media_player.kodi": { state: "idle", last_changed: T0 }, "media_player.lr_appletv": { state: "idle", last_changed: T1 } }), null) === "media_player.lr_appletv");
  check("A9 nothing on -> TV if on", H.choosePlayer(cfg, states({ "media_player.kodi": { state: "off" }, "media_player.lr_appletv": { state: "off" } }), null) === "media_player.lr_tv");
  const allOff = states({ "media_player.kodi": { state: "off" }, "media_player.lr_appletv": { state: "off" }, "media_player.lr_tv": { state: "off" } });
  check("A10 everything off -> first player", H.choosePlayer(cfg, allOff, null) === "media_player.lr_appletv");
  check("A11 no source_map -> plain ranking", H.choosePlayer(H.normaliseConfig({ players: ["media_player.lr_tv", "media_player.kodi"] }), states(), null) === "media_player.kodi");

  // ---- V: volume ---------------------------------------------------------------
  const [atv, kd, tv, bed] = cfg.players;
  check("V1 AVR on -> AVR", H.volumeTarget(atv, states()) === "media_player.avr");
  check("V2 AVR off -> fallback TV", H.volumeTarget(atv, states({ "media_player.avr": { state: "off" } })) === "media_player.lr_tv");
  check("V3 volume_via_remote -> remote", H.volumeTarget(bed, states()) === "remote");
  check("V4 no volume config -> player", H.volumeTarget({ entity: "media_player.kodi" }, states()) === "media_player.kodi");
  check("V5 up -> media_player.volume_up on AVR", eq(H.stepsFor(kd, "volume_up", states()), [["media_player", "volume_up", { entity_id: "media_player.avr" }]]));
  check("V6 mute toggles", eq(H.stepsFor(kd, "mute", states({ "media_player.avr": { attributes: { is_volume_muted: true } } })), [["media_player", "volume_mute", { entity_id: "media_player.avr", is_volume_muted: false }]]));
  check("V7 remote volume -> remote.send_command", eq(H.stepsFor(bed, "volume_down", states()), [["remote", "send_command", { entity_id: "remote.bed_appletv", command: "volume_down" }]]));
  check("V8 remote volume has no mute", H.stepsFor(bed, "mute", states()).length === 0);

  // ---- K: key mapping per platform ---------------------------------------------
  const S = states();
  check("K1 ATV select", eq(H.stepsFor(atv, "select", S), [["remote", "send_command", { entity_id: "remote.lr_appletv", command: "select" }]]));
  check("K2 ATV back = menu, hold = top_menu", H.stepsFor(atv, "back", S)[0][2].command === "menu" && H.stepsFor(atv, "back_hold", S)[0][2].command === "top_menu");
  check("K3 ATV long select uses hold_secs", H.stepsFor(atv, "select_hold", S)[0][2].hold_secs === 1);
  check("K4 ATV skip", H.stepsFor(atv, "skip_back", S)[0][2].command === "skip_backward" && H.stepsFor(atv, "skip_fwd", S)[0][2].command === "skip_forward");
  { // 0.2.3 (Grok Bot, 13 Oct 2026): power_on / power_off overrides follow the player state
    const lgp = { entity: "media_player.lg", platform: "webostv", actions: { power_on: { service: "wake_on_lan.send_magic_packet", data: { mac: "aa:bb:cc:dd:ee:ff" } } } };
    check("PW1 power_on used when off", eq(H.stepsFor(lgp, "power", { "media_player.lg": { state: "off" } }), [["wake_on_lan", "send_magic_packet", { mac: "aa:bb:cc:dd:ee:ff" }]]));
    check("PW2 built-in turn_off when on and no power_off", eq(H.stepsFor(lgp, "power", { "media_player.lg": { state: "on" } }), [["media_player", "turn_off", { entity_id: "media_player.lg" }]]));
    check("PW3 power_on used when entity missing", H.stepsFor(lgp, "power", {})[0][0] === "wake_on_lan");
    const both = { ...lgp, actions: { ...lgp.actions, power_off: { service: "script.tv_off" }, power: { service: "script.tv_toggle" } } };
    check("PW4 actions.power wins", eq(H.stepsFor(both, "power", { "media_player.lg": { state: "off" } }), [["script", "tv_toggle", {}]]));
    delete both.actions.power;
    check("PW5 power_off used when on", eq(H.stepsFor(both, "power", { "media_player.lg": { state: "on" } }), [["script", "tv_off", {}]]));
  }
  check("K5 ATV power on when off", eq(H.stepsFor(bed, "power", S), [["media_player", "turn_on", { entity_id: "media_player.bed_appletv" }]]));
  check("K6 ATV power off when on", H.stepsFor(atv, "power", S)[0][1] === "turn_off");
  check("K7 Kodi arrows", eq(H.stepsFor(kd, "up", S), [["kodi", "call_method", { entity_id: "media_player.kodi", method: "Input.Up" }]]));
  check("K8 Kodi seek -10", eq(H.stepsFor(kd, "skip_back", S)[0][2], { entity_id: "media_player.kodi", method: "Player.Seek", playerid: 1, value: { seconds: -10 } }));
  check("K9 Kodi play_pause", eq(H.stepsFor(kd, "play_pause", S), [["media_player", "media_play_pause", { entity_id: "media_player.kodi" }]]));
  check("K10 LG buttons", H.stepsFor(tv, "select", S)[0][2].button === "ENTER" && H.stepsFor(tv, "subtitles", S)[0][2].button === "CC");
  check("K11 generic without remote: no arrows, prev/next", H.stepsFor({ entity: "media_player.x", platform: "generic" }, "up", S).length === 0 &&
    H.stepsFor({ entity: "media_player.x", platform: "generic" }, "skip_fwd", S)[0][1] === "media_next_track");
  const custom = { ...kd, actions: { home: { service: "script.turn_on", target: { entity_id: "script.kodi_home" } }, text: { service: "kodi.call_method", data: { method: "Input.SendText", text: "$text", done: true } } } };
  check("K12 per-player action override", eq(H.stepsFor(custom, "home", S), [["script", "turn_on", { entity_id: "script.kodi_home" }]]));
  check("K13 $text substitution", eq(H.stepsFor(custom, "text", S, "hello")[0][2], { method: "Input.SendText", text: "hello", done: true }));
  check("K14 swipe directions", H.swipeDirection(40, 5) === "right" && H.swipeDirection(-3, -50) === "up" && H.swipeDirection(5, 5) === null);

  // ---- N: now playing text ---------------------------------------------------------
  check("N1 series", eq(H.nowPlaying({ entity: "e", name: "Kodi" }, S["media_player.kodi"]).title, "Space Show") && H.nowPlaying({ entity: "e", name: "Kodi" }, S["media_player.kodi"]).subtitle === "Kodi · Pilot");
  check("N2 app only", eq(H.nowPlaying({ name: "Living Room Apple TV" }, S["media_player.lr_appletv"]), { title: "YouTube", subtitle: "Living Room Apple TV · idle", art: null }));
  check("N3 nothing -> name / state", eq(H.nowPlaying({ name: "Bedroom" }, S["media_player.bed_appletv"]), { title: "Bedroom", subtitle: "off", art: null }));
  check("N4 paused suffix", H.nowPlaying({ name: "Kodi" }, { state: "paused", attributes: { media_title: "Film" } }).subtitle === "Kodi · paused");
  check("N5 artwork", H.nowPlaying({ name: "Kodi" }, S["media_player.kodi"]).art.startsWith("/api/media_player_proxy/"));

  // ---- D: DOM ----------------------------------------------------------------------
  w.localStorage.clear();
  let m = mount(w, CONFIG(), states());
  check("D1 renders top/pad/bottom", !!(m.$(".top") && m.$(".pad") && m.$(".bottom")));
  check("D2 pill shows the active player", m.$(".l1").textContent === "Space Show" && m.$(".l2").textContent === "Kodi · Pilot");
  check("D3 artwork image", (m.$(".pill .art img") || {}).getAttribute && m.$(".pill .art img").getAttribute("src").startsWith("/api/media_player_proxy/"));
  check("D4 fullscreen layout class", m.$(".root").classList.contains("fullscreen"));
  ptr(w, m.$('[data-key="back"]'), "pointerdown"); ptr(w, m.$('[data-key="back"]'), "pointerup");
  check("D5 tap back -> Kodi Input.Back", eq(m.hass.calls.pop(), ["kodi", "call_method", { entity_id: "media_player.kodi", method: "Input.Back" }]));
  const pad = m.$(".pad");
  ptr(w, pad, "pointerdown", 100, 100); ptr(w, pad, "pointerup", 101, 101);
  check("D6 pad tap -> select", eq(m.hass.calls.pop(), ["kodi", "call_method", { entity_id: "media_player.kodi", method: "Input.Select" }]));
  ptr(w, pad, "pointerdown", 100, 100); ptr(w, pad, "pointermove", 160, 104); ptr(w, pad, "pointerup", 160, 104);
  check("D7 pad swipe right -> Input.Right (once)", m.hass.calls.length === 1 && m.hass.calls.pop()[2].method === "Input.Right");
  ptr(w, pad, "pointerdown", 100, 100); await sleep(700); ptr(w, pad, "pointerup", 100, 100);
  check("D8 pad long press -> context menu, no select", m.hass.calls.length === 1 && m.hass.calls.pop()[2].method === "Input.ContextMenu");
  const up = m.$('[data-key="volume_up"]');
  ptr(w, up, "pointerdown"); await sleep(1000); ptr(w, up, "pointerup");
  const n1 = m.hass.calls.length;
  check("D9 volume hold repeats", n1 >= 3 && m.hass.calls.every((c) => c[1] === "volume_up" && c[2].entity_id === "media_player.avr"), n1);
  await sleep(400);
  check("D10 repeat stops on release", m.hass.calls.length === n1);
  m.hass.calls.length = 0;
  check("D11 mute visible for AVR players", !m.$('[data-key="mute"]').classList.contains("hidden"));

  // picker
  m.$(".pill").click();
  check("D12 picker opens with Auto + 4 players + Exit", m.$(".picker").classList.contains("show") && m.card.shadowRoot.querySelectorAll(".opt").length === 6);
  m.card.shadowRoot.querySelector('[data-act="pick:media_player.bed_appletv"]').click();
  check("D13 pick switches player and closes", m.card.activeEntity === "media_player.bed_appletv" && !m.$(".picker").classList.contains("show") && m.$(".l1").textContent === "Bedroom");
  check("D14 mute hidden when volume goes through the remote", m.$('[data-key="mute"]').classList.contains("hidden"));
  m.$(".pill").click(); m.card.shadowRoot.querySelector('[data-act="pick:auto"]').click();
  check("D15 Auto clears the pick", m.card.activeEntity === "media_player.kodi" && w.localStorage.length === 0);
  check("D16 no service call from picking", m.hass.calls.length === 0);

  // keyboard: Kodi sends on Send with done
  check("D17a mic hidden by default (0.1.6), keyboard button kept", m.$(".mic").style.display === "none" && m.$(".kbd").style.display !== "none");
  m.$(".kbd").click();
  check("D17 keyboard button opens the text box", m.$(".kb").classList.contains("show"));
  check("D17b 0.1.7 typing sheet: glass header with player name, glass pill buttons, no hint line or accent text links",
    m.$(".kb .kb-head .appicon") && m.$(".kb-title").textContent.length > 0 && !/^Type on /.test(m.$(".kb-title").textContent) &&
    m.$(".kb-sub").textContent === "Keyboard Input" && m.$(".kb .kb-x").classList.contains("glass") && !m.$(".kb .hint") &&
    [...m.card.shadowRoot.querySelectorAll(".kb .row button")].every((b) => b.classList.contains("glass")) &&
    m.$(".kb textarea").placeholder === "Type or dictate", m.$(".kb-title").textContent);
  check("D17c picker has no close button (removed in 0.1.12 and still gone in 0.1.13, Grok Bot 11 Oct 2026); the typing sheet keeps its own", !m.$(".picker .dd-x") && !!m.$(".kb .kb-x.glass"));
  const ta = m.$(".kb textarea"); ta.value = "space"; ta.dispatchEvent(new w.Event("input")); await sleep(400);
  check("D18 Kodi: live Input.SendText done=false while typing", eq(m.hass.calls, [["kodi", "call_method", { entity_id: "media_player.kodi", method: "Input.SendText", text: "space", done: false }]]), m.hass.calls);
  ta.value = "space x"; ta.dispatchEvent(new w.Event("input"));
  m.card.shadowRoot.querySelector('[data-act="kb-send"]').click(); await sleep(400);
  check("D19b Enter cancels the pending live update (no stale done=false after done=true)", m.hass.calls.length === 2 && m.hass.calls[1][2].text === "space x", m.hass.calls);
  m.hass.calls[1][2].text = "space";
  check("D19 Kodi: Send -> Input.SendText done", eq(m.hass.calls.pop(), ["kodi", "call_method", { entity_id: "media_player.kodi", method: "Input.SendText", text: "space", done: true }]));

  // apple_tv: live text + wants-text bar
  m.card.remove();
  m = mount(w, CONFIG(), states({ "media_player.kodi": { state: "idle" }, "media_player.lr_tv": { attributes: { source: "Apple TV" } }, "binary_sensor.lr_keyboard": { state: "on" } }));
  check("D20 apple_tv active via TV input", m.card.activeEntity === "media_player.lr_appletv");
  check("D21 keyboard banner shown (notification-style)", m.$(".wants").classList.contains("show") && m.$(".wants .t1").textContent === "Living Room Apple TV Keyboard" &&
    m.$(".wants .t2").textContent === "Keyboard Input" && /^Enter text on Living Room Apple TV using your keyboard\. Press to type\.$/.test(m.$(".wants .t3").textContent), m.$(".wants").textContent);
  check("D21b banner sits at the top of the remote, not in the pad", m.$(".wants").parentElement === m.$(".root") && !!m.$(".wants .appicon svg"));
  m.$(".wants").click();
  const ta2 = m.$(".kb textarea"); ta2.value = "star"; ta2.dispatchEvent(new w.Event("input")); await sleep(400);
  check("D22 apple_tv: live set_keyboard_text", eq(m.hass.calls.pop(), ["apple_tv", "set_keyboard_text", { config_entry_id: "ENTRY1", text: "star" }]));
  m.card.hass = fakeHass(states({ "media_player.kodi": { state: "idle" }, "media_player.lr_tv": { attributes: { source: "Apple TV" } } }));
  check("D23 bar hides when sensor turns off", !m.$(".wants").classList.contains("show"));

  // LG skip icons + generic without text hides mic
  m.card.remove();
  m = mount(w, { players: [{ entity: "media_player.lr_tv", platform: "webostv" }] }, states());
  check("D24 LG uses rewind/forward glyphs (no '10')", !/ellipse/.test(m.$(".ib").innerHTML) && m.$(".ib").innerHTML.includes("<svg"));
  m.card.remove();
  m = mount(w, { layout: "card", players: [{ entity: "media_player.kodi", platform: "generic" }] }, states());
  check("D25 generic: mic/keyboard hidden, card layout", m.$(".mic").style.display === "none" && m.$(".root").classList.contains("card"));
  m.card.remove();
  check("D26 timers cleared on disconnect", m.card._timers.size === 0);

  // ---- B: banner wording --------------------------------------------------------------
  check("B1 apple_tv banner wording", eq(H.bannerText({ platform: "apple_tv" }, "Den"), { title: "Den Keyboard", line2: "Keyboard Input", body: "Enter text on Den using your keyboard. Press to type." }));
  check("B2 Kodi wording", H.bannerText({ platform: "kodi" }, "Kodi", false).body === "Enter text on Kodi using your keyboard. Press to type.");
  check("B3 LG wording", H.bannerText({ platform: "webostv" }, "TV").body === "Enter text on your LG TV using your keyboard. Press to type.");
  check("B4 generic uses the name", H.bannerText({ platform: "generic" }, "Shield", false).body.startsWith("Enter text on Shield"));

  // ---- I: input switching -----------------------------------------------------------
  const INP = (o = {}) => H.normaliseConfig({ players: [{ entity: "media_player.kodi", platform: "kodi", input: { entity: "media_player.avr", source: "UHD", ...o } }] }).players[0];
  const avr = (st, src) => states({ "media_player.avr": { state: st, attributes: { source: src } } });
  check("I1 defaults", eq(INP().input[0], { turn_on: false, turn_on_delay: 1500, triggers: ["home"], skip_if_selected: true, delay: 0, on_auto: false, entity: "media_player.avr", source: "UHD" }));
  check("I2 home on another source -> select_source", eq(H.inputSteps(INP(), "home", avr("on", "PVR")), [["media_player", "select_source", { entity_id: "media_player.avr", source: "UHD" }]]));
  check("I3 already on source -> nothing (skip_if_selected)", H.inputSteps(INP(), "home", avr("on", "UHD")).length === 0);
  check("I4 skip_if_selected false -> always switch", H.inputSteps(INP({ skip_if_selected: false }), "home", avr("on", "UHD")).length === 1);
  check("I5 not a trigger key -> nothing", H.inputSteps(INP(), "select", avr("on", "PVR")).length === 0);
  check("I6 hold variant counts (home_hold)", H.inputSteps(INP(), "home_hold", avr("on", "PVR")).length === 1);
  check("I7 triggers list", H.inputSteps(INP({ triggers: ["power", "select"] }), "select", avr("on", "PVR")).length === 1 && H.inputSteps(INP({ triggers: ["power", "select"] }), "home", avr("on", "PVR")).length === 0);
  check("I8 triggers any", H.inputSteps(INP({ triggers: "any" }), "left", avr("on", "PVR")).length === 1);
  check("I9 triggers first: only the first press", H.inputSteps(INP({ triggers: ["first"] }), "left", avr("on", "PVR"), true).length === 1 && H.inputSteps(INP({ triggers: ["first"] }), "left", avr("on", "PVR"), false).length === 0);
  check("I10 AVR off, turn_on false -> nothing", H.inputSteps(INP(), "home", avr("off", "PVR")).length === 0);
  check("I11 AVR off, turn_on -> on, wait, switch", eq(H.inputSteps(INP({ turn_on: true, turn_on_delay: 3000 }), "home", avr("off", "PVR")),
    [["media_player", "turn_on", { entity_id: "media_player.avr" }], ["wait", 3000], ["media_player", "select_source", { entity_id: "media_player.avr", source: "UHD" }]]));
  check("I12 AVR standby counts as off", H.inputSteps(INP({ turn_on: true }), "home", avr("standby", "UHD"))[0][1] === "turn_on");
  check("I13 delay after switching", eq(H.inputSteps(INP({ delay: 800 }), "home", avr("on", "PVR")).slice(-1)[0], ["wait", 800]));
  check("I14 custom action with $source", eq(H.inputSteps(INP({ action: { service: "script.avr_select", data: { source: "$source", zone: 1 } } }), "home", avr("on", "PVR")),
    [["script", "avr_select", { source: "UHD", zone: 1 }]]));
  check("I15 custom action without source (no skip check)", H.inputSteps(H.normaliseConfig({ players: [{ entity: "media_player.kodi", platform: "kodi", input: { entity: "media_player.avr", action: { service: "script.kodi_input" } } }] }).players[0], "home", avr("on", "UHD")).length === 1);
  check("I16 unavailable AVR -> nothing", H.inputSteps(INP({ turn_on: true }), "home", avr("unavailable", "PVR")).length === 0);
  const two = H.normaliseConfig({ players: [{ entity: "media_player.kodi", platform: "kodi", input: [
    { entity: "media_player.avr", source: "UHD" }, { entity: "media_player.lr_tv", source: "HDMI 2", triggers: ["home", "power"] }] }] }).players[0];
  check("I17 several inputs (AVR + TV HDMI) in order", eq(H.inputSteps(two, "home", states({ "media_player.avr": { attributes: { source: "PVR" } } })).map((x) => x[2].source), ["UHD", "HDMI 2"]));
  check("I18 validation: entity required", bad({ players: [{ entity: "media_player.k", input: { source: "UHD" } }] }));
  check("I19 validation: source or action required", bad({ players: [{ entity: "media_player.k", input: { entity: "media_player.avr" } }] }));
  check("I20 validation: unknown trigger", bad({ players: [{ entity: "media_player.k", input: { entity: "media_player.avr", source: "x", triggers: ["teleport"] } }] }));
  check("I21 validation: delay must be ms", bad({ players: [{ entity: "media_player.k", input: { entity: "media_player.avr", source: "x", delay: "2s" } }] }));

  // DOM: Home on Kodi switches the AVR first, then sends Home
  w.localStorage.clear();
  const icfg = CONFIG(); icfg.players[1].input = { entity: "media_player.avr", source: "UHD", delay: 100 };
  m = mount(w, icfg, states({ "media_player.avr": { attributes: { source: "PVR" } } }));
  const home = m.$('[data-key="home"]');
  ptr(w, home, "pointerdown"); ptr(w, home, "pointerup"); await sleep(50);
  check("I22 Home: select_source sent first, Home waits for delay", eq(m.hass.calls, [["media_player", "select_source", { entity_id: "media_player.avr", source: "UHD" }]]), m.hass.calls);
  await sleep(150);
  check("I23 ...then Kodi Input.Home", eq(m.hass.calls[1], ["kodi", "call_method", { entity_id: "media_player.kodi", method: "Input.Home" }]), m.hass.calls);
  m.card.remove();
  m = mount(w, icfg, states({ "media_player.avr": { attributes: { source: "UHD" } } }));
  ptr(w, m.$('[data-key="home"]'), "pointerdown"); ptr(w, m.$('[data-key="home"]'), "pointerup"); await sleep(200);
  check("I24 AVR already on UHD -> only Home", eq(m.hass.calls, [["kodi", "call_method", { entity_id: "media_player.kodi", method: "Input.Home" }]]), m.hass.calls);
  ptr(w, m.$('[data-key="back"]'), "pointerdown"); ptr(w, m.$('[data-key="back"]'), "pointerup"); await sleep(50);
  check("I25 other keys unaffected", m.hass.calls.length === 2 && m.hass.calls[1][2].method === "Input.Back");
  m.card.remove();

  // ---- PW: power (apple_tv) ------------------------------------------------------------
  {
    const atv = H.normaliseConfig(CONFIG()).players[0];
    const on = H.stepsFor(atv, "power", states({ "media_player.lr_appletv": { state: "playing" } }));
    const off = H.stepsFor(atv, "power", states({ "media_player.lr_appletv": { state: "standby" } }));
    check("PW1 apple_tv power on -> media_player.turn_off", eq(on, [["media_player", "turn_off", { entity_id: "media_player.lr_appletv" }]]), on);
    check("PW2 apple_tv power off/standby -> media_player.turn_on", eq(off, [["media_player", "turn_on", { entity_id: "media_player.lr_appletv" }]]), off);
    check("PW3 no power long-press: nothing sends remote turn_off/suspend with hold",
      !H.PLATFORMS.apple_tv.keys.power_hold && !Object.values(H.PLATFORMS.apple_tv.keys).some((f) => { const st = f(atv, { state: "on" }); return st && st[1] === "send_command" && /turn_off|turn_on|suspend|wakeup/.test(st[2].command); }));
    w.localStorage.clear();
    const mm = mount(w, CONFIG(), states({ "media_player.lr_appletv": { state: "playing" }, "media_player.kodi": { state: "idle" } }));
    const pw = mm.$('[data-key="power"]');
    ptr(w, pw, "pointerdown"); await sleep(700); ptr(w, pw, "pointerup"); await sleep(20);
    check("PW4 holding power on the card sends one media_player.turn_off, no hold_secs", eq(mm.hass.calls, [["media_player", "turn_off", { entity_id: "media_player.lr_appletv" }]]), mm.hass.calls);
    mm.card.remove();
  }

  // ---- S: sources ----------------------------------------------------------------------
  const SP = (o, extra = {}) => H.normaliseConfig({ players: [{ entity: "media_player.kodi", platform: "kodi", volume_entity: "media_player.avr", ...o }] }).players[0];
  const AVRS = states({ "media_player.avr": { attributes: { source: "PVR", source_list: ["STB", "PVR", "UHD", "GAME", "BT"], sound_mode: "STEREO", sound_mode_list: ["STEREO", "DOLBY_SURROUND", "DTS_NEURAL_X", "MCH_STEREO", "AURO_2D"] } },
    "media_player.kodi": { attributes: { source_list: ["Movies", "TV"], source: "TV" } }, "select.tv_input": { state: "HDMI 2", attributes: { options: ["HDMI 1", "HDMI 2"] } } });
  check("S1 default: the player's own source_list, current marked", eq(H.sourceMenu(SP({}), AVRS), { entity: "media_player.kodi", current: "TV", options: [{ value: "Movies", name: "Movies" }, { value: "TV", name: "TV" }] }));
  check("S2 no source_list -> no button", H.sourceMenu(SP({}), states()) === null);
  const s3 = H.sourceMenu(SP({ sources: { entity: "media_player.avr", include: ["UHD", "PVR"], rename: { UHD: "Kodi", PVR: "Apple TV" } } }), AVRS);
  check("S3 other entity + include (order kept) + rename", eq(s3.options, [{ value: "UHD", name: "Kodi" }, { value: "PVR", name: "Apple TV" }]) && s3.current === "PVR", s3);
  check("S4 exclude", eq(H.sourceMenu(SP({ sources: { entity: "media_player.avr", exclude: ["BT", "STB"] } }), AVRS).options.map((o) => o.value), ["PVR", "UHD", "GAME"]));
  check("S5 include items as `value: label`", eq(H.sourceMenu(SP({ sources: { entity: "media_player.avr", include: [{ UHD: "Kodi" }, "GAME"] } }), AVRS).options, [{ value: "UHD", name: "Kodi" }, { value: "GAME", name: "GAME" }]));
  check("S6 sources: false hides", H.sourceMenu(SP({ sources: false }), AVRS) === null);
  check("S7 string shorthand = entity", H.sourceMenu(SP({ sources: "media_player.avr" }), AVRS).entity === "media_player.avr");
  check("S8 select_source step", eq(H.optionSteps({}, "media_player.avr", "source", "UHD"), [["media_player", "select_source", { entity_id: "media_player.avr", source: "UHD" }]]));
  check("S9 select entity -> select.select_option", eq(H.optionSteps({}, "select.tv_input", "source", "HDMI 1"), [["select", "select_option", { entity_id: "select.tv_input", option: "HDMI 1" }]]) &&
    H.sourceMenu(SP({ sources: "select.tv_input" }), AVRS).current === "HDMI 2");
  check("S10 custom action with $value", eq(H.optionSteps({ action: { service: "script.avr_source", data: { source: "$value" } } }, "media_player.avr", "source", "UHD"), [["script", "avr_source", { source: "UHD" }]]));
  check("S11 validation", bad({ players: [{ entity: "media_player.k", sources: { include: "UHD" } }] }) && bad({ players: [{ entity: "media_player.k", sources: 5 }] }));

  // ---- M: sound mode ---------------------------------------------------------------------
  const m1 = H.soundModeMenu(SP({}), AVRS);
  check("M1 default entity = volume_entity, its sound_mode_list", m1.entity === "media_player.avr" && m1.options.length === 5 && m1.current === "STEREO");
  check("M2 modes + rename", eq(H.soundModeMenu(SP({ sound_mode: { modes: [{ STEREO: "Stereo" }, { DOLBY_SURROUND: "Dolby Surround" }] } }), AVRS).options, [{ value: "STEREO", name: "Stereo" }, { value: "DOLBY_SURROUND", name: "Dolby Surround" }]));
  check("M3 hide", H.soundModeMenu(SP({ sound_mode: { hide: true } }), AVRS) === null && H.soundModeMenu(SP({ sound_mode: false }), AVRS) === null);
  check("M4 select_sound_mode step", eq(H.optionSteps({}, "media_player.avr", "sound_mode", "DTS_NEURAL_X"), [["media_player", "select_sound_mode", { entity_id: "media_player.avr", sound_mode: "DTS_NEURAL_X" }]]));
  check("M5 no list -> none", H.soundModeMenu(SP({ volume_entity: "media_player.lr_tv" }), AVRS) === null);

  // ---- O: more menu + channels -----------------------------------------------------------
  const ids = (p) => H.moreItems(p, AVRS).map((i) => i.id);
  // 0.2.2 (Grok Bot, 11 Oct 2026): Kodi's Info is on the row, so More starts at subtitles
  check("O1 Kodi default more items (no info: it's the row button)", eq(ids(SP({})), ["subtitles", "subtitles_hold", "audio_track", "sound_mode", "osd", "context_menu"]), ids(SP({})));
  check("O2 sound mode item only when available", !ids(SP({ sound_mode: false })).includes("sound_mode"));
  check("O3 custom list incl. a service item", eq(H.moreItems(SP({ info_button: false, more: ["info", { name: "Lights", service: "scene.turn_on", target: { entity_id: "scene.movie" } }] }), AVRS).map((i) => [i.name, i.steps]),
    [["Info", [["kodi", "call_method", { entity_id: "media_player.kodi", method: "Input.Info" }]]], ["Lights", [["scene", "turn_on", { entity_id: "scene.movie" }]]]]));
  check("O4 more: false", H.moreItems(SP({ more: false }), AVRS).length === 0);
  check("O5 validation of more", bad({ players: [{ entity: "media_player.k", more: [{ name: "x" }] }] }) && bad({ players: [{ entity: "media_player.k", more: "info" }] }));
  check("O6 channels: apple_tv + LG on, Kodi off unless asked", H.hasChannels(H.normaliseConfig(CONFIG()).players[0]) && H.hasChannels(H.normaliseConfig(CONFIG()).players[2]) && !H.hasChannels(SP({})) && H.hasChannels(SP({ channels: true })));
  check("O7 LG channel keys", eq(H.stepsFor(H.normaliseConfig(CONFIG()).players[2], "channel_up", states()), [["webostv", "button", { entity_id: "media_player.lr_tv", button: "CHANNELUP" }]]));

  // DOM: bottom row, menus
  w.localStorage.clear();
  const dcfg = CONFIG(); dcfg.players[1].sources = { entity: "media_player.avr", include: [{ UHD: "Kodi" }, { PVR: "Apple TV" }] };
  m = mount(w, dcfg, AVRS);
  check("O8 bottom row order: sources | -10 | ... | +10 | info/CH (0.2.1: Info and CH share the 5th slot)", eq([...m.$(".inner").children].map((e) => e.className.split(" ")[0] || e.dataset.key), ["src", "skip_back", "more", "skip_fwd", "infob", "ch"]));
  check("O9 Kodi: CH slot hidden, sources + more shown", m.$(".ch").classList.contains("gone") && !m.$(".src").classList.contains("gone") && !m.$(".more").classList.contains("gone"));
  // 0.2.1 (Grok Bot, 11 Oct 2026): O10 used to assert there was NO info button; that was the regression Evan hit
  check("O10 Kodi: Info button in the row (no separate subtitles button), mic hidden by default", !!m.$('.inner [data-key="info"]') && !m.$(".inner .infob").classList.contains("gone") && !m.$('.inner [data-key="subtitles"]') && m.$(".mic").style.display === "none");
  m.$(".src").click(); await sleep(10);
  const mis = [...m.card.shadowRoot.querySelectorAll(".menu .mi")];
  check("O11 sources menu lists renamed sources, ticks the current one", m.$(".menu-bg").classList.contains("show") && eq(mis.map((b) => b.textContent), ["Kodi", "\u2713Apple TV"]), mis.map((b) => b.textContent));
  mis[0].click(); await sleep(10);
  check("O12 tap -> select_source on the AVR, menu closes", eq(m.hass.calls, [["media_player", "select_source", { entity_id: "media_player.avr", source: "UHD" }]]) && !m.$(".menu-bg").classList.contains("show"), m.hass.calls);
  // badge long-press -> sound mode
  const badge = m.$(".badge");
  ptr(w, badge, "pointerdown"); await sleep(560); ptr(w, badge, "pointerup");
  const smi = [...m.card.shadowRoot.querySelectorAll(".menu .mi")];
  check("O13 hold speaker badge -> sound mode menu", m.$(".menu .mt").textContent === "Sound Mode" && smi.length === 5 && /\u2713STEREO/.test(smi[0].textContent));
  smi[2].click(); await sleep(10);
  check("O14 -> select_sound_mode", eq(m.hass.calls[1], ["media_player", "select_sound_mode", { entity_id: "media_player.avr", sound_mode: "DTS_NEURAL_X" }]), m.hass.calls);
  ptr(w, badge, "pointerdown"); await sleep(100); ptr(w, badge, "pointerup"); await sleep(10);
  check("O15 a short tap on the badge does nothing", !m.$(".menu-bg").classList.contains("show") && m.hass.calls.length === 2);
  // more -> sound mode, more -> info
  m.$(".more").click(); await sleep(10);
  const more = [...m.card.shadowRoot.querySelectorAll(".menu .mi")];
  // 0.2.2 (Grok Bot, 11 Oct 2026): no Info in Kodi's More (it's the row button, see IB2/IB4)
  check("O16 more menu (Kodi, no Info)", eq(more.map((b) => b.textContent), ["Subtitles", "Next subtitle", "Audio Track", "Sound Mode", "Player Controls", "Context Menu"]), more.map((b) => b.textContent));
  more[3].click(); await sleep(10);
  check("O17 more > Sound Mode opens the sound mode menu", m.$(".menu-bg").classList.contains("show") && m.$(".menu .mt").textContent === "Sound Mode");
  m.$(".menu-bg").click(); m.$(".more").click(); await sleep(10);
  m.card.shadowRoot.querySelectorAll(".menu .mi")[0].click(); await sleep(10);
  check("O18 more > Subtitles sends showsubtitles", eq(m.hass.calls.slice(-1)[0], ["kodi", "call_method", { entity_id: "media_player.kodi", method: "Input.ExecuteAction", action: "showsubtitles" }]), m.hass.calls.slice(-1));
  ptr(w, m.$(".tab[data-key=\"volume_up\"]"), "pointerdown"); await sleep(700); ptr(w, m.$(".tab[data-key=\"volume_up\"]"), "pointerup");
  check("O19 + tab still repeats while held", m.hass.calls.filter((c) => c[1] === "volume_up").length >= 2);
  m.card.remove();

  // ---- CH: CH control, row always shown (0.1.4, Grok Bot 11 Oct 2026) -----------------
  {
    const css = () => b.$("style").textContent;
    w.localStorage.clear();
    let b = mount(w, dcfg, AVRS); // Kodi active, no channels
    check("CH1 row always visible: no hide toggle, no 'open' gating on the row", !/\.inner:not\(\.open\)/.test(css()) && !b.$(".inner").classList.contains("open") && !b.$(".src").classList.contains("gone") && !b.$(".more").classList.contains("gone"));
    check("CH2 Kodi (no channel keys): CH slot hidden, no chevron toggle", b.$(".ch").classList.contains("gone") && !b.$('.inner [data-act="row"]'));
    check("CH3 the row only catches taps on its own buttons (pad stays a touchpad)", /\.inner \{[^}]*pointer-events: none/.test(css()));
    const pad = b.$(".pad"); const n0 = b.hass.calls.length;
    ptr(w, pad, "pointerdown", 100, 100); ptr(w, pad, "pointerup", 100, 100); await sleep(10);
    check("CH4 tap on the pad -> select", b.hass.calls.length === n0 + 1 && /Select/.test(JSON.stringify(b.hass.calls.slice(-1)[0])));
    b.card.remove();
    // apple_tv: collapsed CH with caps; tap -> expand (no command); chevrons send channel keys; tap CH -> collapse
    w.localStorage.clear();
    b = mount(w, { ...CONFIG(), channel_timeout: 300 }, states()); b.card._writePick("media_player.lr_appletv"); b.card.hass = { ...b.hass, states: states() };
    const ch = () => b.$(".ch"), chl = () => b.$(".chl");
    check("CH5 apple_tv: CH shown collapsed, in the row's 5th slot", !ch().classList.contains("gone") && !ch().classList.contains("open") && chl().textContent === "CH" && [...b.$(".inner").children].indexOf(ch()) === 5 && b.$(".inner .infob").classList.contains("gone") && chl().getAttribute("aria-expanded") === "false");
    check("CH6 each chevron button holds a thin cap and a chevron", b.card.shadowRoot.querySelectorAll(".ch .chb .cap").length === 2 && b.card.shadowRoot.querySelectorAll(".ch .chb .chev").length === 2);
    check("CH7 collapsed: chevron buttons don't take taps; open: they do, and they animate (transitions)", /\.ch \.chb \{[^}]*pointer-events: none/.test(css()) && /\.ch\.open \.chb \{[^}]*pointer-events: auto/.test(css()) && /\.ch > button \{[^}]*transition: transform \.22s/.test(css()) && /\.ch \.chb path \{[^}]*transition: opacity/.test(css()));
    check("CH8 open stack rises above the row: up above CH above down", /\.ch\.open \.chb\.up \{ transform: translateY\(-73px\)/.test(css()) && /\.ch\.open \.chl \{ transform: translateY\(-40px\)/.test(css()) && /\.ch\.open \.chb\.dn \{ transform: translateY\(-7px\)/.test(css()));
    const n1 = b.hass.calls.length; chl().click(); await sleep(10);
    check("CH9 tap collapsed CH -> expands, sends nothing", ch().classList.contains("open") && chl().getAttribute("aria-expanded") === "true" && b.hass.calls.length === n1);
    const up = b.$('.ch [data-key="channel_up"]'); ptr(w, up, "pointerdown"); ptr(w, up, "pointerup"); await sleep(10);
    const dn = b.$('.ch [data-key="channel_down"]'); ptr(w, dn, "pointerdown"); ptr(w, dn, "pointerup"); await sleep(10);
    const sent = JSON.stringify(b.hass.calls.slice(n1));
    check("CH10 open: up/down send channel_up / channel_down to the apple_tv remote", /channel_up/.test(sent) && /channel_down/.test(sent) && /remote\.lr_appletv/.test(sent), b.hass.calls.slice(n1));
    const n2 = b.hass.calls.length; chl().click(); await sleep(10);
    check("CH11 tap CH again -> collapses, sends nothing", !ch().classList.contains("open") && b.hass.calls.length === n2);
    chl().click(); await sleep(200);
    ptr(w, up, "pointerdown"); ptr(w, up, "pointerup"); await sleep(200);
    check("CH12 using a chevron restarts the fold-back timer", ch().classList.contains("open"));
    await sleep(250);
    check("CH13 folds back after channel_timeout without use", !ch().classList.contains("open") && !b.card._db_ch);
    b.card._writePick("media_player.kodi"); chl().click(); b.card.hass = { ...b.hass, states: states() };
    check("CH14 switching to a player without channels hides and folds the CH control", ch().classList.contains("gone") && !ch().classList.contains("open"));
    b.card.remove();
    w.localStorage.clear();
    b = mount(w, { ...CONFIG(), channel_timeout: 0 }, states()); b.card._writePick("media_player.lr_appletv"); b.card.hass = { ...b.hass, states: states() };
    b.$(".chl").click(); await sleep(50);
    check("CH15 channel_timeout: 0 -> stays open, no timer", b.$(".ch").classList.contains("open") && !b.card._db_ch);
    b.card.remove();
    {
      const st = mount(w, CONFIG(), states()); const cssT = st.$("style").textContent; st.card.remove();
      check("CH17 collapsed CH shares the row's centre line: row buttons and the CH slot are both fixed 44px boxes, CH parts centred on it (0.1.5)",
        /\.inner > button \{ width: 44px; height: 44px; padding: 0; display: grid; place-items: center;/.test(cssT) && /\.ch \{ position: relative; width: 44px; height: 44px;/.test(cssT)
        && /\.ch \.chb\.up \{ transform: translateY\(-14px\)/.test(cssT) && /\.ch \.chb\.dn \{ transform: translateY\(14px\)/.test(cssT) && /\.ch > button \{ position: absolute; left: 50%; top: 50%;/.test(cssT));
    }
    {
      const sm = mount(w, { ...CONFIG(), show_mic: true }, states({ "binary_sensor.lr_keyboard": { state: "on" } })); // 0.1.8: apple_tv needs keyboard focus
      check("MIC1 show_mic: true brings the mic back (opens the text box)", sm.$(".mic").style.display === "" && (sm.$(".mic").click(), sm.$(".kb").classList.contains("show")));
      sm.card.remove();
      check("MIC2 show_mic validation + default false", bad({ ...CONFIG(), show_mic: "yes" }) && H.normaliseConfig(CONFIG()).show_mic === false);
    }
    check("CH16 channel_timeout validation + default 5000", bad({ ...CONFIG(), channel_timeout: "5s" }) && bad({ ...CONFIG(), channel_timeout: -1 }) && H.normaliseConfig(CONFIG()).channel_timeout === 5000);
    w.localStorage.clear();
  }

  // ---- IP: input switch on picking a player --------------------------------------------
  {
    check("IP1 pick trigger -> switch", H.inputSteps(INP({ triggers: ["pick"] }), "pick", avr("on", "PVR")).length === 1);
    check("IP2 pick not triggered by buttons, buttons/any not by pick", H.inputSteps(INP({ triggers: ["pick"] }), "home", avr("on", "PVR")).length === 0 &&
      H.inputSteps(INP({ triggers: ["any"] }), "pick", avr("on", "PVR")).length === 0);
    check("IP3 Auto change ignored unless on_auto", H.inputSteps(INP({ triggers: ["pick"] }), "pick", avr("on", "PVR"), false, { auto: true }).length === 0 &&
      H.inputSteps(INP({ triggers: ["pick"], on_auto: true }), "pick", avr("on", "PVR"), false, { auto: true }).length === 1);
    check("IP4 skip when already on the source", H.inputSteps(INP({ triggers: ["pick"] }), "pick", avr("on", "UHD")).length === 0);
    check("IP5 validation: on_auto boolean", bad({ players: [{ entity: "media_player.k", input: { entity: "media_player.avr", source: "x", on_auto: "yes" } }] }));
    const pc = CONFIG();
    pc.players[0].input = { entity: "media_player.avr", source: "PVR", triggers: ["pick"] };
    pc.players[1].input = [{ entity: "media_player.avr", source: "UHD", triggers: ["home", "pick"] }, { entity: "media_player.lr_tv", source: "AV Receiver", triggers: ["pick"] }];
    w.localStorage.clear();
    let q = mount(w, pc, states({ "media_player.avr": { attributes: { source: "PVR" } } }));
    check("IP6 nothing sent on load", q.hass.calls.length === 0);
    q.$(".pill").click(); q.card.shadowRoot.querySelector('[data-act="pick:media_player.kodi"]').click(); await sleep(20);
    check("IP7 manual pick Kodi -> Arcam UHD (TV already on AV Receiver: skipped)", eq(q.hass.calls, [["media_player", "select_source", { entity_id: "media_player.avr", source: "UHD" }]]), q.hass.calls);
    q.$(".pill").click(); q.card.shadowRoot.querySelector('[data-act="pick:media_player.lr_appletv"]').click(); await sleep(20);
    check("IP8 manual pick apple_tv -> PVR skipped (AVR state still PVR)", q.hass.calls.length === 1);
    q.$(".pill").click(); q.card.shadowRoot.querySelector('[data-act="pick:auto"]').click(); await sleep(20);
    check("IP9 back to Auto (Kodi) -> no switch (on_auto off)", q.hass.calls.length === 1, q.hass.calls);
    // Auto switches by itself (TV input changes to Apple TV)
    q.card.hass = { ...q.hass, states: states({ "media_player.avr": { attributes: { source: "UHD" } }, "media_player.lr_tv": { attributes: { source: "Apple TV" } } }) }; await sleep(20);
    check("IP10 Auto moving to apple_tv doesn't fight (on_auto false)", q.card.activeEntity === "media_player.lr_appletv" && q.hass.calls.length === 1, q.hass.calls);
    q.card.remove();
    pc.players[0].input.on_auto = true;
    q = mount(w, pc, states({ "media_player.avr": { attributes: { source: "UHD" } } }));
    q.card.hass = { ...q.hass, states: states({ "media_player.avr": { attributes: { source: "UHD" } }, "media_player.lr_tv": { attributes: { source: "Apple TV" } } }) }; await sleep(20);
    check("IP11 on_auto: Auto moving to apple_tv -> PVR", eq(q.hass.calls, [["media_player", "select_source", { entity_id: "media_player.avr", source: "PVR" }]]), q.hass.calls);
    q.card.remove(); w.localStorage.clear();
  }

  // ---- KB: Kodi keyboard detection --------------------------------------------------------
  {
    const kst = (o = {}) => states({ "media_player.kodi": { state: "idle", attributes: { media_content_type: null } }, ...o });
    const KP = (o = {}) => H.normaliseConfig({ players: [{ entity: "media_player.kodi", platform: "kodi", ...o }] }).players[0];
    check("KB1 default interval 2000 while idle", H.kbPollInterval(KP(), { state: "idle", attributes: {} }) === 2000);
    check("KB2 no poll while video plays", H.kbPollInterval(KP(), { state: "playing", attributes: { media_content_type: "episode" } }) === 0);
    check("KB3 music playing still polls", H.kbPollInterval(KP(), { state: "playing", attributes: { media_content_type: "music" } }) === 2000);
    check("KB4 keyboard_poll_during_video: true", H.kbPollInterval(KP({ keyboard_poll_during_video: true }), { state: "playing", attributes: { media_content_type: "movie" } }) === 2000);
    check("KB5 keyboard_poll: 0 = off; card-level default", H.kbPollInterval(KP({ keyboard_poll: 0 }), { state: "idle" }) === 0 &&
      H.kbPollInterval(KP(), { state: "idle" }, { keyboard_poll: 3000 }) === 3000);
    check("KB6 not Kodi / off -> no poll", H.kbPollInterval(H.normaliseConfig(CONFIG()).players[0], { state: "idle" }) === 0 && H.kbPollInterval(KP(), { state: "off" }) === 0);
    check("KB7 validation", bad({ players: [{ entity: "media_player.kodi", keyboard_poll: "2s" }] }));
    const ev = (id, label, ent = "media_player.kodi", method = "GUI.GetProperties") => ({ entity_id: ent, result: { currentwindow: { id, label } }, result_ok: true, input: { method, params: { properties: ["currentwindow"] } } });
    check("KB8 event parsing", H.kodiKeyboardFromEvent(ev(10103, "Virtual keyboard"), "media_player.kodi") === true &&
      H.kodiKeyboardFromEvent(ev(10109, "Numeric input"), "media_player.kodi") === true &&
      H.kodiKeyboardFromEvent(ev(10000, "Home"), "media_player.kodi") === false &&
      H.kodiKeyboardFromEvent(ev(10103, "x", "media_player.other"), "media_player.kodi") === null &&
      H.kodiKeyboardFromEvent(ev(10103, "x", "media_player.kodi", "Player.GetItem"), "media_player.kodi") === null);

    w.localStorage.clear();
    const kcfg = CONFIG(); kcfg.players[1].keyboard_poll = 500;
    let k = mount(w, kcfg, kst(), true);
    const polls = () => k.hass.calls.filter((c) => c[2] && c[2].method === "GUI.GetProperties");
    await sleep(20);
    check("KB9 Kodi active + visible: polls at once and subscribes to kodi_call_method_result",
      polls().length === 1 && eq(polls()[0], ["kodi", "call_method", { entity_id: "media_player.kodi", method: "GUI.GetProperties", properties: ["currentwindow"] }]) &&
      k.hass.subs.length === 1 && k.hass.subs[0].type === "kodi_call_method_result");
    await sleep(1100);
    check("KB10 polls every keyboard_poll ms", polls().length === 3, polls().length);
    check("KB10b timer set doesn't grow while polling", k.card._timers.size <= 1, k.card._timers.size);
    check("KB11 a single subscription even with many hass updates", (() => { for (let i = 0; i < 5; i++) k.card.hass = { ...k.hass, states: kst() }; return k.hass.subs.filter((x) => x.live).length === 1; })());
    k.hass.fire(ev(10103, "Virtual keyboard"));
    check("KB12 keyboard open -> notification-style banner", k.$(".wants").classList.contains("show") && k.$(".wants .t1").textContent === "Kodi Keyboard" && /^Enter text on Kodi/.test(k.$(".wants .t3").textContent));
    k.hass.fire(ev(10103, "Virtual keyboard", "media_player.other"));
    k.hass.fire(ev(10000, "Home"));
    check("KB13 closes -> banner hides; other entities ignored", !k.$(".wants").classList.contains("show"));
    k.hass.fire(ev(10109, "Numeric input"));
    k.$(".wants").click();
    check("KB14 numeric input shows it too; tapping opens text entry", k.$(".kb").classList.contains("show"));
    k.hass.fire(ev(10000, "Home"));
    check("FOC7 Kodi: keyboard window closes -> typing sheet closes", !k.$(".kb").classList.contains("show"));
    k.$(".kbd").click();
    check("FOC8 Kodi polled, no keyboard window -> keyboard button shows the hint, no sheet",
      !k.$(".kb").classList.contains("show") && k.$(".toast").classList.contains("show") && k.$(".toast").textContent === "No text field selected on Kodi", k.$(".toast").textContent);
    k.hass.fire(ev(10103, "Virtual keyboard")); k.$(".kbd").click();
    check("FOC9 Kodi keyboard window open -> keyboard button opens the sheet", k.$(".kb").classList.contains("show"));
    k.hass.fire(ev(10000, "Home"));
    k.card._closeSheets();
    // video starts -> stop
    const before = polls().length;
    k.card.hass = { ...k.hass, states: kst({ "media_player.kodi": { state: "playing", attributes: { media_content_type: "movie" } } }) };
    await sleep(1100);
    check("KB15 video playing -> polling stops, unsubscribed, banner cleared, no timers left",
      polls().length === before && k.hass.unsubs === 1 && !k.$(".wants").classList.contains("show") && !k.card._kbTimer, [polls().length, before, k.hass.unsubs]);
    k.card.hass = { ...k.hass, states: kst() }; await sleep(20);
    check("KB16 resumes when video stops", polls().length === before + 1 && k.hass.subs.filter((x) => x.live).length === 1);
    // tab hidden
    Object.defineProperty(w.document, "visibilityState", { configurable: true, get: () => "hidden" });
    w.document.dispatchEvent(new w.Event("visibilitychange"));
    const b2 = polls().length; await sleep(1100);
    check("KB17 page hidden -> stops", polls().length === b2 && k.hass.unsubs === 2);
    Object.defineProperty(w.document, "visibilityState", { configurable: true, get: () => "visible" });
    w.document.dispatchEvent(new w.Event("visibilitychange")); await sleep(20);
    check("KB18 visible again -> restarts", polls().length === b2 + 1);
    // switch to the apple_tv player
    k.card._writePick("media_player.lr_appletv"); k.card.hass = { ...k.hass, states: kst() };
    const b3 = polls().length; await sleep(1100);
    check("KB19 another player picked -> stops", polls().length === b3 && k.hass.subs.filter((x) => x.live).length === 0);
    k.card._writePick(null); k.card.hass = { ...k.hass, states: kst() }; await sleep(20);
    // removed from the page
    k.card.remove(); const b4 = polls().length; await sleep(1100);
    check("KB20 removed -> no polls, no subscription, no timers", polls().length === b4 && k.hass.subs.filter((x) => x.live).length === 0 && k.card._timers.size === 0, [polls().length, b4, k.card._timers.size]);
    // keyboard_poll 0
    k = mount(w, { ...CONFIG(), players: CONFIG().players.map((p) => p.platform === "kodi" ? { ...p, keyboard_poll: 0 } : p) }, kst(), true); await sleep(50);
    check("KB21 keyboard_poll: 0 -> no polls, no subscription", polls().length === 0 && k.hass.subs.length === 0);
    k.card.remove();
    // no connection (older frontends / tests) -> nothing
    k = mount(w, CONFIG(), kst()); await sleep(50);
    check("KB22 no hass.connection -> no polling", polls().length === 0);
    k.card.remove();
    w.localStorage.clear();
  }

  // ---- PK: device picker dropdown + neutral naming (0.1.10, Grok Bot 11 Oct 2026) ----
  {
    w.localStorage.clear();
    const k = mount(w, CONFIG(), states());
    const css = k.$("style").textContent;
    check("PK1 picker is a dropdown under the pill, never a bottom sheet", k.$(".picker").classList.contains("dd-bg") && !k.$(".picker").classList.contains("sheet-bg") && !k.$(".picker .sheet") &&
      /\.dd \{ position: fixed; top: var\(--dd-top/.test(css) && /transform-origin: 50% 0; transform: translateY\(-14px\) scaleY\(\.7\)/.test(css));
    k.$(".pill").click();
    check("PK2 opening: shown, pill marked open (chevron turns), aria-expanded", k.$(".picker").classList.contains("show") && k.$(".pill").classList.contains("open") &&
      k.$(".pill").getAttribute("aria-expanded") === "true" && /\.pill\.open \.chev \{ transform: rotate\(90deg\)/.test(css));
    const rows = [...k.card.shadowRoot.querySelectorAll(".picker .opt")];
    check("PK3 rows: Auto, players, Exit; tick first (left) and only on the selected row; generic icons only",
      rows.length === 6 && rows[0].dataset.act === "pick:auto" && rows[5].dataset.act === "exit" && rows.every((r) => r.firstElementChild.classList.contains("tick")) &&
      rows.filter((r) => r.querySelector(".tick").textContent === "\u2713").length === 1 && rows[0].classList.contains("sel") && !k.$(".picker ha-icon") && !/mdi:apple/.test(k.$(".picker").innerHTML));
    k.$(".pill").click();
    check("PK4 tapping the pill again closes it", !k.$(".picker").classList.contains("show") && !k.$(".pill").classList.contains("open"));
    k.$(".pill").click(); k.$(".picker").dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
    check("PK5 tapping outside the list closes it", !k.$(".picker").classList.contains("show"));
    // 0.1.12 (Grok Bot, 11 Oct 2026): the close button is gone; Escape is the third way to close (pill, outside, Escape)
    k.$(".pill").click(); k.$(".picker .opt").dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true, composed: true }));
    check("PK6 no close button; Escape closes it", !k.$(".picker .dd-x") && !k.$('.picker [aria-label="Close"]') && !k.$('.picker [data-act="close"]') &&
      !k.$(".picker").classList.contains("show") && !k.$(".pill").classList.contains("open"));
    check("PK7 no platform logo icons; neutral banner wording", !/mdi:apple/.test(JSON.stringify(Object.values(H.PLATFORMS).map((p) => p.icon))) &&
      !/iOS|Apple TV/.test(H.bannerText({ platform: "apple_tv" }, "Den").body));
    const src = fs.readFileSync(path.join(ROOT, "glass-remote-card.js"), "utf8");
    check("PK8 no design comparisons or trademark style names in the code", !/Liquid|Siri|iOS Remote|Apple's|Apple-style|Apple-TV-Remote|SF Pro|-apple-system|tvOS/.test(src));
    k.card.remove(); w.localStorage.clear();
  }

  // ---- DD: 0.1.11 look, shade only as tall as the list, no close button (0.1.13, Grok Bot 11 Oct 2026) ----
  {
    w.localStorage.clear();
    const k = mount(w, CONFIG(), states({ "media_player.kodi": { attributes: { source_list: ["Movies", "TV"], source: "TV" } } }));
    const css = k.$("style").textContent;
    const rule = (sel) => { const m = css.match(new RegExp("\\n\\s*" + sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + " \\{([^}]*)\\}")); return m ? m[1] : ""; };
    const dd = rule(".dd"), shade = rule(".dd-shade"), bg = rule(".dd-bg");
    check("DD1 0.1.11 look: the list has no glass panel, rounded card or shadow; rows padded as in 0.1.11",
      !/background|backdrop-filter|border-radius|box-shadow/.test(dd) && /padding: 2px 0 6px/.test(dd) &&
      /\.opt \{ width: 100%; display: flex; align-items: center; gap: 12px; padding: 0 44px 0 6px; min-height: 48px; text-align: left; font-size: 15px;/.test(css), dd);
    check("DD2 0.1.11 dark blurred shade kept (same colour and blur, full width from under the top row)",
      !!k.$(".picker .dd-shade") && /background: rgba\(0,0,0,\.86\)/.test(shade) && /backdrop-filter: blur\(14px\)/.test(shade) && /left: 0; right: 0; top: var\(--dd-top, 80px\)/.test(shade) &&
      !/background/.test(bg), shade);
    check("DD3 shade ends at the list: sized by --dd-shade-h, no bottom: 0, capped at the screen, soft fade at the bottom",
      /height: var\(--dd-shade-h, 340px\)/.test(shade) && !/bottom: 0|inset/.test(shade) && /max-height: calc\(100dvh - var\(--dd-top, 80px\)\)/.test(shade) &&
      /mask-image: linear-gradient\(to bottom, #000 calc\(100% - 28px\), transparent\)/.test(shade), shade);
    check("DD4 still grows down from the pill (top-anchored, slide-down transform)", /top: var\(--dd-top/.test(dd) && /transform-origin: 50% 0; transform: translateY\(-14px\) scaleY\(\.7\)/.test(dd));
    check("DD5 no close button anywhere in the picker markup or CSS", !/\.dd-x/.test(css) && !k.$(".picker button:not(.opt)"));
    k.$(".pill").click();
    const rows = [...k.card.shadowRoot.querySelectorAll(".picker .dd > .opts > .opt")];
    check("DD6 open list holds only the rows (Auto, devices, Exit), hairlines between rows, tick on the selected row",
      rows.length === 6 && k.$(".picker .dd").children.length === 1 && /\.opt \{[^}]*border-top: \.5px solid rgba\(255,255,255,\.14\)/.test(css) && /\.opt:first-child \{ border-top: none; \}/.test(css) &&
      rows.filter((r) => r.querySelector(".tick").textContent === "\u2713").length === 1);
    check("DD7 opening sizes the shade to the rows plus the 28px fade (6 rows x 48 + 8 + 28 when not laid out)",
      k.$(".picker").style.getPropertyValue("--dd-shade-h") === "324px", k.$(".picker").style.getPropertyValue("--dd-shade-h"));
    // sources / sound mode / More: already compact floating menus, transparent catcher, no close button
    const mrule = rule(".menu"), mbg = rule(".menu-bg");
    check("DD8 other button menus are compact floating panels without a close button", !/background|backdrop-filter/.test(mbg) && /max-height: 56vh/.test(mrule) && /border-radius: 22px/.test(mrule) &&
      !k.$('.menu [aria-label="Close"], .menu-bg [data-act="close"]'));
    k.card._closeSheets(); k.card._openMenu("sources", k.$(".src"));
    check("DD9 sources menu opens without a close button", k.$(".menu-bg").classList.contains("show") && !k.$('.menu [aria-label="Close"]') && !k.$(".menu .dd-x"));
    k.card._closeMenu(); k.card.remove(); w.localStorage.clear();
  }

  // ---- PT: whole pill is one tap target; pill toggles the open picker (0.1.11, Grok Bot 11 Oct 2026) ----
  {
    w.localStorage.clear();
    const k = mount(w, CONFIG(), states()); // Kodi active -> artwork <img> in the pill
    const R = k.card.shadowRoot, css = k.$("style").textContent;
    const isOpen = () => k.$(".picker").classList.contains("show");
    const closeAll = () => { k.card._closeSheets(); };
    const pill = k.$(".pill");
    check("PT1 one button role: the pill is a <button type=button> with aria-haspopup, aria-expanded, aria-controls -> the list",
      pill.tagName === "BUTTON" && pill.type === "button" && pill.getAttribute("aria-haspopup") === "listbox" && pill.getAttribute("aria-expanded") === "false" &&
      pill.getAttribute("aria-controls") === "grc-picker" && R.getElementById("grc-picker") && R.getElementById("grc-picker").getAttribute("role") === "listbox" &&
      !pill.querySelector("button, a, input, [role=button], [tabindex]"));
    check("PT2 children never take pointer events (artwork, title, subtitle, chevron); artwork not draggable",
      /\.pill > \*, \.pill \* \{ pointer-events: none; \}/.test(css) && /\.pill img \{ -webkit-user-drag: none;/.test(css) &&
      !!k.$(".pill .art img") && k.$(".pill .art img").getAttribute("draggable") === "false");
    const parts = { artwork: ".pill .art img", title: ".pill .l1", subtitle: ".pill .l2", chevron: ".pill .chev svg path", padding: ".pill" };
    const opened = Object.entries(parts).filter(([, q]) => { closeAll(); k.$(q).dispatchEvent(new w.MouseEvent("click", { bubbles: true, composed: true })); return isOpen(); }).map(([n]) => n);
    check("PT3 a tap on any part of the pill opens the picker", opened.length === 5, opened);
    closeAll(); pill.click();
    check("PT4 while open the top row sits above the backdrop (picker inside the card layer, z 21 > 20)",
      k.$(".top").classList.contains("dd-open") && !!k.$(".root .picker") && /\.top\.dd-open \{ z-index: 21; \}/.test(css) && /\.top\.dd-open, \.top\.dd-open \.circle \{ pointer-events: none; \}/.test(css) && /\.top\.dd-open \.pill \{ pointer-events: auto; \}/.test(css) && /\.dd-bg \{ position: fixed; inset: 0; z-index: 20;/.test(css));
    k.$(".pill .chev svg path").dispatchEvent(new w.MouseEvent("click", { bubbles: true, composed: true }));
    check("PT5 tapping the pill (its chevron) while open closes it; chevron rotates back; aria-expanded false; top row lowered",
      !isOpen() && !pill.classList.contains("open") && pill.getAttribute("aria-expanded") === "false" && !k.$(".top").classList.contains("dd-open"));
    k.$(".pill .l1").dispatchEvent(new w.MouseEvent("click", { bubbles: true, composed: true })); const o1 = isOpen();
    k.$(".pill .l1").dispatchEvent(new w.MouseEvent("click", { bubbles: true, composed: true }));
    check("PT6 title tap toggles open then closed", o1 && !isOpen());
    pill.click(); k.$(".picker").dispatchEvent(new w.MouseEvent("click", { bubbles: true })); const outside = !isOpen();
    check("PT7 tapping outside still closes it (and lowers the top row); no close button (0.1.12)", outside && !isOpen() && !k.$(".top").classList.contains("dd-open") && !k.$(".picker .dd-x"));
    pill.click(); k.$(".picker .opt").dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true, composed: true }));
    check("PT8 keyboard: Escape closes and focus returns to the pill", !isOpen() && R.activeElement === pill);
    // a tap on a page layer stacked over the pill's area is routed to the pill (full-screen only)
    pill.getBoundingClientRect = () => ({ left: 80, right: 310, top: 14, bottom: 78, width: 230, height: 64 });
    const cover = w.document.createElement("div"); w.document.body.appendChild(cover);
    const tap = (el, x, y) => { const e = new w.MouseEvent("click", { bubbles: true, composed: true, cancelable: true, clientX: x, clientY: y }); el.dispatchEvent(e); return e; };
    const e1 = tap(cover, 195, 46);
    check("PT9 tap on a layer over the pill opens the picker and is consumed", isOpen() && e1.defaultPrevented);
    tap(cover, 300, 46);
    check("PT10 another tap there (over the chevron) closes it", !isOpen() && !pill.classList.contains("open"));
    tap(cover, 195, 300); const dlg = w.document.createElement("ha-dialog"); w.document.body.appendChild(dlg); tap(dlg, 195, 46);
    check("PT11 taps elsewhere on the page or in a dialog are left alone", !isOpen());
    dlg.remove();
    k.card.remove(); tap(cover, 195, 46);
    check("PT12 routing removed when the card is removed", !isOpen());
    const c2 = mount(w, { ...CONFIG(), layout: "card" }, states());
    c2.$(".pill").getBoundingClientRect = () => ({ left: 80, right: 310, top: 14, bottom: 78, width: 230, height: 64 });
    tap(cover, 195, 46);
    check("PT13 card layout: no routing (only the full-screen remote owns the top of the screen)", !c2.$(".picker").classList.contains("show"));
    c2.$(".pill .art").dispatchEvent(new w.MouseEvent("click", { bubbles: true, composed: true }));
    check("PT14 card layout: whole pill still opens it", c2.$(".picker").classList.contains("show"));
    c2.card.remove(); cover.remove();
    check("PT15 no trademark wording in the card source beyond the factual integration name",
      !/SF Symbols|Safari|Liquid|Siri|tvOS|iPadOS|iPhone|-apple-system/.test(SRC_NOW()) && !/Apple(?! TV| Inc)/.test(SRC_NOW()));
    // NAME1 (Grok Bot, 11 Oct 2026): every text file in the repo (README, docs, templates, workflows, examples, scripts, the card),
    // not just the card source. "Apple TV" (device / HA integration name) and "Apple Inc" (trademark notice) are the only allowed uses.
    // This test file is skipped because it has to spell the words out to look for them.
    const BANNED = /\b(?:iPhone|iOS|iPad|iPadOS|Safari|macOS|Mac OS|watchOS|tvOS|Apple Watch|Siri|SF Symbols|SF Pro|Liquid Glass|-apple-system)\b/i;
    const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
      if ([".git", "node_modules"].includes(e.name)) return [];
      const p = path.join(d, e.name);
      return e.isDirectory() ? walk(p) : [p];
    });
    const textFiles = walk(ROOT).filter((p) => /\.(md|js|json|ya?ml|html|py|sh|txt)$|LICENSE$/.test(p) && !/package-lock\.json$/.test(p) && p !== __filename);
    const hits = [];
    for (const f of textFiles) fs.readFileSync(f, "utf8").split("\n").forEach((line, i) => {
      const rel = path.relative(ROOT, f) + ":" + (i + 1);
      if (BANNED.test(line)) hits.push(rel + " " + line.match(BANNED)[0]);
      if (/Apple(?! TV|%20TV| Inc)/.test(line)) hits.push(rel + " Apple"); // %20 = URL-encoded "Apple TV" in screenshot URLs
      if (/Apple Inc/.test(line) && !/trademark/i.test(line)) hits.push(rel + " Apple Inc outside the trademark notice");
    });
    check("NAME1 no other companies' product names in any repo text file (only 'Apple TV' and the 'Apple Inc' trademark notice)",
      textFiles.length > 10 && hits.length === 0, hits);
    w.localStorage.clear();
  }

  // ---- LAY: tablet / wide layout (0.1.9, Grok Bot 11 Oct 2026) ----
  {
    const n = H.normaliseConfig(CONFIG());
    check("LAY1 defaults: column_ratio 0.52, max_width 100vw", n.column_ratio === 0.52 && n.max_width === "100vw");
    check("LAY2 max_width number -> px; CSS length kept", H.normaliseConfig({ ...CONFIG(), max_width: 560 }).max_width === "560px" && H.normaliseConfig({ ...CONFIG(), max_width: "34rem" }).max_width === "34rem");
    const bad = (c) => { try { H.normaliseConfig({ ...CONFIG(), ...c }); return false; } catch (e) { return true; } };
    check("LAY3 bad column_ratio / max_width rejected", bad({ column_ratio: 0 }) && bad({ column_ratio: "wide" }) && bad({ column_ratio: 5 }) && bad({ max_width: "" }) && !bad({ column_ratio: 0.6 }));
    const l = mount(w, { ...CONFIG(), max_width: 600, column_ratio: 0.5 }, states());
    const st = l.$(".root").getAttribute("style");
    check("LAY4 column vars on the root", /--grc-col-ratio:0\.5/.test(st) && /--grc-max-w:600px/.test(st), st);
    const css = l.$("style").textContent;
    check("LAY5 wide screens only (min-aspect-ratio 3/5): centred column from ratio x height capped by max_width, pad fills height, bottom row clustered",
      /@media \(min-aspect-ratio: 3\/5\)/.test(css) && /--grc-col: min\(calc\(100vw - 32px\), max\(320px, calc\(100dvh \* var\(--grc-col-ratio/.test(css) &&
      /var\(--grc-max-w, 100vw\)/.test(css) && /\.root\.fullscreen \.pad-wrap \{ flex: 1 1 auto; height: auto;/.test(css) && /\.root\.fullscreen \.bottom \{ margin-top: 0; justify-content: center;/.test(css));
    check("LAY6 phone rules untouched outside the media query", /\.pad-wrap \{ position: relative; margin-top: 18px; flex: 0 1 auto; height: var\(--grc-pad-height\)/.test(css) &&
      /\.bottom \{ flex: 0 0 auto; margin-top: auto; padding-top: 28px; display: flex; align-items: center; justify-content: space-between;/.test(css));
    l.card.remove(); w.localStorage.clear();
  }

  // ---- FOC: keyboard focus gating + glass hint (0.1.8, Grok Bot 11 Oct 2026) ----
  {
    w.localStorage.clear();
    const atv = { "media_player.kodi": { state: "idle" }, "media_player.lr_tv": { attributes: { source: "Apple TV" } } };
    const pl = (e) => CONFIG().players.find((p) => p.entity === e);
    check("FOC1 kbFocus: sensor on/off -> true/false; Kodi only while polled; webOS -> null",
      H.kbFocus(pl("media_player.lr_appletv"), states({ "binary_sensor.lr_keyboard": { state: "on" } })) === true &&
      H.kbFocus(pl("media_player.lr_appletv"), states()) === false &&
      H.kbFocus(pl("media_player.kodi"), states(), { polling: true, open: false }) === false &&
      H.kbFocus(pl("media_player.kodi"), states(), { polling: true, open: true }) === true &&
      H.kbFocus(pl("media_player.kodi"), states(), { polling: false, open: false }) === null &&
      H.kbFocus(pl("media_player.lr_tv"), states()) === null);
    let f = mount(w, CONFIG(), states(atv));
    f.$(".kbd").click();
    check("FOC2 apple_tv, no text field focused -> no sheet, glass hint instead",
      !f.$(".kb").classList.contains("show") && f.$(".toast").classList.contains("show") && f.$(".toast").textContent === "No text field selected on Living Room Apple TV" && f.hass.calls.length === 0,
      f.$(".toast").textContent);
    f.card._toast("x", 40); await sleep(90);
    check("FOC3 hint hides itself; one toast element only", !f.$(".toast").classList.contains("show") && f.card.shadowRoot.querySelectorAll(".toast").length === 1);
    check("FOC3b hint uses the shared glass panel", /\.toast \{[^}]*backdrop-filter: blur\(30px\)/.test(f.$("style").textContent));
    f.card.hass = fakeHass(states({ ...atv, "binary_sensor.lr_keyboard": { state: "on" } }));
    f.$(".kbd").click();
    check("FOC4 focused -> keyboard button opens the sheet", f.$(".kb").classList.contains("show"));
    f.card.hass = fakeHass(states(atv));
    check("FOC5 focus drops while open -> sheet closes", !f.$(".kb").classList.contains("show"));
    // a text call that fails: no HA toast (notifyOnError false), one glass hint, sheet closed
    const errHass = fakeHass(states({ ...atv, "binary_sensor.lr_keyboard": { state: "on" } }));
    const args = [];
    errHass.callService = (...a) => { args.push(a); return Promise.reject(new Error("No text input field is currently focused on the Apple TV")); };
    f.card.hass = errHass;
    f.$(".kbd").click();
    const ta = f.$(".kb textarea");
    for (const t of ["a", "ab", "abc"]) { ta.value = t; ta.dispatchEvent(new w.Event("input")); await sleep(300); }
    check("FOC6 text errors: callService asked not to notify (5th arg false), one glass hint, sheet closed",
      args.length >= 1 && args.every((a) => a[0] === "apple_tv" && a[4] === false) && f.card.shadowRoot.querySelectorAll(".toast").length === 1 &&
      f.$(".toast").classList.contains("show") && /No text field selected/.test(f.$(".toast").textContent) && !f.$(".kb").classList.contains("show"), args.map((a) => a.length));
    f.card.remove();
    w.localStorage.clear();
    f = mount(w, { players: [{ entity: "media_player.lr_tv", platform: "webostv" }] }, states());
    f.$(".kbd").click();
    check("FOC10 webOS (no focus detection) -> keyboard button still opens the sheet", f.$(".kb").classList.contains("show") && !f.$(".toast").classList.contains("show"));
    f.card.remove();
    w.localStorage.clear();
  }

  // ---------------------------------------------------------------------------
  // Shortcuts (0.2.0, Grok Bot 11 Oct 2026): players[].shortcuts as a section of the More menu
  // ---------------------------------------------------------------------------
  {
    const H = C.helpers;
    const SC = () => [
      { name: "Search Films", icon: "mdi:magnify", prompt: "Search films", service: "kodi.call_method",
        data: { entity_id: "media_player.kodi", method: "GUI.ActivateWindow", window: "videos", parameters: ["plugin://plugin.video.example/?action=search&q={text_url}", "return"] } },
      { name: "Say", action: "search", service: "notify.tv", data: { message: "{{ text }} / {text} / {{ text | urlencode }}", title: "$text" } },
      { name: "My List", action: "call", service: "kodi.call_method", data: { entity_id: "media_player.kodi", method: "GUI.ActivateWindow", window: "videos", parameters: ["plugin://plugin.video.example/?action=list", "return"] } },
      { name: "Two steps", actions: [{ service: "script.turn_on", target: { entity_id: "script.a" } }, { action: "light.turn_off", target: { entity_id: "light.b" } }] },
    ];
    const n = H.normaliseShortcuts(SC(), 0);
    check("SC1 kinds: {text} data -> search (default), explicit search/call kept, no placeholder -> call",
      eq(n.map((x) => x.kind), ["search", "search", "call", "call"]));
    check("SC2 default icon: search shortcuts get the card's search icon, call shortcuts none; mdi: icon kept",
      n[0].icon === "mdi:magnify" && n[1].icon === "search" && n[2].icon === null && !!H.ICONS.search);
    const s0 = H.shortcutSteps(n[0], "the matrix & co");
    check("SC3 {text_url} URL-encodes the typed text inside a plugin URL",
      s0[0][0] === "kodi" && s0[0][1] === "call_method" && s0[0][2].parameters[0] === "plugin://plugin.video.example/?action=search&q=the%20matrix%20%26%20co" && s0[0][2].parameters[1] === "return");
    const s1 = H.shortcutSteps(n[1], "a b");
    check("SC4 {{ text }}, {text}, {{ text | urlencode }} and $text all substituted", s1[0][2].message === "a b / a b / a%20b" && s1[0][2].title === "a b", s1);
    const s3 = H.shortcutSteps(n[3]);
    check("SC5 actions list: several calls, target merged, HA-style action: key accepted",
      eq(s3, [["script", "turn_on", { entity_id: "script.a" }], ["light", "turn_off", { entity_id: "light.b" }]]));
    const bad = (sc) => { try { H.normaliseShortcuts([sc], 0); return false; } catch (e) { return true; } };
    check("SC6 validation: no name, no service, bad service, search without {text}, bad action, not a list",
      bad({ service: "a.b" }) && bad({ name: "x" }) && bad({ name: "x", service: "nodot" }) && bad({ name: "x", action: "search", service: "a.b", data: {} }) &&
      bad({ name: "x", action: "jump", service: "a.b" }) && (() => { try { H.normaliseConfig({ players: [{ entity: "media_player.kodi", shortcuts: {} }] }); return false; } catch (e) { return true; } })());
    check("SC7 shortcuts: false / absent -> no shortcuts; config normalises them per player",
      eq(H.normaliseShortcuts(false, 0), []) && H.normaliseConfig({ players: [{ entity: "media_player.kodi", shortcuts: SC() }] }).players[0].shortcuts.length === 4);

    // UI: in the More menu, first section, only for the active player
    w.localStorage.clear();
    const cfg = CONFIG(); cfg.players[1].shortcuts = SC();
    cfg.players[1].input = [{ entity: "media_player.avr", source: "UHD", triggers: ["shortcut"] }];
    let f = mount(w, cfg, states({ "media_player.avr": { attributes: { source: "PVR" } } }));
    check("SC8 Kodi active (has shortcuts): no new buttons in the card, More shown",
      f.card.activeEntity === "media_player.kodi" && !f.card.shadowRoot.querySelector(".shortcuts, .chips, [data-act^='shortcut']") && !f.$(".more").classList.contains("gone"));
    f.$(".more").click(); await sleep(10);
    let rows = [...f.card.shadowRoot.querySelectorAll(".menu .mi")];
    check("SC9 More menu: shortcuts first (in order), then the player's own items after a section gap",
      eq(rows.slice(0, 4).map((b) => b.querySelector(".nm").textContent), ["Search Films", "Say", "My List", "Two steps"]) &&
      rows.slice(0, 4).every((b) => b.classList.contains("sc")) && rows[4] && rows[4].classList.contains("grp") && rows[4].querySelector(".nm").textContent === "Subtitles" /* 0.2.2: Info is on the row for Kodi */ &&
      rows.filter((b) => b.classList.contains("grp")).length === 1);
    check("SC10 search shortcut shows the search icon; call shortcut has none; mdi without ha-icon -> no broken icon",
      !!rows[1].querySelector(".icon svg") && !rows[2].querySelector(".icon") && !rows[0].querySelector(".icon"));
    // call shortcut runs at once (input switch first)
    f.hass.calls.length = 0;
    rows[2].click(); await sleep(30);
    check("SC11 call shortcut: menu closes, input switch (triggers: [shortcut]) then the call; no sheet",
      !f.$(".menu-bg").classList.contains("show") && !f.$(".kb").classList.contains("show") &&
      eq(f.hass.calls.map((c) => c[0] + "." + c[1]), ["media_player.select_source", "kodi.call_method"]) && f.hass.calls[1][2].parameters[0].endsWith("action=list"), f.hass.calls);
    // search shortcut opens the typing sheet in search mode
    f.hass.calls.length = 0;
    f.$(".more").click(); await sleep(10);
    f.card.shadowRoot.querySelectorAll(".menu .mi")[0].click(); await sleep(10);
    const ta = f.$(".kb textarea");
    check("SC12 search shortcut: frosted typing sheet opens titled with the prompt, Send reads Search, nothing sent yet",
      f.$(".kb").classList.contains("show") && f.$(".kb-title").textContent === "Search films" && f.$(".kb-sub").textContent === "Kodi" &&
      f.$('[data-act="kb-send"]').textContent === "Search" && ta.placeholder === "Search" && ta.getAttribute("enterkeyhint") === "search" && f.hass.calls.length === 0);
    ta.value = "dune"; ta.dispatchEvent(new w.Event("input")); await sleep(300);
    check("SC13 typing in search mode sends nothing live to Kodi", f.hass.calls.length === 0, f.hass.calls);
    f.$('[data-act="kb-send"]').click(); await sleep(10);
    check("SC14 empty-text guard not hit; Search runs input switch + call with the URL-encoded text, sheet closes",
      !f.$(".kb").classList.contains("show") && eq(f.hass.calls.map((c) => c[0] + "." + c[1]), ["media_player.select_source", "kodi.call_method"]) &&
      f.hass.calls[1][2].parameters[0] === "plugin://plugin.video.example/?action=search&q=dune", f.hass.calls);
    f.hass.calls.length = 0;
    f.$(".more").click(); await sleep(10);
    f.card.shadowRoot.querySelectorAll(".menu .mi")[0].click(); await sleep(10);
    ta.value = "   "; ta.dispatchEvent(new w.Event("input"));
    ta.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Enter", bubbles: true })); await sleep(10);
    check("SC15 Enter with blank text: nothing sent, sheet stays open, glass hint shown",
      f.hass.calls.length === 0 && f.$(".kb").classList.contains("show") && /search/i.test(f.$(".toast").textContent));
    f.$('[data-act="kb-clear"]').click(); await sleep(10);
    check("SC16 Clear in search mode doesn't send an empty text to the player", f.hass.calls.length === 0);
    f.$('[data-act="close"]').click();
    // normal keyboard afterwards has its normal labels back
    f.$(".kbd").click(); await sleep(10);
    check("SC17 keyboard button after a search: labels back to Keyboard Input / Send / Type or dictate",
      f.$(".kb-sub").textContent === "Keyboard Input" && f.$('[data-act="kb-send"]').textContent === "Send" && ta.placeholder === "Type or dictate" && ta.getAttribute("enterkeyhint") === "send");
    f.$('[data-act="close"]').click();
    // another player active -> its own More menu, no shortcuts section
    f.card.remove(); w.localStorage.clear();
    f = mount(w, cfg, states({ "media_player.kodi": { state: "idle" }, "media_player.lr_tv": { attributes: { source: "Apple TV" } } }));
    f.$(".more").click(); await sleep(10);
    rows = [...f.card.shadowRoot.querySelectorAll(".menu .mi")];
    check("SC18 shortcuts only while that player is active (Apple TV active -> none, no section gap)",
      f.card.activeEntity === "media_player.lr_appletv" && rows.length > 0 && !rows.some((b) => b.classList.contains("sc") || b.classList.contains("grp")));
    f.card.remove(); w.localStorage.clear();
    // more: false + shortcuts -> More button still shown with only the shortcuts
    const cfg2 = { players: [{ entity: "media_player.kodi", platform: "kodi", more: false, shortcuts: [SC()[2]] }] };
    f = mount(w, cfg2, states());
    f.$(".more").click(); await sleep(10);
    rows = [...f.card.shadowRoot.querySelectorAll(".menu .mi")];
    check("SC19 more: false but shortcuts set -> More button shown with just the shortcuts",
      !f.$(".more").classList.contains("gone") && rows.length === 1 && rows[0].querySelector(".nm").textContent === "My List" && !rows[0].classList.contains("grp"));
    f.card.remove(); w.localStorage.clear();
    check("SC20 no add-on names in the card code (shortcuts are generic)", !/umbrella|trakt/i.test(SRC_NOW()));
  }

  // ---- IB: Info button on the pad's bottom row (0.2.1, Grok Bot 11 Oct 2026) -----------------------------
  // Regression: Evan "We've lost the info button?" - on Kodi, Info was only reachable inside More and the
  // row's 5th slot was empty. Info must sit in that slot whenever CH doesn't, and send the player's info key.
  {
    w.localStorage.clear();
    let f = mount(w, CONFIG(), states());
    const ib = () => f.$('.inner [data-key="info"]');
    check("IB1 Kodi active: Info button on the bottom row, visible", f.card.activeEntity === "media_player.kodi" && !!ib() && !ib().classList.contains("gone") && f.$(".ch").classList.contains("gone"));
    f.hass.calls.length = 0;
    ptr(w, ib(), "pointerdown"); ptr(w, ib(), "pointerup"); await sleep(50);
    check("IB2 Kodi Info button sends kodi.call_method Input.Info", f.hass.calls.some((c) => c[0] === "kodi" && c[1] === "call_method" && c[2].method === "Input.Info" && c[2].entity_id === "media_player.kodi"), f.hass.calls);
    const box = f.$(".inner"), kids = [...box.children].filter((el) => !el.classList.contains("gone"));
    check("IB3 Info is the right-hand slot (sources | -10 | more | +10 | info)", kids[kids.length - 1] === ib(), kids.map((k) => k.className));
    f.$(".more").click(); await sleep(10);
    // 0.2.2 (Grok Bot, 11 Oct 2026): Info is on the row, so it is no longer in Kodi's More menu (Evan: no duplicate)
    const kNames = [...f.card.shadowRoot.querySelectorAll(".menu .mi .nm")].map((n) => n.textContent);
    check("IB4 Kodi More menu has no Info (it's on the row); the rest is still there", !kNames.includes("Info") && kNames.includes("Subtitles") && kNames.includes("Context Menu"), kNames);
    f.card.remove(); w.localStorage.clear();
    // players with CH keep CH in that slot and Info stays in More
    f = mount(w, CONFIG(), states({ "media_player.kodi": { state: "idle" }, "media_player.lr_tv": { attributes: { source: "Apple TV" } } }));
    check("IB5 Apple TV active: CH shown, no row Info", f.card.activeEntity === "media_player.lr_appletv" && !f.$(".ch").classList.contains("gone") && ib().classList.contains("gone"));
    f.$(".more").click(); await sleep(10);
    check("IB9 Apple TV (CH, no Info button) keeps Info in More", [...f.card.shadowRoot.querySelectorAll(".menu .mi .nm")].some((n) => n.textContent === "Info"));
    f.card.remove(); w.localStorage.clear();
    const cfgOff = CONFIG(); cfgOff.players[1].info_button = false;
    f = mount(w, cfgOff, states());
    check("IB6 info_button: false hides it on Kodi", f.card.activeEntity === "media_player.kodi" && ib().classList.contains("gone"));
    f.$(".more").click(); await sleep(10);
    check("IB10 info_button: false -> Info back in Kodi's More menu", [...f.card.shadowRoot.querySelectorAll(".menu .mi .nm")].some((n) => n.textContent === "Info"));
    f.card.remove(); w.localStorage.clear();
    let threw = false; try { H.normaliseConfig({ players: [{ entity: "media_player.kodi", platform: "kodi", info_button: "yes" }] }); } catch (_) { threw = true; }
    check("IB7 info_button must be true or false", threw);
    const ids = (p) => H.moreItems(p, {}).map((x) => x.id);
    check("IB11 moreItems helper: Kodi default + custom list drop info; webOS keeps it; channels: true Kodi keeps it",
      !ids({ entity: "media_player.k", platform: "kodi" }).includes("info") && eq(ids({ entity: "media_player.k", platform: "kodi", more: ["info", "osd"] }), ["osd"]) &&
      ids({ entity: "media_player.t", platform: "webostv" }).includes("info") && ids({ entity: "media_player.k", platform: "kodi", channels: true }).includes("info"));
    check("IB8 helper: Kodi yes, webOS (CH) no, generic without remote no",
      H.hasInfoButton({ entity: "media_player.k", platform: "kodi" }, {}) && !H.hasInfoButton({ entity: "media_player.t", platform: "webostv" }, {}) &&
      !H.hasInfoButton({ entity: "media_player.g", platform: "generic" }, {}));
  }

  // URL pick (Sidebar Mini Player remote_path: /remote?player={entity})
  w.localStorage.clear();
  w.history.pushState(null, "", "/remote?player=media_player.bed_appletv");
  m = mount(w, CONFIG(), states());
  check("U1 ?player= picks that player", m.card.activeEntity === "media_player.bed_appletv");
  m.card.remove(); w.localStorage.clear();
  w.history.pushState(null, "", "/remote?player=media_player.not_configured");
  m = mount(w, CONFIG(), states());
  check("U2 unknown ?player= ignored", m.card.activeEntity === "media_player.kodi");
  m.card.remove(); w.history.pushState(null, "", "/remote");

  console.log(`\n${passes} passed, ${fails} failed`);
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
