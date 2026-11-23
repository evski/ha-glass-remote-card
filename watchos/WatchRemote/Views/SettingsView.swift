// SettingsView.swift - HA base URL + long-lived access token.
// URL is kept in UserDefaults, the token only in the Keychain.
// Tip: tap the token field, then use the "Apple Watch Keyboard Input"
// notification on the iPhone to paste the token from the iPhone clipboard.
// 2026-10-11

import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var store: RemoteStore
    @Environment(\.dismiss) private var dismiss
    let isFirstRun: Bool

    @State private var url = ""
    @State private var token = ""
    @State private var status: String?
    @State private var testing = false

    var body: some View {
        Form {
            Section {
                TextField("https://homeassistant.example.com", text: $url)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)
            } header: {
                Text("Home Assistant URL")
            }

            Section {
                SecureField(store.hasToken ? "Saved · enter to replace" : "Paste token", text: $token)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)
                if store.hasToken {
                    Button("Forget token", role: .destructive) {
                        store.forgetToken()
                        status = nil
                    }
                }
            } header: {
                Text("Long-lived access token")
            } footer: {
                Text("Create it in HA: Profile > Security > Long-lived access tokens. Stored only in this watch's Keychain.")
            }

            Section {
                Button(isFirstRun ? "Save and start" : "Save") {
                    store.save(baseURL: url, token: token.isEmpty ? nil : token)
                    token = ""
                    if !isFirstRun { dismiss() }
                }
                .disabled(HAClient.normalise(url) == nil || (!store.hasToken && token.isEmpty))

                Button {
                    testing = true
                    store.save(baseURL: url, token: token.isEmpty ? nil : token)
                    token = ""
                    Task {
                        status = await store.testConnection()
                        testing = false
                    }
                } label: {
                    if testing { ProgressView() } else { Text("Test connection") }
                }
                .disabled(testing || HAClient.normalise(url) == nil)

                if let status {
                    Text(status).font(.caption2).foregroundStyle(.secondary)
                }
            }
        }
        .navigationTitle("Settings")
        .onAppear { url = store.baseURLString }
    }
}
