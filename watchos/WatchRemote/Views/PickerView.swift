// PickerView.swift - which device the remote controls, styled like Apple's
// Remote device list (a card per device: icon tile, then the name in bold).
// Writes input_select.remote_target (auto or a media_player id) via
// input_select.select_option; HA's sensor.remote_player does the rest
// (a manual pick holds for 3 h, then Auto resumes).
// v1 2026-10-11; v2 2026-10-20 Apple-style cards.

import SwiftUI

struct PickerView: View {
    @EnvironmentObject private var store: RemoteStore
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                ForEach(Player.allCases) { player in
                    Button {
                        store.select(player)
                        dismiss()
                    } label: {
                        DeviceCard(player: player,
                                   isTarget: store.target == player,
                                   caption: caption(for: player))
                    }
                }
            }
            .navigationTitle("Devices")
        }
    }

    private func caption(for player: Player) -> String? {
        if player == .auto {
            return store.target == .auto ? "Now \(store.activePlayer.name)" : "Follows what's playing"
        }
        if store.activePlayer == player {
            return store.target == .auto ? "Active" : "Active · held 3 h"
        }
        return nil
    }
}

struct DeviceCard: View {
    let player: Player
    let isTarget: Bool
    let caption: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .top) {
                tile
                Spacer(minLength: 0)
                if isTarget {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 18))
                        .foregroundStyle(Color.accentColor)
                        .accessibilityLabel("Selected")
                }
            }
            VStack(alignment: .leading, spacing: 1) {
                Text(player.name)
                    .font(.system(size: 16, weight: .semibold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                if let caption {
                    Text(caption)
                        .font(.system(size: 12))
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
        }
        .padding(.vertical, 6)
    }

    /// White rounded tile with a black glyph, like Apple's Apple TV tile.
    private var tile: some View {
        RoundedRectangle(cornerRadius: 8, style: .continuous)
            .fill(player == .auto ? Color.accentColor : Color.white)
            .frame(width: 34, height: 34)
            .overlay(
                Image(systemName: player.symbol)
                    .font(.system(size: 16, weight: .medium))
                    .foregroundStyle(player == .auto ? Color.white : Color.black)
            )
    }
}
