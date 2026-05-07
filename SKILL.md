---
name: vader-project-engine
description: Technical and aesthetic authority for the Vader Project Engine (VPE). Use for Electron, Next.js static export, PM2, Studio Dark UI, Suspense repair, Windows packaging, and Vader workstation tuning.
version: "2.1"
---

# SKILL.md: Vader Project Engine (VPE)

## Skill metadata

- **Skill name:** Vader Project Engine (VPE)
- **Version:** 2.1
- **Author:** Jon Beatz (MSC)
- **Primary sources:** `.cursor/docs/TRUTH.md`, `.cursorrules`, `README.md`, `Node-Launcher-PRD.md`, `Vader-Project-Engine.md`, `.cursor/docs/VPE-BUILD-PROTOCOL.md`, `.cursor/docs/AGENT-BOOT-CHECKLIST.md`, `.cursor/docs/Checkpoint.md`, `.cursor/docs/Custom-Commands.md`, `.cursor/docs/Stability-Fix-Backlog.md`

## Activation triggers

Activate when the user:

- Mentions **VPE**, **Vader Project Engine**, **Node-Launcher**, or **MSC**.
- Works on Electron main/preload/renderer, IPC, PM2 lifecycle, ports, thumbnails, logs, repair, or packaging.
- References **Vader Protocol**, **Studio Dark**, **Vader Shield**, or **MSC Media Engine**.
- Asks about Next.js Suspense / `useSearchParams` patching, AST repair, or `vader-fix-suspense`-style workflows.
- Needs UI review against the **Master Quality Gate** or parity with `Vader-Project-Engine.md`.

## Agent guardrails

When this skill applies, **always**:

- **Vader Shield:** `contextBridge` only; `nodeIntegration: false` in renderer; no `fs` / `path` / `child_process` in renderer—use preload-exposed IPC only.
- **PM2:** Prefer the **bundled programmatic API** in main; do not assume a globally installed PM2 daemon is required for the product story.
- **Termination:** Discuss and implement stops with **`tree-kill`** (and project-runner preflight / Windows port sweeps where already implemented).
- **Repairs:** **`.vader-backup`** before writes; diff-first confirmation for AST changes; align with `scripts/repair` / PRD repair suite.
- **Design:** Vader palette and tokens as in **§2**; footers include **"Powered by the MSC Media Engine"** plus the **current** app version (match root **`package.json`** / preload **`vpeInfo.version`**, e.g. **v1.1.4**).
- **Naming:** Custom CSS/Tailwind-style classes prefixed with **`msc-`**; new main-process helpers follow existing **`msc_`** naming (match surrounding code).
- **Commands:** Never invent `npm run …` scripts—only those in **`package.json`**. 
- **API Bootstrap:** Always ensure the **"start API"** (LiteLLM) is running for any task requiring model orchestration. Confirmation: **"API is Live"**.
- **Windows default:** Prefer Windows 11 25H2 and repo-documented pipelines (PowerShell, `CI=true` for E2E) unless the user scopes otherwise.
- **UI completion:** Run the **Master Quality Gate** (§4) before calling UI work done.

---

## 1. Core competencies

### 1.1 Process orchestration (PM2 programmatic)

- **Persistent management:** Start/stop/restart managed dev servers via PM2 API owned by **Electron main**; closing the UI does **not** stop processes unless the user stops them (see `TRUTH.md`).
- **State sync:** On startup, reconcile **persisted project rows** with **live PM2** and **health probes** (e.g. boot reconcile, `pm2.list()`-style sync in main—not in renderer).
- **Zombie prevention:** Use **`tree-kill`** for controlled teardown; complement with **Windows port preflight** (stale listeners) where `project-runner` already implements it.

### 1.2 Ports and launcher isolation

