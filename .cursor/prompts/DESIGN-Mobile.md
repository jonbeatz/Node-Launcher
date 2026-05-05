Generate a high-fidelity, production-ready React dashboard UI with Tailwind CSS for a Node.js process management desktop application called "Vader Project Engine (VPE)."

## Core Design System

### Colors (Strict Palette)
- Main Background: #121212
- Surface/Cards: #1c1c1c
- Accent (Vader Red): #e02b20
- Borders: #333333
- Text Primary: #FFFFFF
- Text Muted: #A0A0A0
- Terminal Background: #0a0a0a
- Focus Rings: 2px solid #e02b20

### Typography
- JetBrains Mono for all code, terminal, telemetry, and monospace data
- Space Grotesk for headlines and UI labels (fallback to system sans-serif)
- All pill badges and secondary labels use uppercase JetBrains Mono

### Shapes & Borders
- All containers: 0px border radius (sharp, brutalist)
- Exception: "9700x Tuned" pill badge uses fully rounded (pill-shaped) border
- Every container has a 1px solid #333333 border
- No soft shadows on standard containers

### Depth & Glass
- Elevated surfaces (modals, drawers) use backdrop-blur (12px-20px) over #1c1c1c at 80% opacity
- Active/high-priority elements use "vader-glow": 0px 0px 15px #e02b20
- Terminal areas include a subtle CRT scanline overlay: repeating 1px horizontal lines at #000000 2% opacity, 3px spacing
- Terminal areas also have an inner vignette: inset 0 0 100px rgba(0,0,0,0.6)

### Spacing
- Base unit: 4px
- Card gap: 20px
- Main content padding: 24px
- HUD inset from viewport edges: 2rem

---

## Global Layout

