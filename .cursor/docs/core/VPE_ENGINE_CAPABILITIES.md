---
name: vader-project-engine
description: Technical and aesthetic authority for the Vader Project Engine (VPE). Merges legacy SKILL + Cursor hooks/prompt index (v1.9.9 doc layout).
version: "2.2"
---

# VPE_ENGINE_CAPABILITIES.md — Vader Project Engine (VPE)

Canonical agent capability doc (**replaces root `SKILL.md`**). **Hooks** and **prompts** are summarized in §8–§9; full prompt bodies live under **`.cursor/prompts/`**.

## Skill metadata

- **Skill name:** Vader Project Engine (VPE)
- **Version:** 2.2
- **Author:** Jon Beatz (MSC)
- **Primary sources:** [`.cursor/docs/core/TRUTH.md`](TRUTH.md), **`.cursorrules`**, **`README.md`**, [`.cursor/docs/guides/PRD.md`](../guides/PRD.md), [`.cursor/docs/core/Vader-Project-Engine.md`](Vader-Project-Engine.md), [`.cursor/docs/core/VPE-BUILD-PROTOCOL.md`](VPE-BUILD-PROTOCOL.md), [`.cursor/docs/core/AGENT-BOOT.md`](AGENT-BOOT.md), **`.cursor/prompts/Start-Project.md`**, **`VADER_STATION_LOG.md`**, [`.cursor/docs/guides/Checkpoint.md`](../guides/Checkpoint.md), [`.cursor/docs/guides/Custom-Commands.md`](../guides/Custom-Commands.md), [`.cursor/docs/guides/Stability.md`](../guides/Stability.md)

## Activation triggers

Activate when the user:

- Says **Start Project**, **start project**, **cold session**, or expects a **new-chat / reboot** bootstrap for this repo.
- Mentions **VPE**, **Vader Project Engine**, **Node-Launcher**, or **MSC**.
- Works on Electron main/preload/renderer, IPC, PM2 lifecycle, ports, thumbnails, logs, repair, or packaging.
- References **Vader Protocol**, **Studio Dark**, **Vader Shield**, or **MSC Media Engine**.
- Asks about Next.js Suspense / `useSearchParams` patching, AST repair, or `vader-fix-suspense`-style workflows.
- Needs UI review against the **Master Quality Gate** or parity with **`Vader-Project-Engine.md`**.

## Agent guardrails

When this skill applies, **always**:

- **Vader Shield:** `contextBridge` only; `nodeIntegration: false` in renderer; no `fs` / `path` / `child_process` in renderer—use preload-exposed IPC only.
- **PM2:** Prefer the **bundled programmatic API** in main; do not assume a globally installed PM2 daemon is required for the product story.
- **Termination:** Discuss and implement stops with **`tree-kill`** (and project-runner preflight / Windows port sweeps where already implemented).
- **Repairs:** **`.vader-backup`** before writes; diff-first confirmation for AST changes; align with `scripts/repair` / PRD repair suite.
- **Design:** Vader palette and tokens as in **§2**; footers include **"Powered by the MSC Media Engine"** plus the **current** app version (match root **`package.json`** / preload **`vpeInfo.version`**). **Navigation selection** in the shell uses neutral **`#2a2a2a`** (see **[VPE-BUILD-PROTOCOL.md](VPE-BUILD-PROTOCOL.md)** Standards — not the green CTA accent).
- **Naming:** Custom CSS/Tailwind-style classes prefixed with **`msc-`**; new main-process helpers follow existing **`msc_`** naming (match surrounding code).
- **Commands:** Never invent `npm run …` scripts—only those in **`package.json`**. **Forge / packaging sequencing:** [`.cursor/docs/core/VPE-BUILD-PROTOCOL.md`](VPE-BUILD-PROTOCOL.md) — e.g. **`vader:sync`**, **`vader:dev-to-forge`**, **`vader:post-dev-forge`**, **`vpe:cleanup-dist`**.
- **API Bootstrap / Start Project:** On **each new Cursor session** or **Start Project**, follow **[`.cursor/prompts/Start-Project.md`](../prompts/Start-Project.md)** (operator paste block + agent steps). Cross-check **[`AGENT-BOOT.md`](AGENT-BOOT.md)** §4 **First actions** and **[`../API-SetUp-Master.md`](../API-SetUp-Master.md)**. From **repo root**, in **split integrated terminals**, run **`.\google-api\vpe-start-api.ps1`** and global **`ngrok http 4000`** early unless **4000** is already bound — no external windows. After **`[VPE STANDBY]`**, confirm **Uvicorn** on **4000**, then **"API is Live"**. Summarize **`VADER_STATION_LOG.md`** when running the full ritual.
- **Hardware telemetry:** WMI / PowerShell CPU temperature in **`vpe-ipc.js`** was **removed in v1.1.6**; **v1.1.7** removed **`cpuTemp`** from IPC and all System Health temperature UI — do not restore without product sign-off (**`VPE-BUILD-PROTOCOL.md`** §2).
- **Windows default:** Prefer Windows 11 25H2 and repo-documented pipelines (PowerShell, `CI=true` for E2E) unless the user scopes otherwise.
- **UI completion:** Run the **Master Quality Gate** (§4) before calling UI work done.

