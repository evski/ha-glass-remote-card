// MoreView.swift - the "…" sheet, like Apple's Remote More menu: a plain list
// of full-width rows with leading icons (Mute & Unmute, Captions, Power first,
// as Apple orders them), then the extras the Siri Remote has: -10 / +10 s,
// info, dictation, the long-press actions, volume buttons and Settings.
// Presented as a sheet, so watchOS adds the standard X close button.
// Everything goes through script.remote_button so HA picks the right service.
// v1 2026-10-11; v2 2026-10-20 Apple-style rows, mute moved here from the
// main screen.

import SwiftUI
import WatchKit

struct MoreView: View {
    @EnvironmentObject private var store: RemoteStore
    @Environment(\.dismiss) private var dismiss
    /// Debug screenshots only: push straight to Settings.
    var openSettings = false
    @State private var showSettings = false

    private var p: Player { store.activePlayer }

    var body: some View {
        List {
            Section {
                row("Mute & Unmute", "speaker.slash", .mute)
                    .disabled(!p.hasMute)
                row("Captions", "captions.bubble", .subtitles)
                row("Power", "power", .power, haptic: .directionDown)
            } header: {
                Text(p.name)
            } footer: {
                if !p.hasMute { Text("This player has no mute.") }
            }

            Section {
                row(p.skipIsTenSeconds ? "Back 10 s" : "Rewind",
                    p.skipIsTenSeconds ? "gobackward.10" : "backward.fill", .skipBack)
                row(p.skipIsTenSeconds ? "Forward 10 s" : "Fast forward",
                    p.skipIsTenSeconds ? "goforward.10" : "forward.fill", .skipFwd)
                row("Info", "info.circle", .info)
            }

            Section {
                TextFieldLink(prompt: Text("Text for \(p.name)")) {
                    Label("Dictate", systemImage: "mic")
                } onSubmit: { text in
                    store.sendText(text)
                }
                TextFieldLink(prompt: Text("Text, then Enter")) {
                    Label("Dictate + Enter", systemImage: "return")
                } onSubmit: { text in
                    store.sendText(text, submit: true)
                }
            } footer: {
                Text("Types into the open text field on \(p.name).")
            }

            Section("Hold actions") {
                row("Top menu", "chevron.left.2", .backLong)
                row(p == .kodi ? "Context menu" : (p == .loungeTV ? "TV menu" : "Control Center"),
                    "switch.2", .homeLong)
                if p == .kodi {
                    row("Next subtitle track", "captions.bubble.fill", .subtitlesLong)
                }
            }

            Section {
                row("Volume up", "speaker.plus", .volumeUp)
                row("Volume down", "speaker.minus", .volumeDown)
            } footer: {
                Text("Or turn the Digital Crown on the remote.")
            }

            Section {
                NavigationLink {
                    SettingsView(isFirstRun: false)
                } label: {
                    Label("Settings", systemImage: "gear")
                }
            }
        }
        .navigationDestination(isPresented: $showSettings) {
            SettingsView(isFirstRun: false)
        }
        .onAppear { if openSettings { showSettings = true } }
    }

    private func row(_ title: String, _ symbol: String, _ button: RemoteButton,
                     haptic: WKHapticType = .click) -> some View {
        Button { store.press(button, haptic: haptic) } label: {
            Label(title, systemImage: symbol)
        }
    }
}
