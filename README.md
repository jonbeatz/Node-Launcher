# 🛸 Vader Project Engine (VPE)

[![Build: CI](https://github.com/jonbeatz/Node-Launcher/actions/workflows/ci.yml/badge.svg)](https://github.com/jonbeatz/Node-Launcher/actions/workflows/ci.yml)

> **MSC Media Engine — workspace `package.json` `1.9.9`** (Station Prime; UI/dashboard notes through **v1.9.x** in [`VADER_STATION_LOG.md`](VADER_STATION_LOG.md); build branch history in [`.cursor/docs/guides/Checkpoint.md`](.cursor/docs/guides/Checkpoint.md))
> **Master Execution Plan:** Command Center for high-performance Node.js development

The **Vader Project Engine (VPE)** is a tactical desktop command center designed to eliminate terminal clutter and automate repetitive build repairs for the **My Studio Channel (MSC)** workflow. It is engineered specifically for the **Vader** workstation (AMD Ryzen 9700x / Gigabyte B650) to deliver a process-aware interface for modern web development.

---

## 🏛 1. The Constitution (Source of Truth)
**New session / cold start:** say **Start Project** in chat or follow **[`.cursor/prompts/Start-Project.md`](.cursor/prompts/Start-Project.md)** — then **[`.cursor/docs/guides/START-HERE.md`](.cursor/docs/guides/START-HERE.md)** and **[`.cursor/docs/core/AGENT-BOOT.md`](.cursor/docs/core/AGENT-BOOT.md)**.

To maintain architectural integrity, all development must follow this strict hierarchy of authority:
1. **`.cursor/docs/core/TRUTH.md`**: The Constitution (Non-negotiable principles).
2. **`.cursorrules`**: The Legal Code (Current enforcement rules and guardrails).
3. **`.cursor/docs/core/VPE_ENGINE_CAPABILITIES.md`**: Agent identity, hooks/prompts index, and guardrails (replaces root **`SKILL.md`**).
4. **`.cursor/docs/guides/PRD.md`**: Feature and requirement truth.
5. **`package.json`**: Authority for executable scripts only.

**Current release (npm):** **`1.9.9`** — follow root **`package.json`** (preload **`vpeInfo.version`**, footer, **`layout.tsx`**). Recent product/UI deltas: **[`VADER_STATION_LOG.md`](VADER_STATION_LOG.md)** (**v1.9.0–v1.9.9**). Dev branch naming and historical build lines: **[`.cursor/docs/guides/Checkpoint.md`](.cursor/docs/guides/Checkpoint.md)**. **v1.3.7:** **ASAR unpack** for **`better-sqlite3`** + **`node-pty`** + **`pm2`**; main loads PM2 via **`src/main/pm2-client.js`** (**`app.asar.unpacked`**) so **Stop All** and PM2 RPC work in the `.exe`; **`stopAll`** ensures connect before **`pm2.stop('all')`**. **v1.3.6:** App **settings** IPC (**launch at login**, **minimize to tray**, **auto-start** after reconcile, **`default_view`**); factory defaults **off** for non-critical toggles; dashboard boot respects **`default_view`** vs **localStorage**. **v1.3.5:** **Top bar** — catalog badge only by breadcrumb, **+ Add New Project** global; filter row **no** duplicate count; **Dashboard** sidebar flat (no accordion); **Engineering** accordion (was Projects); **Vault** includes **VPE Sandbox**; Maintenance tabs **Prompt Vault** first; Sandbox **Engineer** = accordion steps. **v1.3.4:** Top bar badge; collapsed sidebar sections; Strategist accordion. **v1.3.3:** **[Strategist]** | **[Engineer]** tabs (**`#2a2a2a`** active); **Prompt Vault** — optional **`type`** with **[CMD]** / **[DIR]** / **[SNP]** badges; **Copy** tooltip **Prime AI Assistant**; neutral **Save template**. **GitHub CI** — **`npm run lint -- --fix || true`** (relaxed lint step); **`NEXT_TELEMETRY_DISABLED: "1"`** quoted in workflow YAML. **v1.3.2:** **Ghost watcher** + **LocalStorage** dashboard layout (grid/list, **ARCHIVE** pill). **Foundation (through v1.2.6):** registry **`is_archived`** (SQLite **user_version 7**), **ARCHIVE** filter, **Ctrl+K / Cmd+K** jump search, tactical sidebar + shield dots, **Add Project** type from **`vpe:inspect-project`**, system log viewport clamp, grid **Framer** on cards. **v1.2.9–v1.3.0 UI:** Prompt Vault list as Radix **Accordion** (Copy / **Edit** → **`vpe:update-vault-item`**, optional **description**); Sandbox top **“How to use…”** accordion; dashboard status pills + grid/list toggles use **`#2a2a2a`**; **v1.3.0** vault **create** form behind **+ Create New Master Directive** (default collapsed); **`maintenance-section`** imports **`PromptVault`** directly. **E2E:** **`npm run test:e2e:electron`**. **Packaging:** **`npm run vader:sync`** → **`--success last`** → **`vader:post-dev-forge`** (stall watchdog **`vpe-forge-stall-watchdog.cjs`**, **`vpe-forge-pause`**, snapshot, **`vpe:check-readiness`**, **`build:win`**, **`vpe:cleanup-dist`**). **`vader:dev-to-forge`** without **`rimraf`**; **`vader:clean-sync`** via **`vpe-clean-sync.cjs`**. **`v1.2.3+`** NET LED green in dev (IPC); **`before-quit`** + **Purge env** clear listeners. Full table: **`.cursor/docs/core/VPE-BUILD-PROTOCOL.md`**.

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
* **IPC types (v1.9.8+):** Renderer contracts for SQLite rows and dashboard projects live in **`src/renderer/types/vpe-ipc.ts`** (**`has_documentation`** as **`number | boolean`**, aligned with **INTEGER** columns); **`src/renderer/lib/vpe-bridge.ts`** re-exports and maps rows for the UI. **LiteLLM / ngrok:** **`google-api/vpe-start-api.ps1`**, **`google-api/litellm_config.yaml`** (see **`.cursor/docs/API-SetUp-Master.md`**).
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
**Status:** Approved — release track **`1.9.9`** (Station Prime)
*Powered by the MSC Media Engine v1.9.9*