---

## 1. Core competencies

### 1.1 Process orchestration (PM2 programmatic)

- **Persistent management:** Start/stop/restart managed dev servers via PM2 API owned by **Electron main**; closing the UI does **not** stop processes unless the user stops them (see [`TRUTH.md`](TRUTH.md)).
- **State sync:** On startup, reconcile **persisted project rows** with **live PM2** and **health probes** (e.g. boot reconcile, `pm2.list()`-style sync in main—not in renderer).
- **Zombie prevention:** Use **`tree-kill`** for controlled teardown; complement with **Windows port preflight** (stale listeners) where `project-runner` already implements it.

### 1.2 Ports and launcher isolation

- **Launcher URL:** `npm run dev` serves the **shell UI** at **`http://localhost:3000`** by default (overridable via launcher port env such as **`VPE_RENDERER_PORT` / `PORT`** per repo).
- **Managed projects:** Must use **ports strictly above** the launcher port (e.g. **3001+** when the shell is on 3000). The app enforces a **reserved-port guard** so managed apps do not bind the launcher port.
- **Bootstrap (v1.2.3+):** **`vpe:toggle-status`** → main **`project-runner`**: missing **`node_modules`** with **`package.json`** triggers a single-shell **`install && run <start_script>`** before health probes (longer first probe delay). Log-drawer **`vpe:execute-terminal-command`** does **not** auto-install — see **`vpe-ipc.js`** docs.
- **Conflicts:** Auto-increment (up to **10** attempts), **port lock** UX, and toasts on exhaustion—per PRD / `.cursorrules`.
- **Ghost watcher (v1.3.2+, Windows):** Main **`vpe-orchestrator`** — ~**60s** tick detects **node.exe** **LISTENING** on a catalog port **>** launcher port when **no** project row on that port is **`running`**; emits **`vpe:ghost-detected`** / **`vpe:ghost-cleared`**. Renderer: preload **`subscribeGhostPresence`** → TopBar **Activity** amber cue (prompts **System Health** / cleanup). Complements **`project-runner`** port preflight; does **not** auto-kill.

### 1.3 Nuke suite

Mandatory sequence (also in [`TRUTH.md`](TRUTH.md)):

1. **`tree-kill`** (terminate process tree).
2. Delete **`node_modules`** and **`.next`**.
3. Clean **`<detectedPackageManager> install`**.
4. **Thumbnail** via Puppeteer only after **HTTP 200** health check on the project URL.

Never delete **`.next`** while **`next dev`** is actively running for that project unless the product flow explicitly stops it first.

### 1.4 Vader Repair (AST)

