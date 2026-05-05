\---

name: vader-project-engine

description: Ultimate technical and aesthetic authority for the Vader Project Engine (VPE). Combines Jedi Dashboard Magic, NovaMira precision, and Master UI/UX quality gates. Activate for Electron, Next.js, PM2, Studio Dark UI, Suspense repair, or Vader hardware optimization.

version: 2.0

\---



\# SKILL.md: Vader Project Engine (VPE) — Master Skill



\## Skill Metadata

\- \*\*Skill Name:\*\* Vader Project Engine (VPE)

\- \*\*Version:\*\* 2.0

\- \*\*Author:\*\* Jon Beatz (MSC)

\- \*\*Source Files:\*\* `Node-Launcher-PRD.md`, `Node-Launcher-Stitch-Prompt.md`, `.cursorrules`, `.cursor/docs/TRUTH.md`



\## Activation Triggers

Activate this skill when the user:

\- Mentions "VPE," "Vader Project Engine," or "Node-Launcher"

\- Requests Next.js Suspense patching, PM2 process management, or Electron app development

\- References "Vader Protocol," "Studio Dark," "Vader Shield," or "MSC Media Engine"

\- Asks about Electron security (contextBridge), port conflict resolution, or AST-based code repair

\- Works on the Vader hardware (Ryzen 9700x / Gigabyte B650)

\- Needs UI/UX review against the Master Quality Gate

\- Performs deep architectural shifts or final quality-gate reviews



\## Agent Guardrails (Behavioral Constraints)

When this skill is active, ALWAYS:

\- Enforce Vader Shield security: `contextBridge` isolation, `nodeIntegration: false`, no direct Node access in renderer

\- Prioritize the AST diff-and-backup workflow when suggesting code modifications

\- Never suggest global PM2 installations; always reference the bundled programmatic API

\- Use `tree-kill` for any process termination discussion

\- Apply the Vader Protocol color palette and design tokens verbatim

\- Include "Powered by the MSC Media Engine" in any footer implementation

\- Prefix custom CSS classes with `msc-` and custom functions with `msc\_`

\- Default to Windows 11 25H2 paths and optimizations unless otherwise specified

\- Enforce the Master Quality Gate before marking any UI task as complete



\---



\## 1. Core Competencies \& Logic



The VPE is a specialized execution environment designed for high-performance Node.js management. It possesses the following primary capabilities:



\### 1.1 Process Orchestration (PM2 Programmatic)

\- \*\*Persistent Management:\*\* Starts, stops, and restarts Node/Next.js processes using a bundled PM2 API that survives UI reloads.

\- \*\*State Reconciliation:\*\* On startup, performs a deep sync between `pm2.list()` and the `projects.json` registry to ensure UI status accuracy.

\- \*\*Zombie Prevention:\*\* Uses `tree-kill` to ensure all child processes are fully terminated, preventing orphaned background tasks.



\### 1.2 Port \& Environment Intelligence

\- \*\*Conflict Resolution:\*\* Proactively scans OS ports before launch; if a conflict is detected, executes auto-increment logic (up to 10 attempts).

\- \*\*Dependency Automation (The "Nuke"):\*\* Deep-cleans project environments by deleting `node\_modules` and `.next` directories before triggering a clean install via the detected package manager.



\### 1.3 Vader Repair Suite (AST Transformation)

\- \*\*Suspense Patching:\*\* Scans project files using Abstract Syntax Tree (AST) analysis to identify missing `<Suspense>` boundaries required by Next.js 15 for `useSearchParams`.

\- \*\*Safe Patching Lifecycle:\*\* Automatically generates `.vader-backup` files and provides a side-by-side diff view for user confirmation before applying fixes.



\---



\## 2. The Jedi Aesthetic (Vader Protocol Design Philosophy)



Maintain a calm, premium, and dense command center feel using "Studio Dark" principles.



\### 2.1 Visual Tokens (Absolute Truth)

\- \*\*Palette:\*\* Background #121212 | Surface #1c1c1c | Accent (Vader Red) #e02b20 | Border #333333

