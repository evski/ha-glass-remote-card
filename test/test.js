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
function fakeHass(st) {
  const calls = [];
  return { states: st, calls, callService: (d, s, data) => { calls.push([d, s, data]); return Promise.resolve(); } };
}
function mount(w, config, st) {
  const card = w.document.createElement("glass-remote-card");
  card.setConfig(config);
  w.document.body.appendChild(card);
  const hass = fakeHass(st);
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
  m.$(".mic").click();
  check("D17 mic opens the text box", m.$(".kb").classList.contains("show"));
  const ta = m.$(".kb textarea"); ta.value = "space"; ta.dispatchEvent(new w.Event("input")); await sleep(400);
  check("D18 Kodi: nothing sent while typing", m.hass.calls.length === 0);
  m.card.shadowRoot.querySelector('[data-act="kb-send"]').click();
  check("D19 Kodi: Send -> Input.SendText done", eq(m.hass.calls.pop(), ["kodi", "call_method", { entity_id: "media_player.kodi", method: "Input.SendText", text: "space", done: true }]));

  // Apple TV: live text + wants-text bar
  m.card.remove();
  m = mount(w, CONFIG(), states({ "media_player.kodi": { state: "idle" }, "media_player.lr_tv": { attributes: { source: "Apple TV" } }, "binary_sensor.lr_keyboard": { state: "on" } }));
  check("D20 Apple TV active via TV input", m.card.activeEntity === "media_player.lr_appletv");
  check("D21 wants-text bar shown", m.$(".wants").classList.contains("show") && /wants text/.test(m.$(".wants").textContent));
  m.$(".wants").click();
  const ta2 = m.$(".kb textarea"); ta2.value = "star"; ta2.dispatchEvent(new w.Event("input")); await sleep(400);
  check("D22 Apple TV: live set_keyboard_text", eq(m.hass.calls.pop(), ["apple_tv", "set_keyboard_text", { config_entry_id: "ENTRY1", text: "star" }]));
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
