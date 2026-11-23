// RemoteStore.swift - app state: settings, polling HA, sending button presses.
// All device routing happens in HA's script.remote_button; this only sends
// {button, text} and reads state for the now-playing pill and picker.
// 2026-10-11

import Foundation
import SwiftUI
import WatchKit

@MainActor
final class RemoteStore: ObservableObject {
    // MARK: Settings (base URL in UserDefaults, token in Keychain)
    @Published var baseURLString: String
    @Published private(set) var hasToken: Bool

    // MARK: Live state from HA
    @Published private(set) var activePlayer: Player = .loungeAppleTV
    @Published private(set) var target: Player = .auto
    @Published private(set) var nowPlaying: NowPlaying = .empty
    @Published private(set) var keyboardFocused = false
    @Published private(set) var lastError: String?
    @Published private(set) var volumeFlash: Int = 0   // +1 / -1 briefly after a crown step

    /// Simulator screenshot helper (Debug builds only): launch with
    /// `-demoScreen idle|picker|more|settings|volume|keyboard|tap|swipe` to open that state.
    /// Never sends anything to HA. 2026-10-20,
    #if DEBUG
    let demoScreen = UserDefaults.standard.string(forKey: "demoScreen")
    #else
    let demoScreen: String? = nil
    #endif

    /// Now playing has something to show (the `idle` demo forces the
    /// "SWIPE TO NAVIGATE" state for screenshots).
    var showsMedia: Bool { nowPlaying.hasMedia && demoScreen != "idle" }

    private static let urlKey = "ha_base_url"
    private static let tokenAccount = "ha_token"
    private static let seededKey = "ha_prefill_seeded"

    /// Serial chain so presses reach HA in the order they were made.
    private var chain: Task<Void, Never>?
    /// Crown steps waiting to be sent (+ up, - down), drained one HTTP call at a time.
    private var pendingVolume = 0
    private var volumeDrainer: Task<Void, Never>?
    private var errorClear: Task<Void, Never>?
    private var flashClear: Task<Void, Never>?

    init() {
        Self.seedFromBuildConfigIfNeeded()
        baseURLString = UserDefaults.standard.string(forKey: Self.urlKey) ?? ""
        hasToken = Keychain.read(Self.tokenAccount) != nil
    }

    var isConfigured: Bool { client != nil }

