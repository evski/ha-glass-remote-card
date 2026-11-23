// Models.swift - players, buttons and HA entity state for the watch remote.
// 2026-10-11
// Device routing lives in HA (script.remote_button); the app only names a
// logical button. EXAMPLE entity ids — replace to match your HA setup
// and ha/remote_button_script.yaml.

import Foundation

/// The players HA's sensor.remote_player can name, plus "auto" for the picker.
enum Player: String, CaseIterable, Identifiable {
    case auto = "auto"
    case loungeAppleTV = "media_player.lounge_apple_tv"
    case kodi = "media_player.kodi"
    case loungeTV = "media_player.lounge_tv"
    case bedroomAppleTV = "media_player.bedroom_apple_tv"

    var id: String { rawValue }

    var name: String {
        switch self {
        case .auto: return "Auto"
        case .loungeAppleTV: return "Lounge Apple TV"
        case .kodi: return "Kodi"
        case .loungeTV: return "Lounge TV"
        case .bedroomAppleTV: return "Bedroom Apple TV"
        }
    }

    var symbol: String {
        switch self {
        case .auto: return "wand.and.stars"
        case .loungeAppleTV, .bedroomAppleTV: return "appletv"
        case .kodi: return "play.rectangle"
        case .loungeTV: return "tv"
        }
    }

    /// Apple TV keyboard-focus sensor (HA apple_tv binary sensor), if any.
    var keyboardFocusEntity: String? {
        switch self {
        case .loungeAppleTV: return "binary_sensor.lounge_apple_tv_keyboard_focus"
        case .bedroomAppleTV: return "binary_sensor.bedroom_apple_tv_keyboard_focus"
        default: return nil
        }
    }

    /// Example: the bedroom Apple TV has no mute; the HA script treats it as a no-op.
    var hasMute: Bool { self != .bedroomAppleTV }

    /// LG's skip keys change speed instead of jumping 10 s.
    var skipIsTenSeconds: Bool { self != .loungeTV }
}

/// Logical buttons understood by script.remote_button.
enum RemoteButton: String {
    case up, down, left, right, select
    case back, backLong = "back_long"
    case home, homeLong = "home_long"
    case playPause = "play_pause"
    case skipBack = "skip_back", skipFwd = "skip_fwd"
    case info, subtitles, subtitlesLong = "subtitles_long"
    case volumeUp = "volume_up", volumeDown = "volume_down", mute
    case power
    case text
}

/// One HA entity state from GET /api/states/<entity_id>.
struct EntityState {
    let entityId: String
    let state: String
    let attributes: [String: Any]

    init?(json: Any) {
        guard let dict = json as? [String: Any],
              let id = dict["entity_id"] as? String,
              let st = dict["state"] as? String else { return nil }
        entityId = id
        state = st
        attributes = dict["attributes"] as? [String: Any] ?? [:]
    }

    func string(_ key: String) -> String? {
        guard let s = attributes[key] as? String, !s.isEmpty else { return nil }
        return s
    }

    var isOffLike: Bool { ["off", "standby", "unavailable", "unknown"].contains(state) }
}

/// What the now-playing pill shows (title, artwork, playing state).
struct NowPlaying: Equatable {
    var title: String
    var subtitle: String
    var artworkPath: String?
    var isPlaying: Bool
    /// Line 2 without the device name (the v2 screen shows the device in the
    /// title bar instead). 2026-10-20,
    var detail: String = ""
    /// True when there is a real title/app to show (not just the device name).
    var hasMedia: Bool = false

    static let empty = NowPlaying(title: "Remote", subtitle: "", artworkPath: nil, isPlaying: false)

    init(title: String, subtitle: String, artworkPath: String?, isPlaying: Bool) {
        self.title = title
        self.subtitle = subtitle
        self.artworkPath = artworkPath
        self.isPlaying = isPlaying
    }

    init(player: Player, state s: EntityState) {
        let series = s.string("media_series_title")
        let mediaTitle = s.string("media_title")
        let t = series ?? mediaTitle
        let shown = t ?? s.string("app_name") ?? s.string("source")
        // line 2: episode, else app name (if a title is showing), else the state
        let episode = series != nil ? mediaTitle : nil
        var sub = episode ?? (t != nil ? s.string("app_name") : nil) ?? s.state.replacingOccurrences(of: "_", with: " ")
        if s.state == "paused" && sub != "paused" { sub += " · paused" }
        title = shown ?? player.name
        subtitle = shown != nil ? "\(player.name) · \(sub)" : sub
        artworkPath = s.isOffLike ? nil : s.string("entity_picture")
        isPlaying = s.state == "playing"
        detail = shown != nil ? sub : ""
        hasMedia = shown != nil && !s.isOffLike
    }
}
