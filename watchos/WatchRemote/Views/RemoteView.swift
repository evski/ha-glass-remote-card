// RemoteView.swift - main screen, laid out like Apple's watchOS Remote app:
// top bar: devices (list) | time + device name | more (…)
// whole screen: invisible touch surface (swipe = d-pad, tap = select)
// centre: now playing (artwork, title, detail) or "SWIPE TO NAVIGATE"
// bottom bar: play/pause | back (large) | TV (home)
// Digital Crown = volume (AVR / TV / Apple TV, decided in HA, decided in HA), with
// Apple's green speaker + / - indicator by the crown.
// v1 2026-10-11; v2 2026-10-20 Apple Remote layout (mute moved into More,
// device picker on the top-left list button, borderless touch surface).
//

import SwiftUI

struct RemoteView: View {
    @EnvironmentObject private var store: RemoteStore
    @Environment(\.scenePhase) private var scenePhase

    @State private var showPicker = false
    @State private var showMore = false
    @State private var crown: Double = 0
    @State private var crownAnchor: Double = 0
    @FocusState private var crownFocused: Bool

    var body: some View {
        ZStack {
            TouchPadView()
                .ignoresSafeArea()
            centre
            VolumeIndicator()
            deviceName
        }
        .background(Color.black.ignoresSafeArea())
        // Digital Crown -> volume. Focus stays on the whole remote so the crown
        // always means volume while this screen is up.
        .focusable(true)
        .focused($crownFocused)
        .focusEffectDisabled()
        .digitalCrownRotation($crown, from: -100_000, through: 100_000, by: 1,
                              sensitivity: .low, isContinuous: false,
                              isHapticFeedbackEnabled: true)
        .onChange(of: crown) { _, newValue in
            let delta = newValue - crownAnchor
            let steps = Int(delta.rounded(.towardZero))
            if steps != 0 {
                crownAnchor += Double(steps)
                store.crownSteps(steps)
            }
        }
        .onAppear {
            crownFocused = true
            switch store.demoScreen {
            case "picker": showPicker = true
            case "more", "settings": showMore = true
            case "volume": store.showDemoVolume()
            default: break
            }
        }
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button { showPicker = true } label: {
                    Image(systemName: "list.bullet")
                }
                .accessibilityLabel("Devices")
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button { showMore = true } label: {
                    Image(systemName: "ellipsis")
                }
                .accessibilityLabel("More")
            }
            ToolbarItemGroup(placement: .bottomBar) {
                Button { store.press(.playPause) } label: { Image(systemName: "playpause.fill") }
                    .accessibilityLabel("Play or pause")
                Button { store.press(.back) } label: { Image(systemName: "chevron.left") }
                    .accessibilityLabel("Back")
                    .controlSize(.large)
                Button { store.press(.home) } label: { Image(systemName: "tv") }
                    .accessibilityLabel("TV, home")
            }
        }
        .sheet(isPresented: $showPicker) {
            PickerView()
        }
        .sheet(isPresented: $showMore) {
            NavigationStack {
                MoreView(openSettings: store.demoScreen == "settings")
            }
        }
        // Poll HA every 3 s, only while the app is in the foreground.
        .task(id: scenePhase == .active) {
            guard scenePhase == .active else { return }
            await store.pollLoop()
        }
    }

    /// What sits in the middle of the touch surface. Display only (taps pass
    /// through to the surface = select), except the keyboard link.
    @ViewBuilder
    private var centre: some View {
        if store.keyboardFocused {
            KeyboardLink()
                .padding(.horizontal, 18)
        } else if store.showsMedia {
            NowPlayingView()
                .allowsHitTesting(false)
        } else {
            Text("SWIPE TO\nNAVIGATE")
                .font(.system(size: 15, weight: .regular))
                .tracking(0.4)
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
                .allowsHitTesting(false)
        }
    }

    /// Device name under the clock, between the corner buttons, like Apple's
    /// "Living Roo…". Drawn by hand: a navigationTitle this long scrolls as a
    /// blue marquee on watchOS 26+. Errors replace it briefly (in red).
    private var deviceName: some View {
        GeometryReader { g in
            let sideInset: CGFloat = 52   // clear of the corner buttons
            Text(store.lastError ?? store.activePlayer.name)
                .font(.system(size: 15))
                .foregroundStyle(store.lastError == nil ? Color.secondary : Color.red)
                .lineLimit(1)
                .truncationMode(.tail)
                .frame(width: max(60, g.size.width - 2 * sideInset))
                .frame(maxWidth: .infinity)
                .padding(.top, 35)
                .animation(.default, value: store.lastError)
        }
        .ignoresSafeArea()
        .allowsHitTesting(false)
        .accessibilityLabel("Controlling \(store.activePlayer.name)")
    }
}