    /// First launch only: copy HABaseURL / HAToken (from the gitignored
    /// Config/Secrets.xcconfig via Info.plist) into UserDefaults / Keychain when
    /// nothing is saved yet. Runs once, so "Forget token" in Settings sticks.
    /// 2026-10-16
    private static func seedFromBuildConfigIfNeeded() {
        let defaults = UserDefaults.standard
        guard !defaults.bool(forKey: seededKey) else { return }
        let info = Bundle.main.infoDictionary ?? [:]
        let url = (info["HABaseURL"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let token = (info["HAToken"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !url.isEmpty || !token.isEmpty else { return }   // no prefill in this build
        if (defaults.string(forKey: urlKey) ?? "").isEmpty, HAClient.normalise(url) != nil {
            defaults.set(url, forKey: urlKey)
        }
        if Keychain.read(tokenAccount) == nil, !token.isEmpty {
            guard Keychain.write(token, account: tokenAccount) else { return }   // retry next launch
        }
        defaults.set(true, forKey: seededKey)
    }

    private var client: HAClient? {
        guard let url = HAClient.normalise(baseURLString),
              let token = Keychain.read(Self.tokenAccount), !token.isEmpty else { return nil }
        return HAClient(baseURL: url, token: token)
    }

    func artworkURL() -> URL? {
        guard let path = nowPlaying.artworkPath else { return nil }
        return client?.absoluteURL(for: path)
    }

    // MARK: Settings

    func save(baseURL: String, token: String?) {
        baseURLString = baseURL.trimmingCharacters(in: .whitespacesAndNewlines)
        UserDefaults.standard.set(baseURLString, forKey: Self.urlKey)
        if let token {
            let t = token.trimmingCharacters(in: .whitespacesAndNewlines)
            if !t.isEmpty { Keychain.write(t, account: Self.tokenAccount) }
        }
        hasToken = Keychain.read(Self.tokenAccount) != nil
        objectWillChange.send()
    }

    func forgetToken() {
        Keychain.delete(Self.tokenAccount)
        hasToken = false
    }

    /// One read-only call to check URL + token.
    func testConnection() async -> String {
        guard let client else { return HAError.notConfigured.localizedDescription }
        do {
            let s = try await client.state("sensor.remote_player")
            return "OK · \(Player(rawValue: s.state)?.name ?? s.state)"
        } catch {
            return error.localizedDescription
        }
    }

    // MARK: Polling (only while the app is in the foreground)

    func pollLoop() async {
        while !Task.isCancelled {
            await refresh()
            try? await Task.sleep(for: .seconds(3))
        }
    }

    func refresh() async {
        guard let client else { return }
        do {
            async let playerState = client.state("sensor.remote_player")
            async let targetState = client.state("input_select.remote_target")
            let (p, t) = try await (playerState, targetState)
            let player = Player(rawValue: p.state) ?? .loungeAppleTV
            activePlayer = player
            target = Player(rawValue: t.state) ?? .auto

            let mp = try await client.state(player.rawValue)
            let np = NowPlaying(player: player, state: mp)
            if np != nowPlaying { nowPlaying = np }

            if let focusId = player.keyboardFocusEntity,
               let f = try? await client.state(focusId) {
                keyboardFocused = f.state == "on" || demoScreen == "keyboard"
            } else {
                keyboardFocused = demoScreen == "keyboard"
            }
            if lastError != nil { lastError = nil }
        } catch is CancellationError {
            // view went away; ignore
        } catch let e as URLError where e.code == .cancelled {
            // ignore
        } catch {
            show(error)
        }
    }

    // MARK: Buttons

    func press(_ button: RemoteButton, text: String? = nil, submit: Bool = false, haptic: WKHapticType = .click) {
        WKInterfaceDevice.current().play(haptic)
        var data: [String: Any] = ["button": button.rawValue]
        if let text { data["text"] = text }
        if submit { data["submit"] = true }
        enqueue { client in
            try await client.call("script", "remote_button", data)
        }
    }

    func sendText(_ text: String, submit: Bool = false) {
        let t = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !t.isEmpty else { return }
        press(.text, text: t, submit: submit, haptic: .success)
    }

    /// Picker: writes input_select.remote_target (auto or a media_player id).
    func select(_ player: Player) {
        WKInterfaceDevice.current().play(.click)
        target = player
        enqueue { [weak self] client in
            try await client.call("input_select", "select_option",
                                  ["entity_id": "input_select.remote_target", "option": player.rawValue])
            await self?.refresh()
        }
    }

    // MARK: Digital Crown volume

    /// Called with +n / -n detent steps from the crown; coalesced and sent as
    /// individual volume_up / volume_down presses, one at a time.
    func crownSteps(_ steps: Int) {
        guard steps != 0 else { return }
        pendingVolume = max(-8, min(8, pendingVolume + steps))   // cap a fast spin
        flash(steps > 0 ? 1 : -1)
        guard volumeDrainer == nil else { return }
        volumeDrainer = Task { [weak self] in
            while let self, !Task.isCancelled, self.pendingVolume != 0 {
                let up = self.pendingVolume > 0
                self.pendingVolume += up ? -1 : 1
                if let client = self.client {
                    do {
                        try await client.call("script", "remote_button",
                                              ["button": up ? "volume_up" : "volume_down"])
                    } catch {
                        self.show(error)
                        self.pendingVolume = 0
                    }
                }
                try? await Task.sleep(for: .milliseconds(120))
            }
            self?.volumeDrainer = nil
        }
    }

    // MARK: Helpers

    private func enqueue(_ work: @escaping (HAClient) async throws -> Void) {
        guard let client else {
            show(HAError.notConfigured)
            return
        }
        let previous = chain
        chain = Task { [weak self] in
            await previous?.value
            do {
                try await work(client)
            } catch {
                self?.show(error)
            }
        }
    }

    private func show(_ error: Error) {
        lastError = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        WKInterfaceDevice.current().play(.failure)
        errorClear?.cancel()
        errorClear = Task { [weak self] in
            try? await Task.sleep(for: .seconds(4))
            if !Task.isCancelled { self?.lastError = nil }
        }
    }

    /// Debug screenshots only: hold the crown volume indicator on screen.
    func showDemoVolume() {
        volumeFlash = 1
    }

    private func flash(_ dir: Int) {
        volumeFlash = dir
        flashClear?.cancel()
        flashClear = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(1200))
            if !Task.isCancelled { self?.volumeFlash = 0 }
        }
    }
}
