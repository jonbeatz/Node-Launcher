# Node-Launcher-PRD.md: Vader Project Engine (VPE) — v2.1 Final

| Version | Date       | Author    | Status           |
| :------ | :--------- | :-------- | :--------------- |
| 2.1     | 2026-05-07 | Jon Beatz | Approved / Final |

**Shipped desktop build (npm / `package.json` `version`):** **1.9.6** — preload **`vpeInfo.version`**, footer, and **`layout.tsx`** metadata must match. **Living UI/product narrative:** **[`VADER_STATION_LOG.md`](VADER_STATION_LOG.md)** (**v1.9.x**). Dev branch may still be **`VPE-v1.6.x-Dev`** until the next minor rename; see [.cursor/docs/Checkpoint.md](.cursor/docs/Checkpoint.md) **Build v1.9.6** + **Build v1.6.0**. See [.cursor/docs/VPE-BUILD-PROTOCOL.md](.cursor/docs/VPE-BUILD-PROTOCOL.md) for **`vader:*`** scripts and in-app tooling. Prior layers still apply: **`vader:clean-sync`** / **`vader:sync`**, NET dev override (**v1.2.3+**), shield + tactical filters (**v1.2.4–v1.2.5**), **`is_archived` + Ctrl+K** (**v1.2.6**).

**v1.3.7 (native / ASAR):** **`asarUnpack`** in **`package.json`** **`build`** for **`better-sqlite3`**, **`node-pty`**, and **`pm2`**. Packaged main must load the PM2 API from **`app.asar.unpacked`** — **`src/main/pm2-client.js`** (**`msc_getPm2`**) used by **`pm2-manager.js`**; **`stopAll`** connects before **`pm2.stop('all')`** and avoids rejecting so unified stop still clears runner + DB.

**v1.3.6 (settings + boot):** App-level settings IPC (**launch at login**, **minimize to tray**, **auto-start** after boot reconcile, **`default_view`**); factory defaults off for non-critical toggles; tray **close** hides when minimize-to-tray enabled.

**v1.3.5 (nav + maintenance):** **Top bar** — single catalog project badge (no duplicate in dashboard filter row); **+ Add New Project** in header. **Sidebar** — flat **Dashboard**; **Engineering** accordion (tactical rows); **Vault** holds Prompt Vault, Repair Logs, and **VPE Sandbox** (no standalone Sandbox section). **Maintenance** UI tabs: **Prompt Vault** first, **Repair Logs** second; default sub-view **Prompt Vault**. **Sandbox Engineer** tab uses **Radix Accordion** per step (matches Strategist pattern).

**v1.3.4 (shell + Sandbox workflow):** **Top bar** project count badge after breadcrumb; **Sandbox Strategist** = **Radix Accordion** (Brain Bank → Audition → Ship). **v1.3.3** layers below (tabs, Vault **`type`**, CI) still apply.

**v1.3.3 (Sandbox + Vault + CI):** Sandbox **Strategist** (default) vs **Engineer** tabs. Prompt Vault optional **`type`** (**Command** / **Directive** / **Snippet**) with **[CMD]** / **[DIR]** / **[SNP]** badges; **Copy** tooltip **Prime AI Assistant**. **GitHub Actions:** lint runs **`npm run lint -- --fix || true`** (relaxed; job not blocked by minor lint alone); **`NEXT_TELEMETRY_DISABLED: "1"`** remains quoted on lint/build/E2E steps.

**v1.3.2 (ghost + UX):** Main **Ghost watcher** (Windows): periodic check for **node.exe** on catalog ports with no matching **running** row → renderer cue on System Health; dashboard **grid/list** and filter pill (**ARCHIVE**) persisted in **LocalStorage**.

**v1.3.1 (ops / branching):** Introduced **`VPE-v1.3.x-Dev`**; CI **`.github/workflows/ci.yml`** runs **`npm ci`** (requires **`package-lock.json`** synced to **`package.json`**) → lint → **`build:renderer`** → AST stub → Playwright **`test:e2e`** (lint strictness superseded by **v1.3.3** relaxed lint above). **Current shipped patch:** root **`package.json`** (**`1.9.6`**); **Checkpoint** — **Build v1.9.6** + **Build v1.6.0** for branch / vault baseline.

**v1.2.6 (product baseline):** **`projects.is_archived`** in SQLite/JSON; **ARCHIVE** filter; **Project Settings → Archive project**; **Ctrl+K / Cmd+K** jump search; **Add Project** type from **`inspectProject`**; tactical sidebar shields; list **12px** shield dot; catalog **`is_archived`**.