- **Launcher URL:** `npm run dev` serves the **shell UI** at **`http://localhost:3000`** by default (overridable via launcher port env such as **`VPE_RENDERER_PORT` / `PORT`** per repo).
- **Managed projects:** Must use **ports strictly above** the launcher port (e.g. **3001+** when the shell is on 3000). The app enforces a **reserved-port guard** so managed apps do not bind the launcher port.
- **Conflicts:** Auto-increment (up to **10** attempts), **port lock** UX, and toasts on exhaustion—per PRD / `.cursorrules`.

### 1.3 Nuke suite

Mandatory sequence (also in `TRUTH.md`):

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
- **Glass** + **backdrop-blur** for elevated panels (log drawer); optional **CRT scanline** overlay at **~2%** opacity.

### 2.3 Key components

- **HUD:** 1px horizontal **#e02b20 @ 30%** at extreme top/bottom framing.
- **Top bar:** **48px**; breadcrumb; settings affordance.
- **Grid:** `repeat(auto-fill, minmax(320px, 1fr))`, **20px** gap; cards with **4:3 WebP**, status LED, sparkline strip, actions **Start/Stop**, **Repair**, **Nuke**.
- **Log drawer:** **420px**; glass surface; tabs per project; terminal **#0a0a0a**; bottom status (PM2 id / runtime).
- **Repair modal:** max **900px**; split diff (add **green**, remove **red**); **Apply** / **Undo** / **Cancel**.
- **Destructive confirms (Nuke):** **2px** pulsing Vader Red border on confirm surface when specified.

Detail-level UI spec: **`Vader-Project-Engine.md`** v2.1.

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

- **Authority order:** `.cursor/docs/TRUTH.md` → `.cursorrules` → this **SKILL.md** → **`Node-Launcher-PRD.md`** → **`package.json`** for scripts.
- When changing ports, persistence paths, IPC contracts, or release steps, update **README**, **Checkpoint**, **Custom-Commands**, **VPE-BUILD-PROTOCOL**, or **Stability-Fix-Backlog** as appropriate—keep **Checkpoint** truthful for handoffs.

### Release-oriented phrases (see `Custom-Commands.md`)

- **`rebuild exe`:** Icon staging → *(optional **`npm run build:renderer`** for fail-fast export)* → **`npm run rebuild:natives`** → **`npm run lint`** → **`CI=true npm run test:e2e`** → clean **`dist/`** → **`npm run build:main`** ( **`prebuild:main`** = icon + **`build:renderer`** once ) → trim blockmap / `builder-debug.yml` / `latest.yml`.
- **`Vader Sync`:** **`npm run vader:sync`** or **`npm run vader:clean-sync`** — runs **`npm run vader:dev -- --success last`** then **`vader:post-dev-forge`** (**snapshot** → **`vpe:check-readiness`** → **`build:win`**). **`npm run vader:force-forge`** runs the same forge tail without **`vader:dev`** (manual escape hatch). Standalone **`vader:dev`** keeps **`--success first`**. Rules: **`.cursor/docs/VPE-BUILD-PROTOCOL.md`**; phrases: **`Custom-Commands.md`**.
- **`restart app`** / **`start app`:** Stop stray **node/electron** (per **`Custom-Commands`**), then **`npm run dev`**.
- **`hardened setup`:** Install, **`rebuild:natives`**, optional Playwright browsers, **`repair:ast`**, E2E, lint.

- **Cursor Playwright MCP:** Global **`playwright`** uses **Chrome** (CI parity with **`npx playwright install chromium`**). Use **`playwright-electron`** with **CDP** `http://127.0.0.1:9222` when **`npm run dev`** has Electron remote debugging enabled—details in **`Custom-Commands.md`**.

Packaging caveats (summary): **`build.asar: false`** may be set for stability; **`signAndEditExecutable: false`** + **`afterPack`** **`rcedit`** icon embed avoids **winCodeSign** symlink issues on some Windows setups—details in **`Stability-Fix-Backlog.md`**.

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

*My Studio Channel (MSC). Powered by the MSC Media Engine.*