- Target **Next.js App Router** issues such as **`missing-suspense-with-csr-bailout`** around **`useSearchParams`** / **`useParams`** patterns.
- **Backup + diff + undo**; log to **`vader-repair.log`** (and repair history in DB when wired).
- CI / smoke: **`npm run repair:ast`** (stub or real pipeline per repo).

### 1.5 Stack reference (current intent)

| Layer | Technology | Notes |
| :--- | :--- | :--- |
| Shell | Electron 28+ | Main: `src/main`; preload-only IPC |
| UI | Next.js **15+** static **`output: 'export'`** | Built to **`src/renderer/out/`** for production `loadFile` |
| Process | PM2 (programmatic) | In main; **asarUnpack** includes `pm2` tree when packaged |
| Terminal | xterm.js + node-pty | Log drawer; ANSI |
| Thumbs | puppeteer-core | Electron Chromium; WebP; caps per IPC |
| Native | better-sqlite3 | **`npm run rebuild:natives`** = **`electron-rebuild -f -o better-sqlite3`** only on Windows |

### 1.6 Persistence (canonical store)

- **Primary:** SQLite (and JSON fallback) under **`app.getPath('userData')/vpe-db`**—not renderer assumptions about cwd.
- **Thumbnails:** Scratch/cache under **`userData/media/thumbnails`** (packaged-safe).
- Legacy **`projects.json`** may be archived; **logical** project fields still match `.cursorrules` §11 / PRD schema for IDs, ports, scripts, and status.
- **Client dashboard prefs (v1.3.2+):** Tactical **grid vs list** and status filter pill (**ALL** … **ARCHIVE**) persist in **`localStorage`** (**`useDashboardPersistedSettings`** — **`src/renderer/state/useSettings.ts`**), not SQLite.
- **Maintenance UX (v1.3.3+):** **Sandbox** uses **Strategist** / **Engineer** tabs — **v1.3.5:** both tabs use **Radix Accordion** for steps; **Prompt Vault** rows support optional **`type`** (**Command** / **Directive** / **Snippet**) for **[CMD]**/**[DIR]**/**[SNP]** badges — **`vpe:update-vault-item`** persists **`type`**; **Copy** primes assistants (**tooltip**). **v1.3.5:** **Engineering** / **Vault** / **Favorites** accordions default **collapsed**; **Dashboard** flat; **Vault** includes **VPE Sandbox**; **+ Add New Project** in **TopBar**; Maintenance tabs **Prompt Vault** then **Repair Logs**.

### 1.7 IPC and telemetry discipline

- Expose **`vpe:*`** (and related) only through **`src/preload`**; document contracts in **`vpe-bridge.ts`** / main handlers.
- **Structured clone:** `webContents.invoke` payloads must be **plain JSON-serializable** (no non-cloneable class instances)—see sanitized **`vpe:get-system-stats`** pattern in repo.
- **PM2 “online” in UI:** Align with product rules: daemon badge reflects **RPC connected** and **workspace has running projects** where implemented—do not infer from global machine processes alone.

---

## 2. Vader Protocol (design)

### 2.1 Visual tokens

- **Background:** `#121212` · **Surface:** `#1c1c1c` · **Accent (Vader Red):** `#e02b20` · **Border:** `#333333`
- **Text:** `#FFFFFF` primary · `#A0A0A0` muted
- **Typography:** **JetBrains Mono** for terminal, code, and monospace data
- **Glow:** `vader-glow` → `0 0 15px rgba(224, 43, 32, 0.4)`
- **Focus:** `2px solid #e02b20` on focus-visible for interactive elements

### 2.2 Principles

