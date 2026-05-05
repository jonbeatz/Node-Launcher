# 🛸 Vader Project Engine (VPE): System UI Specification v2.1

| Role | Domain | System |
| :--- | :--- | :--- |
| Senior UI/UX Engineer | Studio Dark / Glassmorphism | Vader Protocol |

---

## 🎨 Core Aesthetic (The Vader Protocol)
*   **Palette**: 
    *   Main Background: `#121212`
    *   Surface Areas: `#1c1c1c`
    *   Accent/Primary Action: `#e02b20` (Vader Red)
    *   Text: `#FFFFFF`
*   **Atmosphere**: Tactical, professional, high-tech command center merged with a modern IDE aesthetic.
*   **Styling**: 
    *   1px borders (`#333333`)
    *   Subtle red glows (`vader-glow`) for active states
    *   Semi-transparent dark glass for modals

---

## 🏗️ Global Layout & Framing
*   **HUD Frame**: Faint, 1px horizontal 'HUD' lines across the extreme top edge of the Top Bar and extreme bottom edge of the Footer in Vader Red (`#e02b20`) at 30% opacity.
*   **Top Bar**: 
    *   Height: 48px
    *   Style: `bg-vader-surface`, border-bottom 1px `#333`
    *   Content: "VPE" logomark + dynamic breadcrumb (`VPE > Projects > MSC Media Pro`) in muted text; Right side: settings icon.
*   **Main Content Area**: `flex-1`, padding 24px, scrollable vertical.
*   **Footer**: 32px, centered, `bg-vader-surface` / text-muted, "Powered by the MSC Media Engine".

---

## 📊 Dashboard Project Grid
*   **Grid System**: Responsive grid using `repeat(auto-fill, minmax(320px, 1fr))` with a 20px gap.
*   **Project Cards**:
    *   **Visuals**: 4:3 WebP thumbnail at top, border-radius top only, border-bottom 1px `#333`.
    *   **Telemetry**: Project name (bold, `#FFF`), pulsing status LED (8px circle, `#e02b20` pulse), port, and uptime indicators.
    *   **Performance Strip**: 40px hairline strip (`#333`) featuring a low-opacity Vader Red sparkline waveform for real-time CPU/RAM monitoring.
    *   **Hardware Badge**: Top-right corner pill: "9700x Tuned" in `#A0A0A0` text with a `#1c1c1c` background.
    *   **Actions**: Pill-shaped buttons for **Start/Stop**, **Repair**, and **Nuke**.
    *   **Interaction**: `scale-102` on hover with a `shadow-vader-glow` effect.

---

## 🖥️ Log Drawer (Right Panel)
*   **Structure**: Slides out from the right, 420px width, backdrop-blur glassmorphic surface (`bg #1c1c1c/80`).
*   **Navigation**: Tab bar at the top to switch context between different running projects.
*   **Terminal**: Background `#0a0a0a`, JetBrains Mono font, full ANSI color support.
*   **Overlay**: 1px horizontal scanline pattern (2% opacity) and an inner-vignette shadow for visual focus.
*   **Status**: Bottom bar displaying active PM2 process ID and current runtime.

---

## 🛡️ Vader Repair Suite (Modal)
*   **Container**: Centered modal, max-width 900px, `bg-vader-surface`, 1px `#333` border, `rounded-xl`.
*   **Privileged Feedback**: High-impact confirmation modals (e.g., Nuke) display a 2px pulsing Vader Red border.
*   **Diff Viewer**: Split-pane view with syntax highlighting: **Green** for additions and **Red** for removals.
*   **Footer Actions**: Primary "Apply Fix" pill (Vader Red) and secondary "Undo" ghost button.

---

## ♿ Accessibility & Signature
*   **Compliance**: All interactive elements meet WCAG AA contrast standards with visible focus rings (2px `#e02b20`).
*   **Final Signature**: "Powered by the MSC Media Engine" in muted text, consistently placed in the footer.