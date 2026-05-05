# Node-Launcher-PRD.md: Vader Project Engine (VPE) — v2.0 Final

| Version | Date       | Author    | Status           |
| :------ | :--------- | :-------- | :--------------- |
| 2.0     | 2026-05-04 | Jon Beatz | Approved / Final |

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



