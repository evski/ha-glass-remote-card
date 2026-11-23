// WatchRemoteApp.swift - entry point for the Apple Watch remote.
// Standalone watchOS 10+ SwiftUI app that drives Home Assistant's
// script.remote_button (see ha/remote_button_script.yaml).
// 2026-10-11

import SwiftUI

@main
struct WatchRemoteApp: App {
    @StateObject private var store = RemoteStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(store)
                .preferredColorScheme(.dark)
        }
    }
}

struct RootView: View {
    @EnvironmentObject private var store: RemoteStore

    var body: some View {
        NavigationStack {
            if store.isConfigured {
                RemoteView()
            } else {
                SettingsView(isFirstRun: true)
            }
        }
    }
}