- Layer surfaces (background → card → modal), thin **1px** borders, **sparse** use of Vader Red.
- **Glass** + **backdrop-blur** for elevated panels (log drawer shell). **System Log** text viewport is **plain HTML** (**#121212**, **`pl-10`**, log **`z-30`** / gutter **`z-10`**) — no CRT overlay on log text (see **`.cursorrules`**).

### 2.3 Key components

- **HUD:** 1px horizontal **#e02b20 @ 30%** at extreme top/bottom framing.
- **Top bar:** **48px**; breadcrumb; settings affordance.
- **Grid:** `repeat(auto-fill, minmax(320px, 1fr))`, **20px** gap; cards with **4:3 WebP**, status LED, sparkline strip, actions **Start/Stop**, **Repair**, **Nuke**.
- **Log drawer:** **420px**; glass surface; tabs per project; System Log viewport **#121212** + **`pl-10 pr-4 py-4`**; ANSI + CLIXML strip; bottom status line.
- **Repair modal:** max **900px**; split diff (add **green**, remove **red**); **Apply** / **Undo** / **Cancel**.
- **Destructive confirms (Nuke):** **2px** pulsing Vader Red border on confirm surface when specified.

Detail-level UI spec: **[`Vader-Project-Engine.md`](Vader-Project-Engine.md)** v2.1.

---

## 3. Command center UX

- Dashboard remains the **stable base**; details in **drawers** and **modals**.
- Keyboard, pointer, and touch: targets **≥ 44px** on small breakpoints; log drawer may go **full-screen** on mobile.
- Clear **escape** order: modal → drawer → grid.

---

## 4. Master UI/UX quality gate (ship-blocking)

Before marking UI **done**:

- States: default, hover, focus-visible, active, disabled, loading, error, empty.
- **A11y:** Semantic HTML; visible **2px #e02b20** focus ring; redundant status (color + text/icon).
- No hover layout shift; no accidental horizontal scroll on narrow viewports.
- Prefer **design tokens** / shared classes—avoid stray hex outside the palette.
- **WCAG AA** contrast for interactive elements.

---

## 5. Error handling and resilience

### 5.1 User feedback

- **Toasts:** Top-right; dark surface; **red left accent**; **~4s** dismiss for start/stop/nuke/port failures.
- **Card alerts:** Crash loops / port exhaustion surfaced on the card (border + icon + snippet).
- **Global error boundary:** Fallback UI with recovery path for render failures.

### 5.2 Product resilience

- **Process survival:** PM2 in main; UI reload does not implicitly kill dev servers.
- **Stores:** Persist under **userData**; reconcile on boot with PM2 and health probes.
- **Repairs:** No mutation without backup; one-click undo path.

---

## 6. Documentation and repo operations

- **Authority order:** [`.cursor/docs/core/TRUTH.md`](TRUTH.md) → **`.cursorrules`** → **this file** → [`.cursor/docs/guides/PRD.md`](../guides/PRD.md) → **`package.json`** for scripts.
- When changing ports, persistence paths, IPC contracts, or release steps, update **README**, **[Checkpoint](../guides/Checkpoint.md)**, **[Custom-Commands](../guides/Custom-Commands.md)**, **[VPE-BUILD-PROTOCOL](VPE-BUILD-PROTOCOL.md)**, or **[Stability](../guides/Stability.md)** as appropriate—keep **Checkpoint** truthful for handoffs.

### Release-oriented phrases (see [Custom-Commands](../guides/Custom-Commands.md))

- **`rebuild exe`:** Icon staging → *(optional **`npm run build:renderer`** for fail-fast export)* → **`npm run rebuild:natives`** → **`npm run lint`** → **`CI=true npm run test:e2e`** → clean **`dist/`** → **`npm run build:main`** ( **`prebuild:main`** = icon + **`build:renderer`** once ) → **`npm run vpe:cleanup-dist`** ( **`scripts/msc-cleanup-dist.cjs`** — root **`dist/`** junk only).
- **`Vader Sync`:** **`npm run vader:sync`** or **`npm run vader:clean-sync`** — runs **`npm run vader:dev -- --success last`** then **`vader:post-dev-forge`** (**`node scripts/vpe-forge-pause.cjs`** → **snapshot** → **`vpe:check-readiness`** → **`build:win`**). **`npm run vader:force-forge`** runs the same forge tail without **`vader:dev`** (manual escape hatch). Standalone **`vader:dev`** keeps **`--success first`**. Rules: **[VPE-BUILD-PROTOCOL](VPE-BUILD-PROTOCOL.md)**; phrases: **[Custom-Commands](../guides/Custom-Commands.md)**.
- **`restart app`** / **`start app`:** Stop stray **node/electron** (per **Custom-Commands**), then **`npm run dev`**.
- **`hardened setup`:** Install, **`rebuild:natives`**, optional Playwright browsers, **`repair:ast`**, E2E, lint.

- **Cursor Playwright MCP:** Global **`playwright`** uses **Chrome** (CI parity with **`npx playwright install chromium`**). Use **`playwright-electron`** with **CDP** `http://127.0.0.1:9222` when **`npm run dev`** has Electron remote debugging enabled—details in **Custom-Commands**.

Packaging caveats (summary): **`build.asar: false`** may be set for stability; **`signAndEditExecutable: false`** + **`afterPack`** **`rcedit`** icon embed avoids **winCodeSign** symlink issues on some Windows setups—details in **[Stability](../guides/Stability.md)**.

---

## 7. Data architecture

### Project record (logical schema)

Align persisted rows and UI with:

| Field | Type | Notes |
| :--- | :--- | :--- |
| `id` | uuid | Stable identity |
| `path` | string | Absolute project root |
| `displayName` | string | Shown on cards |
| `portLock` | boolean | Enforce preferred port |
| `preferredPort` | number | Must not collide with launcher port |
| `detectedPackageManager` | npm \| yarn \| pnpm | From lockfiles |
| `detectedStartScript` | string | e.g. `dev` |
| `status` | running \| stopped | Synced with PM2 + reconcile |
| `lastThumbnail` / `thumbnail_url` | string | URL or path per implementation |
| `createdAt`, `lastLaunched` | ISO8601 | Auditing |

```json
{
  "projects": [
    {
      "id": "uuid-v4",
      "path": "C:/Projects/example",
      "displayName": "Example",
      "portLock": true,
      "preferredPort": 3001,
      "detectedPackageManager": "npm",
      "detectedStartScript": "dev",
      "status": "stopped",
      "lastThumbnail": "./cache/thumbnails/example.webp",
      "createdAt": "2026-05-06T12:00:00.000Z",
      "lastLaunched": "2026-05-06T12:00:00.000Z"
    }
  ]
}
```

---

## 8. Cursor hooks (automation)

**Descriptor:** `.cursor/hooks.json` (version **1**).

| Hook | Command | Purpose |
|------|---------|--------|
| **`sessionStart`** | `powershell.exe -ExecutionPolicy Bypass -File .cursor/hooks/start-api.ps1` | Prints the **three-pane** ritual (**`npm run dev`**, **`.\google-api\vpe-start-api.ps1`**, **`ngrok http 4000`**). Verifies the starter script exists. **Does not** launch LiteLLM or ngrok automatically. |

Implementation: **`.cursor/hooks/start-api.ps1`**.

---

## 9. Prompts index (`.cursor/prompts/`)

| File | Role |
|------|------|
| **Start-Project.md** | Cold session / Golden Ticket — API panes + **`[VPE STANDBY]`** |
| **Start-Master.md** | Master bootstrap pointer |
| **Start-Master-Step2.txt** – **Step6.md** | Phased start ritual |
| **Start-Master-Build.md**, **Start-Master-Build-Fix1.md** | Build / fix flows |
| **Run.md** | General run instructions |
| **Functional.md** | Functional test framing |
| **Goal-Prompt.md**, **Goal-Prompt-v2.md** | Goal-oriented prompts |
| **Navigation.md** | Nav / IA |
| **Google-Sitch.md** | Google / API context |
| **v0-Dev-Prompt.md** | v0 prototype workflow |
| **DESIGN-Mobile.md**, **DESIGN.md.txt** | Design notes |

---

*My Studio Channel (MSC). Powered by the MSC Media Engine.*