**v1.2.9–v1.3.0 (UX):** Maintenance **Prompt Vault** — accordion rows, **`vpe:update-vault-item`** edit path, optional row **description**, sandbox onboarding accordion, neutral **`#2a2a2a`** selection on dashboard pills / shell nav where specified; **v1.3.0** — collapsed **+ Create New Master Directive** composer; **`PromptVault`** imported directly from **`@/components/PromptVault`** (no **`prompt-vault-panel`** proxy).

---

## 1. Project Vision
The **Vader Project Engine (VPE)** is a high-performance desktop command center for managing, repairing, and deploying local Node.js and Next.js environments. Built expressly for the **Vader** hardware (AMD Ryzen 9700x / Gigabyte B650), it delivers a visual, persistent, and process-aware interface that eliminates terminal clutter and automates repetitive build repairs—such as Suspense boundary patching—within the **My Studio Channel (MSC)** development workflow.

---

## 2. The Tech Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Shell / Container** | **Electron 28+** | Native filesystem access, IPC security, system tray integration. |
| **Process Management** | **PM2 Programmatic API** (bundled) | Daemon-less persistence, auto-restart, log management. |
| **Frontend UI** | **Next.js 15+ Static Export** | React-based dashboard served from local files for maximum performance. |
| **Styling** | **Tailwind CSS** | Vader Protocol design system (Studio Dark aesthetic). |
| **Automation** | **Puppeteer-core** | Headless thumbnails using Electron’s built-in Chromium. |
| **Terminal** | **xterm.js + node-pty** | Interactive, per-project terminal with full ANSI support. |
| **Repair Logic** | **AST-based Node scripts** | `vader-fix-suspense.mjs` – safe, diff-first code transformations. |

---

## 3. Core Features & Functional Requirements

### 3.1 Smart Project Registry & Detection
*   **Smart Folder Picker:** Native Electron dialog scans for `package.json`, `.next`, and lock files[cite: 15].
*   **Favorites System:** Persistent `is_favorite` flag in SQLite allows pinning projects to the top-nav sidebar.
*   **Auto-Detection Logic:**
    *   Identifies package manager (`npm`, `yarn`, `pnpm`) from lock files[cite: 15].
    *   Detects available start scripts (`dev`, `start`, `develop`), prioritizing `dev` in `detectedStartScript`[cite: 15].
*   **Monorepo Support:** Recognizes workspaces; user selects the target package when multiple exist[cite: 15].
*   **Persistent Registry:** Absolute paths and metadata stored in local `projects.json`[cite: 15].

### 3.2 Execution Engine (PM2 Integration)
*   **Vader Run Toggle:** Starts/stops processes with a single button[cite: 15]. The PM2 daemon lives inside the Electron main process—dev servers survive UI restarts[cite: 15].
*   **Process Lifecycle & State Sync:** On app launch, VPE queries `pm2.list()` and reconciles with `projects.json` to restore accurate UI states[cite: 15].
*   **Dynamic Port Management:**
    *   **Conflict Detection:** Checks port availability before launch via OS utilities[cite: 15].
    *   **Auto-Increment:** If busy, increments up to 10 times (`PORT+1`)[cite: 15].
    *   **Port Locking:** Projects can be locked to a specific port; shows toast if unavailable[cite: 15].
*   **The “Nuke” Suite:** One-click to stop project, delete `node_modules`/`.next`, and run `<detectedPackageManager> install`[cite: 15].

### 3.3 The “Vader Repair” Suite
*   **Suspense Patcher:** Scans files using AST analysis for `useSearchParams` or `useParams` usage[cite: 15].
*   **Safe Patching & Undo:**
    *   Presents a **diff view** of every affected file for explicit user confirmation[cite: 15].
    *   Creates `.vader-backup` copies before modification[cite: 15].
    *   **One-click undo** restores the backup[cite: 15].
    *   Writes detailed `vader-repair.log` to the project root[cite: 15].
*   **Fix Implementation:** Wraps components in `<Suspense>` boundaries to resolve `missing-suspense-with-csr-bailout` errors[cite: 15].

### 3.4 Visual Dashboard & Logs
*   **Vader Grid:** High-contrast cards featuring dynamic thumbnails, Vader Red pulsing status LEDs, name, port, and uptime[cite: 15].
*   **Log Drawer:** Per-project terminal panel (xterm.js) with full ANSI color, search, copy, and clear view functionality[cite: 15].
*   **Terminal Slash Commands:** Support for `/clean`, `/ports`, `/flush`, `/vpe`, `/diag`, `/vader`, and `/repair`.
*   **Auto-Thumbnailer:**
    *   Captures thumbnail via Puppeteer once dev server returns HTTP 200[cite: 15].
    *   Reuses a single headless browser instance and cached thumbnails[cite: 15].

