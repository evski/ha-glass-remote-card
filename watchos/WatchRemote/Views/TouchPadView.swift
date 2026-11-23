// TouchPadView.swift - full-screen, invisible touch surface, like Apple's
// watchOS Remote app: no border, fill or outline. The whole screen behind the
// toolbar buttons is the "trackpad".
// swipe up/down/left/right = d-pad step, tap anywhere = select.
// Feedback (as Apple does): haptic click, plus a brief soft glow where you
// tapped, or the faint chevron on that side brightening for a swipe.
// v1 2026-10-11: rounded grey pad with edge-tap bands.
// v2 2026-10-20: borderless full screen; edge taps dropped (on a full-screen
// surface they fired arrows when you meant select near the edges, and Apple's
// remote is tap = select everywhere).

import SwiftUI

struct TouchPadView: View {
    @EnvironmentObject private var store: RemoteStore

    /// Last swipe direction, lit briefly on its chevron.
    @State private var lit: RemoteButton?
    /// Tap glow position + a token so repeated taps restart the fade.
    @State private var glowAt: CGPoint?
    @State private var glowToken = 0

    var body: some View {
        GeometryReader { geo in
            ZStack {
                // Hit-testable but visually nothing.
                Color.black.opacity(0.001)
                chevrons(in: geo.size)
                if let p = glowAt {
                    RadialGradient(colors: [Color.white.opacity(0.30), Color.white.opacity(0)],
                                   center: .center, startRadius: 0, endRadius: 46)
                        .frame(width: 92, height: 92)
                        .position(p)
                        .transition(.opacity)
                        .allowsHitTesting(false)
                }
            }
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 12)
                    .onEnded { value in
                        let dx = value.translation.width
                        let dy = value.translation.height
                        let b: RemoteButton = abs(dx) > abs(dy) ? (dx > 0 ? .right : .left)
                                                                : (dy > 0 ? .down : .up)
                        store.press(b)
                        light(b)
                    }
            )
            .onTapGesture(coordinateSpace: .local) { location in
                store.press(.select)
                glow(at: location)
            }
            .task { try? await Task.sleep(for: .milliseconds(400)); demo(in: geo.size) }
        }
        .accessibilityElement()
        .accessibilityLabel("Touch surface")
        .accessibilityHint("Swipe to move, tap to select")
        .accessibilityAddTraits(.allowsDirectInteraction)
        .accessibilityAction { store.press(.select) }
        .accessibilityAdjustableAction { direction in
            switch direction {
            case .increment: store.press(.up)
            case .decrement: store.press(.down)
            @unknown default: break
            }
        }
    }

    /// Apple-style faint chevrons hugging the centre text; the swiped one
    /// flashes. With now playing showing, up/down only appear as a flash so
    /// they don't sit on the artwork / title.
    private func chevrons(in size: CGSize) -> some View {
        let busy = store.showsMedia || store.keyboardFocused
        let w = min(size.width * 0.40, 86)
        let h: CGFloat = busy ? min(size.height * 0.36, 66) : 36
        return ZStack {
            chevron("chevron.compact.up", .up, hidden: busy).offset(y: -h)
            chevron("chevron.compact.down", .down, hidden: busy).offset(y: h)
            chevron("chevron.compact.left", .left).offset(x: busy ? -w : -64)
            chevron("chevron.compact.right", .right).offset(x: busy ? w : 64)
        }
        .position(x: size.width / 2, y: size.height / 2)
        .allowsHitTesting(false)
    }

    private func chevron(_ name: String, _ b: RemoteButton, hidden: Bool = false) -> some View {
        Image(systemName: name)
            .font(.system(size: 15, weight: lit == b ? .semibold : .regular))
            .foregroundStyle(Color.white.opacity(lit == b ? 0.9 : (hidden ? 0 : 0.22)))
            .scaleEffect(lit == b ? 1.25 : 1)
    }

    private func light(_ b: RemoteButton) {
        withAnimation(.easeOut(duration: 0.08)) { lit = b }
        Task {
            try? await Task.sleep(for: .milliseconds(260))
            withAnimation(.easeIn(duration: 0.25)) { if lit == b { lit = nil } }
        }
    }

    private func glow(at p: CGPoint) {
        glowToken += 1
        let token = glowToken
        withAnimation(.easeOut(duration: 0.06)) { glowAt = p }
        Task {
            try? await Task.sleep(for: .milliseconds(180))
            withAnimation(.easeIn(duration: 0.3)) { if glowToken == token { glowAt = nil } }
        }
    }

    /// Debug screenshots: hold a tap glow / swipe highlight on screen.
    private func demo(in size: CGSize) {
        switch store.demoScreen {
        case "tap": glowAt = CGPoint(x: size.width * 0.62, y: size.height * 0.58)
        case "swipe": lit = .right
        default: break
        }
    }
}