### HUD Frame
- 1px horizontal lines in Vader Red (#e02b20) at 30% opacity across the extreme top and bottom edges of the entire viewport
- These lines span full viewport width

### Top Bar
- Height: 48px
- Background: #1c1c1c
- Border-bottom: 1px solid #333333
- Left side: "VPE" logomark (small, bold, #FFFFFF) + dynamic breadcrumb in muted text (#A0A0A0): `VPE > Projects > MSC Media Pro`
- Right side: Settings gear icon

### Main Content Area
- flex-1, padding 24px, scrollable vertical
- Dark background #121212

### Footer
- Height: 32px
- Background: #1c1c1c
- Centered text in muted (#A0A0A0): "Powered by the MSC Media Engine"

---

## Dashboard Project Grid

Use CSS Grid: `grid-template-columns: repeat(auto-fill, minmax(320px, 1fr))` with 20px gap.

### Each Project Card
- Minimum width: 320px
- Background: #1c1c1c
- Border: 1px solid #333333
- Border-radius: 0px (sharp)
- On hover: transform scale(1.02), apply vader-glow shadow

#### Card Internal Layout (top to bottom):

**1. Thumbnail Area**
- 4:3 aspect ratio placeholder at the very top of the card
- Background: darker shade (#0a0a0a) with a subtle grid pattern
- Rounded top corners only (border-radius on top-left and top-right)
- Border-bottom: 1px solid #333333
- "9700x Tuned" pill badge positioned in the top-right corner of the thumbnail, overlapping slightly
  - Pill shape (fully rounded)
  - Background: #e02b20
  - Text: "9700x TUNED" in uppercase JetBrains Mono, color #000000, small font size
  - Border: 1px solid #333333

**2. Project Info Row**
- Padding: 12px 16px
- Project name: Bold, #FFFFFF, Space Grotesk, 16px
- Pulsing status LED: 8px circle (or square), color #e02b20, CSS animation pulsing between 40% and 100% opacity
- Port number: Muted text (#A0A0A0), JetBrains Mono
- Uptime: Muted text (#A0A0A0), JetBrains Mono

**3. Performance Sparkline Strip**
- Height: 40px
- Border-top: 1px solid #333333
- Border-bottom: 1px solid #333333
- Inside: A small sparkline/area chart showing a waveform in low-opacity Vader Red (#e02b20 at ~30% opacity)
- No axes, no labels, minimal ticks at edges only
- This represents CPU/RAM usage telemetry

**4. Action Button Row**
- Padding: 8px 16px
- Three pill-shaped buttons in a horizontal row:
  - START/STOP: Pill shape, 1px #333333 border, dark background, white text
  - REPAIR: Pill shape, 1px #333333 border, dark background, white text
  - NUKE: Pill shape, 1px #333333 border, dark background, white text
- All buttons: on hover, border turns #e02b20
- All buttons: focus-visible gets 2px solid #e02b20 ring with 2px offset

#### Card States
- Error state: Entire card border turns solid #e02b20, small warning icon appears next to project name, error message snippet in red
- Empty state (show one): Centered icon, text "Add a project to get started", CTA button

---

## Log Drawer (Right Panel)

- Slides out from the right edge
- Width: 420px
- Height: full viewport height (between the HUD top and bottom lines)
- Background: #1c1c1c at 80% opacity with backdrop-blur (16px)
- Border-left: 1px solid #333333
- Border-radius: 0px (sharp edges)

### Log Drawer Internal Layout:

**Tab Bar (top)**
- Horizontal row of tabs: "MEDIA_PRO_RENDER_V4", "MISC_PRIMARY_GATE", "VADER_BACKUP_NODE"
- Active tab: full #e02b20 background with white JetBrains Mono text
- Inactive tabs: transparent background, muted text (#A0A0A0), 1px bottom border #333333
- Close button (X icon) in top-right corner

**Terminal Area**
- Background: #0a0a0a
- Font: JetBrains Mono, 12px, #FFFFFF
- Full ANSI color support (green for success, red for errors, yellow for warnings)
- CRT scanline overlay: repeating 1px horizontal lines at #000000 2% opacity, 3px spacing
- Inner vignette: inset 0 0 100px rgba(0,0,0,0.6)
- Content: Scrolling system logs showing PM2 process output
- Search bar at bottom: "Ctrl+F to search logs" in muted text
- Copy button and Clear button as small icons

**Bottom Status Bar**
- Height: 24px
- Background: #1c1c1c
- Border-top: 1px solid #333333
- Shows: PM2 Process ID (e.g., "PID: 48291") and Runtime (e.g., "824H")
- Font: JetBrains Mono, 11px, #A0A0A0

---

## Vader Repair Suite (Modal)

### Modal Overlay
- Full screen, background: #000000 at 60% opacity
- Backdrop-blur: 4px

### Modal Container
- Centered on screen
- Max-width: 900px
- Width: 90vw (responsive)
- Background: #1c1c1c
- Border: 1px solid #333333
- Border-radius: 12px (one of the few rounded elements)
- Padding: 24px
- No shadow — defined by border only

### Modal Header
- Title: "VADER REPAIR" in uppercase Space Grotesk, bold, #FFFFFF
- File path breadcrumb: `src/app/page.tsx` in JetBrains Mono, #A0A0A0
- Close button (X icon) in top-right corner

### Diff Viewer (Split Pane)
- Left pane: "ORIGINAL (.vader-backup)" label in muted, JetBrains Mono
- Right pane: "PATCHED" label in muted, JetBrains Mono
- Both panes: background #0a0a0a, border 1px #333333
- Line numbers in each pane: #A0A0A0, JetBrains Mono, right-aligned
- Added lines: background rgba(0, 255, 0, 0.1), text #00ff00
- Removed lines: background rgba(255, 0, 0, 0.1), text #ff4444
- Font: JetBrains Mono, 13px

### Modal Footer Actions
- "APPLY FIX" button: Pill shape, solid #e02b20 background, white text, no border
- "UNDO" button: Ghost style, transparent background, 1px #333333 border, white text
- "CANCEL" button: Ghost style, transparent background, 1px #333333 border, muted text (#A0A0A0)

### Loading State
- While AST scan runs: show a skeleton diff viewer with pulsing placeholder lines
- Preview only appears after scan completes

---

## Privileged Action Feedback (Nuke Confirmation)

When the "NUKE" button is clicked:
- A smaller confirmation modal appears (centered, ~400px wide)
- Title: "CONFIRM NUKE" in Vader Red
- Body: Warning text explaining the destructive action
- This modal has a 2px solid #e02b20 border that pulses (CSS animation)
- The NUKE button inside this modal is solid #e02b20 with white text
- Cancel button is ghost style

---

## Toasts / Notifications

- Position: Top-right corner of the viewport
- Background: #1c1c1c
- Border-left: 3px solid #e02b20
- Text: #FFFFFF, JetBrains Mono
- Auto-dismiss after 4 seconds with a slide-out animation
- Used for: project started, project stopped, nuke completed, port conflict detected

---

## Accessibility Requirements
- All interactive elements: visible focus ring (2px solid #e02b20 with 2px offset) on :focus-visible
- All text meets WCAG AA contrast ratios
- Status conveyed through both color AND text labels (e.g., pulsing LED + "RUNNING" text)
- Touch targets minimum 44px

---

## What to Generate

Please generate the full dashboard as a single page, including:
1. The HUD frame (top and bottom red lines)
2. The Top Bar with breadcrumb
3. A project grid with 3-4 project cards showing different states (running, stopped, error, empty placeholder)
4. The Log Drawer open on the right side, showing terminal logs
5. The Footer with "Powered by the MSC Media Engine"

Make this look like a real, functional application — not wireframes. Use actual text, realistic project names, plausible uptimes, and real-looking terminal output.