---

## 4. Design System (Vader Protocol)

### Tailwind Configuration (`tailwind.config.js`)
```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        vader: {
          bg: '#121212',
          surface: '#1c1c1c',
          accent: '#e02b20',  // Vader Red
          border: '#333333',
        },
        msc: {
          text: '#FFFFFF',
          muted: '#A0A0A0',
        },
      },
      boxShadow: {
        'vader-glow': '0 0 15px rgba(224, 43, 32, 0.4)',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
};


## 5. System, Security & Feedback

*   **Vader Shield (Security):** Full context isolation via `contextBridge`; `nodeIntegration: false`[cite: 13]. Privileged operations are exposed only through secure preload scripts[cite: 13].
*   **Hardware Optimization:** Targets Ryzen 9700x[cite: 13]. Offloads heavy tasks to background worker threads to maintain 60 fps UI performance[cite: 13].
*   **Windows 11 25H2 Tuning:** Batched file I/O and whitelisted paths to reduce antivirus scanning impact[cite: 13].
*   **Zombie Prevention:** Uses `tree-kill` to guarantee termination of Next.js/Node processes on stop[cite: 13].
*   **Hardware telemetry (v1.1.6+; UI v1.1.7):** CPU temperature via WMI / PowerShell in the Electron main process is **removed**; System Health has **no** temperature display and IPC omits **`cpuTemp`**. Do not reintroduce without an explicit product decision ([`.cursor/docs/VPE-BUILD-PROTOCOL.md`](.cursor/docs/VPE-BUILD-PROTOCOL.md)).
*   **Footer Purge env:** Clears orphan listeners on **3000 / 3001 / 9222** with **`taskkill /F /PID`** only (no **`/T`**), always skipping the launcher **`process.pid`** and **`process.ppid`**.
*   **Snapshot Engine:** Backs up SQLite and `.env` files to `.vader-checkpoint` via `%TEMP%` staging and copy-on-write logic to bypass file locks.

### **5.1 API Orchestration (LiteLLM)**
*   **Cold session ritual:** **`Start Project`** — follow **`.cursor/prompts/Start-Project.md`** (concise checklist + **`VADER_STATION_LOG.md`** summary).
*   **Command:** `start API` (or `run litellm`) → from repo root run **`.\vpe-start-api.ps1`** + global **`ngrok http 4000`** in **Cursor integrated split panes** (**v1.7.7** tags the *LiteLLM + ngrok + Cursor* workflow in [`.cursor/docs/API-SetUp-Master.md`](.cursor/docs/API-SetUp-Master.md), **not** the VPE desktop **`package.json`** version).
*   **Requirement:** Credentials at **`.\google-api\gcp_key.json`** via **`GOOGLE_APPLICATION_CREDENTIALS`** (script sets this relative to **`$PSScriptRoot`**).
*   **Startup:** `litellm --config ./google-api/litellm_config.yaml --port 4000`; **ngrok** **`http 4000`** globally in a **second integrated terminal** (script prints the command; **ngrok** on **User PATH** — same **v1.7.7** runbook; external OS windows deprecated).
*   **Verification:** After **`[VPE STANDBY]`**, confirm **Uvicorn** on **4000**; provide feedback **"API is Live"** once the server is listening.
*   **Feedback:** Includes Toasts for actions, Card Alerts for crash loops, and a Global Error Boundary for UI failures[cite: 13].

## 6. Testing & Deployment

*   **Testing Strategy:** Unit tests for PM2/Port/AST logic and Playwright E2E tests for integration flows[cite: 13].
*   **Deployment:** Packaged with `electron-builder`; updates delivered via `electron-updater` and GitHub Releases[cite: 13].

## 7. Data Schema (projects.json)

```json
{
  "projects": [
    {
      "id": "uuid-v4",
      "path": "C:/Users/Vader/Projects/msc-media-pro",
      "displayName": "MSC Media Pro",
      "portLock": true,
      "preferredPort": 3000,
      "detectedPackageManager": "npm",
      "detectedStartScript": "dev",
      "status": "running",
      "lastThumbnail": "./cache/thumbnails/msc-media-pro.webp",
      "createdAt": "ISO8601",
      "lastLaunched": "ISO8601"
    }
  ]
}



