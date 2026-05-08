# 🛸 Vader Project Engine (VPE) v2.0
> **Master Execution Plan: Command Center for High-Performance Node.js Development**

The **Vader Project Engine (VPE)** is a tactical desktop command center designed to eliminate terminal clutter and automate repetitive build repairs for the **My Studio Channel (MSC)** workflow. It is engineered specifically for the **Vader** workstation (AMD Ryzen 9700x / Gigabyte B650) to deliver a process-aware interface for modern web development.

---

## 🏛 1. The Constitution (Source of Truth)
To maintain architectural integrity, all development must follow this strict hierarchy of authority:
1. **.cursor/docs/TRUTH.md**: The Constitution (Non-negotiable principles).
2. **.cursorrules**: The Legal Code (Current enforcement rules and guardrails).
3. **SKILL.md**: Agent Identity (VPE technical manifest and behavioral constraints).
4. **Node-Launcher-PRD.md**: Feature and requirement truth.
5. **package.json**: Authority for executable scripts only.

**Current release (npm):** **`1.2.3`** in root **`package.json`**. **Packaging pipeline:** **`npm run vader:sync`** runs **`vader:dev`** with **`--success last`** so npm waits for **full** dev process teardown, then **`vader:post-dev-forge`**: stall watchdog (**`scripts/vpe-forge-stall-watchdog.cjs`**) + **3s** pause via **`node scripts/vpe-forge-pause.cjs`**, then **`vpe:take-state-snapshot`**, **`vpe:check-readiness`**, **`build:win`**, and **`vpe:cleanup-dist`**. **`npm run vader:dev-to-forge`** chains **`vader:dev`** → **`vader:post-dev-forge`** without **`rimraf`**; **`npm run vader:clean-sync`** runs **`node scripts/vpe-clean-sync.cjs`** (**`rimraf dist`**, **`vader:dev`** detached ~**10s** window → forge tail). **`v1.2.3+`** NET LED is **always green in dev** (IPC override **3000 / 3001 / 9222**); **`before-quit`** sweep + **`Purge env`** still clear real listeners. Full command table: **`.cursor/docs/VPE-BUILD-PROTOCOL.md`**.

---

## 🛠 2. Technical Core & Architecture

### **Local development URL**
When you run **`npm run dev`**, the Node-Launcher shell (Electron + renderer) is served at **`http://localhost:3000`**. Registered managed projects must use **higher ports** (for example `3001+`), not `3000`.

### **The Tech Stack**
| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Shell / Container** | **Electron 28+** | Native filesystem access, IPC security, and tray integration. |
| **Process Management** | **PM2 Programmatic API** | Daemon-less persistence; dev servers survive UI restarts. |
| **Frontend UI** | **Next.js 15+ Static Export** | React-based dashboard served locally for maximum performance. |
| **Styling** | **Tailwind CSS** | Vader Protocol design system (Studio Dark aesthetic). |
| **Automation** | **Puppeteer-core** | Headless thumbnails using Electron’s built-in Chromium. |
| **Terminal** | **xterm.js + node-pty** | Interactive, per-project terminal with full ANSI support. |

### **2.5 Data Architecture**
The logical project registry structure is defined in **.cursorrules §11** (`projects.json` schema). Canonical runtime persistence is stored under **`app.getPath('userData')/vpe-db`** (SQLite with JSON fallback/migration support).
* **Persistence**: Projects persist with absolute paths, detected package manager, and specific start scripts.
* **Preferences**: Metadata includes port lock preferences, preferred ports, and creation/launch timestamps.
* **State**: Live runtime status (running/stopped) is synchronized with the PM2 API on every session start.

### **Vader Shield Security**
* **Strict Isolation**: Full context isolation via `contextBridge` with `nodeIntegration: false`.
* **Zero Node Access**: No direct Node.js imports (`fs`, `path`, `child_process`) are permitted in the renderer.
* **Privileged Gate**: All system-level operations must be exposed only through secure preload scripts.

---

## 🎨 3. The Vader Protocol (Design System)
The UI follows a tactical "Studio Dark" and "Glassmorphic" aesthetic engineered for focus.

### **Core Visual Tokens**
* **Palette**: Main Background `#121212`, Surface Area `#1c1c1c`, Accent (Vader Red) `#e02b20`.
* **HUD Frame**: 1px horizontal Vader Red lines (#e02b20) at 30% opacity on extreme top/bottom edges.
* **Shadow**: `vader-glow` (0 0 15px rgba(224, 43, 32, 0.4)) for active states and hovers.
* **Typography**: **JetBrains Mono** for all terminal, code, and monospace data contexts.

### **Layout & Responsiveness**
* **Desktop Grid**: `repeat(auto-fill, minmax(320px, 1fr))` with 20px gap.
* **Mobile/Tablet**: Transitions to single-column; log drawer becomes full-screen overlay.
* **Accessibility**: All touch targets ≥ 44px with visible 2px #e02b20 focus rings.

### **Key Components**
* **Vader Cards**: 320px minimum width featuring 4:3 WebP thumbnails and pulsing status LEDs.
* **Performance Strip**: 40px hairline strip (#333) with low-opacity Vader Red sparkline waveforms for CPU/RAM.
* **Log Drawer**: 420px width glassmorphic surface; System Log text viewport is plain HTML (`#121212`) with ANSI/CLIXML stripping and no overlay on text.

---

## ⚡ 4. Master Command Protocols

### **The "Nuke" Suite**
A catastrophic reset protocol for broken environments. It **MUST** follow this sequence:
1. **tree-kill**: Guarantee the existing process and all sub-processes are terminated.
2. **Purge**: Delete `node_modules` and `.next` directories.
3. **Rebuild**: Execute a clean install via the detected package manager (npm, yarn, or pnpm).
4. **Snapshot**: Re-capture the thumbnail via Puppeteer once an HTTP 200 health check is verified.

### **Vader Repair (AST Suite)**
Automated patching for Next.js 15 Suspense boundaries.
* **Safe Patching**: Always generate a `.vader-backup` copy before any code modification.
* **Diff Requirement**: Present a "before" and "after" diff viewer split pane for explicit user confirmation.
* **Target**: Resolves `missing-suspense-with-csr-bailout` errors by wrapping `useSearchParams` or `useParams` components.

---

## 🚀 5. Hardware & OS Optimization (Ryzen 9700x)
* **Thread Management**: Offload intensive AST scanning and Puppeteer tasks to background worker threads to maintain a fluid 60fps UI.
* **Win11 25H2 Tuning**: Batch file I/O and whitelist paths to reduce the performance impact of Windows Defender scanning.
* **Port Intelligence**: Proactively scan ports and implement auto-increment logic (up to 10 attempts) for occupied ports.

---
**Author:** Jon Beatz (MSC)  
**Status:** Approved / Final v2.0  
*Powered by the MSC Media Engine*