\- \*\*Text:\*\* High Contrast White (#FFFFFF) | Muted (#A0A0A0)

\- \*\*Typography:\*\* JetBrains Mono for all terminal/code/monospace contexts

\- \*\*Glow:\*\* `vader-glow`: `0 0 15px rgba(224, 43, 32, 0.4)`

\- \*\*Focus Rings:\*\* 2px solid #e02b20 on all interactive elements



\### 2.2 Design Principles

\- \*\*Surface Layering:\*\* Avoid flat all-black stacks; use 2-4 neutral surface steps (Background #121212 → Surface #1c1c1c).

\- \*\*Border Hierarchy:\*\* Prioritize subtle 1px borders (#333333) over heavy shadows to define structure.

\- \*\*Accent Scarcity:\*\* Use Vader Red (#e02b20) strictly for active meaning, pulsing status, and primary actions; do not flood surfaces with accent colors.

\- \*\*Glassmorphism:\*\* Use `backdrop-blur` selectively for elevated regions (Log Drawer) with a 1px CRT scanline overlay at 2% opacity.



\### 2.3 Key UI Components

\- \*\*HUD Framing:\*\* 1px horizontal Vader Red lines (#e02b20 at 30% opacity) at extreme top/bottom edges of the application window.

\- \*\*Project Cards:\*\* 320px min-width, 4:3 WebP thumbnails, pulsing status LEDs (8px, #e02b20), 40px sparkline strip with hairline border (#333) and low-opacity Vader Red waveform.

\- \*\*Log Drawer:\*\* 420px width, glassmorphic surface (bg #1c1c1c at 80% opacity), `backdrop-blur`, CRT scanline overlay, inner-vignette shadow.

\- \*\*Interactive Terminal:\*\* Full ANSI color support via `xterm.js` and `node-pty`, allowing a native terminal experience within the dashboard.

\- \*\*Vader Repair Suite (Modal):\*\* Centered modal (max-width 900px), diff viewer split pane with syntax highlighting (additions green, removals red).

\- \*\*Privileged Actions:\*\* Confirmation modals for destructive operations display a 2px pulsing Vader Red border; action button turns solid #e02b20 with white text.



\---



\## 3. Command Center Interaction Model



\- \*\*Stable Base:\*\* The Vader Grid dashboard must remain a stable base layer; use overlay-first focus workflows for project details.

\- \*\*Modality Parity:\*\* All interactions must work across keyboard, pointer (hover/active), and touch (targets ≥ 44px).

\- \*\*Predictable Escape:\*\* Dialogs must close back to drawers, and drawers must close back to the dashboard.

\- \*\*Nested Actions:\*\* Use centered modal dialogs for high-impact confirmation (like "Nuke"), featuring a 2px pulsing Vader Red border.



\---



\## 4. Master UI/UX Quality Gate (Ship-Blocking)



Before calling any UI task "Done," verify these criteria:



\- \*\*State Completeness:\*\* Component must have `default`, `hover`, `focus-visible`, `active`, `disabled`, `loading`, `error`, and `empty` states.

\- \*\*Accessibility Gate:\*\* Semantic HTML required; `:focus-visible` must be a 2px solid #e02b20 ring; screen reader labels must be present.

\- \*\*Anti-Pattern Check:\*\* No layout shifts on hover; no horizontal scroll on mobile; no hardcoded hex values outside the Vader palette.

\- \*\*Contrast Compliance:\*\* All interactive elements meet WCAG AA contrast ratios.

\- \*\*Status Redundancy:\*\* Status conveyed through both color and text/iconography (e.g., "Running" label alongside LED).



\---



\## 5. Error Handling \& Resilience Philosophy



VPE is designed to be a reliable command center. The following principles govern all error handling:



\### 5.1 User Feedback

\- \*\*Toasts:\*\* Top-right corner, dark background with red left accent border, auto-dismiss after 4 seconds (for start, stop, nuke, port-lock failures).

\- \*\*Card Alerts:\*\* PM2 crash loops or exhausted port increments flagged directly on the project card (red border + warning icon + error snippet).

\- \*\*Global Error Boundary:\*\* Top-level React fallback UI for uncaught render failures with a recovery option.



\### 5.2 State Resilience

\- \*\*Process Survival:\*\* UI restarts never kill running dev servers; PM2 daemon lives in Electron main process.

\- \*\*Registry Integrity:\*\* `projects.json` is the single source of truth; reconciled against live PM2 state on every startup.

\- \*\*Backup-First Repair:\*\* No code modification occurs without a `.vader-backup` snapshot; all repairs are one-click undoable.



\---



\## 6. Documentation Operations \& Constitutional Authority



\- \*\*Hierarchy:\*\* `TRUTH.md` is the Constitution; `.cursorrules` is the Legal Code; `package.json` is Command Truth.

\- \*\*Low-Drift Updates:\*\* If a command, path, or UI token changes, you \*\*must\*\* update all relevant documentation (README, TRUTH, START-HERE) in the same session.

\- \*\*Milestone Discipline:\*\* Add snapshot entries to `Session-Snapshots.md` and restore points to `Restore-Points.md` for every meaningful milestone.



\---



\## 7. Data Architecture



\### 7.1 Project Registry (`projects.json`)

The canonical project data structure:

```json

{

&#x20; "projects": \[

&#x20;   {

&#x20;     "id": "uuid-v4",

&#x20;     "path": "string (absolute path)",

&#x20;     "displayName": "string",

&#x20;     "portLock": "boolean",

&#x20;     "preferredPort": "number",

&#x20;     "detectedPackageManager": "npm | yarn | pnpm",

&#x20;     "detectedStartScript": "string (e.g., 'dev')",

&#x20;     "status": "running | stopped",

&#x20;     "lastThumbnail": "string (relative path)",

&#x20;     "createdAt": "ISO8601",

&#x20;     "lastLaunched": "ISO8601"

&#x20;   }

&#x20; ]

}