/// Now playing, centred and borderless like the Now Playing app: artwork,
/// title, then episode / app / state in secondary text.
struct NowPlayingView: View {
    @EnvironmentObject private var store: RemoteStore

    var body: some View {
        VStack(spacing: 4) {
            artwork
                .frame(width: 40, height: 40)
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            Text(store.nowPlaying.title)
                .font(.system(size: 15, weight: .semibold))
                .lineLimit(2)
                .multilineTextAlignment(.center)
                .minimumScaleFactor(0.85)
            if !store.nowPlaying.detail.isEmpty {
                Text(store.nowPlaying.detail)
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
        }
        .padding(.horizontal, 30)
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder
    private var artwork: some View {
        if let url = store.artworkURL() {
            AsyncImage(url: url) { phase in
                if let image = phase.image {
                    image.resizable().scaledToFill()
                } else {
                    deviceIcon
                }
            }
        } else {
            deviceIcon
        }
    }

    private var deviceIcon: some View {
        ZStack {
            Color.white.opacity(0.12)
            Image(systemName: store.activePlayer.symbol)
                .font(.system(size: 17))
                .foregroundStyle(.white.opacity(0.8))
        }
    }
}

/// Apple's crown volume indicator: green speaker plus a small + / - pill by
/// the crown, the half you turned towards lit green. Shown ~1 s per turn.
struct VolumeIndicator: View {
    @EnvironmentObject private var store: RemoteStore

    var body: some View {
        if store.volumeFlash != 0 {
            let up = store.volumeFlash > 0
            HStack(spacing: 4) {
                Image(systemName: up ? "speaker.wave.3.fill" : "speaker.wave.1.fill")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.green)
                VStack(spacing: 0) {
                    Image(systemName: "plus")
                        .foregroundStyle(up ? .green : .white.opacity(0.5))
                    Capsule().fill(.white.opacity(0.25)).frame(width: 8, height: 1)
                        .padding(.vertical, 3)
                    Image(systemName: "minus")
                        .foregroundStyle(up ? .white.opacity(0.5) : .green)
                }
                .font(.system(size: 9, weight: .bold))
                .padding(.vertical, 5)
                .frame(width: 14)
                .background(Capsule().fill(.white.opacity(0.14)))
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
            .padding(.top, 2)
            .padding(.trailing, 0)
            .transition(.opacity)
            .allowsHitTesting(false)
            .accessibilityLabel(up ? "Volume up" : "Volume down")
        }
    }
}

/// Shown in the centre while an Apple TV has a text field focused
/// (binary_sensor.<player>_keyboard_focus). Native TextFieldLink, so
/// dictation, Scribble and the iPhone keyboard all work.
struct KeyboardLink: View {
    @EnvironmentObject private var store: RemoteStore

    var body: some View {
        VStack(spacing: 6) {
            TextFieldLink(prompt: Text("Type or dictate")) {
                Label("Type", systemImage: "keyboard")
                    .font(.system(size: 15, weight: .semibold))
            } onSubmit: { text in
                store.sendText(text)
            }
            Text("Text field open on \(store.activePlayer.name)")
                .font(.system(size: 11))
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .allowsHitTesting(false)
        }
    }
}
