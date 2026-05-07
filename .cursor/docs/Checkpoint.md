# VPE Checkpoint (2026-05-07)

## Build v1.1.2 — UI de-clutter

- **System Health panel:** Default **closed** on load (`systemHealthOpen` initial **`false`**) — no auto-open splash; open from TopBar diagnostics control when needed.
- **System Log / drawer:** Still defaults **collapsed** (`logDrawerExpanded` **`false`**); no mount **`useEffect`** expands it; **`terminal-prefs.ts`** only persists font + scrollback (not drawer visibility).
- **Sidebar:** Removed **REGISTRY** section label above **Add New Project** for a tighter nav.
- **Footer / preload:** **MSC Media Engine v1.1.2** (`package.json` **1.1.2**).

## Build v1.1.1 — Blocking validation gate (on top of v1.1.0)

- **`vader:sync`:** `npm run vader:dev -- --success last && npm run vader:post-dev-forge` — **`concurrently`** waits for **all** dev processes to exit before snapshot / syntax guard / **`build:win`** (no early **`&&`** while **Next** still owns **3000**).
- **`vader:dev`:** unchanged **`--success first`** for normal sessions.
- **Purge:** **500ms** settle after **`taskkill`** before port re-probe; **`stdio: 'ignore'`** so “process already gone” never surfaces as a thrown error.
- **Footer Net LED:** **Green** = both **3000**/**3001** free (**`forgeReady`**); **Amber** = only node/electron listening (dev still active); **Red** = foreign listener.

## Build v1.1.0 — Advanced expansion (shipping line)

App **`package.json`** / preload track **v1.1.x** (see **v1.1.2** at top for current label). Highlights:

- **Forge gate:** **`vader:sync`** / **`vader:clean-sync`** end with **`vader:post-dev-forge`**: **`vpe:take-state-snapshot`** (`user-data/auto-snapshots/…-AUTO-PRE-BUILD`) → **`vpe:check-readiness`** (forbidden TS-in-`.js` under **`src/main` + `src/renderer`**) → **`build:win`**. All **`&&`** sequential; **`vader:dev`** keeps **`concurrently -k --success first`** and sets **`VPE_LAUNCHER_FORGE=1`** (thermal watchdog during dev).
- **UI:** Footer **Net** LED + **Purge env** (3000 / 3001 / 9222, node+electron only); **Maintenance** = Repair Logs + **Prompt Vault** (markdown templates + copy **+ version label**); **Sandbox** (react-live / Studio Dark preview).
- **Docs:** Canonical detail — [VPE-BUILD-PROTOCOL.md](VPE-BUILD-PROTOCOL.md) (v1.1.2). Phrases — [Custom-Commands.md](Custom-Commands.md).

**Active git branch (recent work):** `Node-Launcher-v8` (confirm with `git status`).

---

## Build v1.0.7 — Jedi Master Update (archive summary)

The engine was upgraded to **Build v1.0.7**, focusing on UI aesthetics ("boxBling"), favorites management, and production stabilization.

### New Features & Logic
- **UI Aesthetics:** Implemented `.box-bling` CSS with animated gradient borders and `backdrop-filter: blur(10px)`.
- **Favorites System:** Added persistent `is_favorite` flag in SQLite. Integrated star icons on cards and pinned favorites in the side navigation.
- **Maintenance Sub-nav:** Grouped Repair Logs and a new System Diagnostics shortcut under a collapsible "Maintenance" sidebar category.
- **Terminal Enhancements:** Added functional slash commands: `/diag` (network/node), `/vader` (ASCII art + OS info), and `/repair` (npm cache purge per-project).
- **Forced Scrollbar:** System Logs now use a high-visibility Vader Red (#ff0000) scrollbar with `scrollbar-gutter: stable` to prevent layout shift.
- **Admin Shells:** "Open PowerShell Here" and "Open Command Prompt Here" now default to Administrator privileges via PowerShell `RunAs`.
- **Snapshot Manager:** Refined to use `%TEMP%` for zipping and `Copy-Item`/`Remove-Item` to bypass file locks on rename.

### Build Engine Optimizations
- **Double-Build Removed:** `build:win` now only runs `next build` once (via `prebuild:main`), cutting renderer build times in half.
- **ASAR Enabled:** Switched to `"asar": true` to speed up Windows packaging. Native modules (`better-sqlite3`, `node-pty`) remain unpacked.
- **Version Iteration:** Global branding updated to **v1.0.7** across all modals, footers, and manifest files.

## MCP handoff checkpoint (2026-05-06 night)

Global MCP config (`C:\Users\JONBEATZ\.cursor\mcp.json`) was expanded and normalized for Windows-safe execution. Postgres MCP is now running from an isolated Python 3.12 venv and set to **dev/unrestricted** by request.

### New/updated MCP servers in this pass

| Server key | Launch/config | Status |
|------|--------|--------|
| `postgres` | `C:\Users\JONBEATZ\.cursor\venvs\postgres-mcp312\Scripts\postgres-mcp.exe --access-mode=unrestricted` | Working (validated import + CLI). |
| `postman` | `cmd /c npx -y @postman/postman-mcp-server@latest --full` | Package/entry works; requires `POSTMAN_API_KEY`. |
| `neon-postgres` | `url=https://mcp.neon.tech/mcp` + `transport=streamableHttp` | Config applied (remote HTTP MCP). |
| `cursor-rules-generator` | `cmd /c npx -y cursor-rules-generator-mcp@latest` | Starts correctly; long-running process intentionally stopped after smoke test. |
| `resend` | `cmd /c npx -y resend-mcp` | CLI available; requires `RESEND_API_KEY`. |
| `mcp-vercel` | local source build at `C:\Users\JONBEATZ\.cursor\tools\mcp-vercel\build\index.js` | Build works; requires `VERCEL_API_TOKEN`. |
| `Neon` (existing entry) | converted from malformed `command` string to proper streamable HTTP config | Normalized/fixed. |

### Runtime/tooling setup added

- Installed **Python 3.12** (alongside existing 3.14).
- Created dedicated venv: `C:\Users\JONBEATZ\.cursor\venvs\postgres-mcp312`.
- Installed `postgres-mcp` in that venv (solves Python 3.14 `pglast` wheel/build failure).
- Cloned and built `nganiet/mcp-vercel` locally under `C:\Users\JONBEATZ\.cursor\tools\mcp-vercel`.

### Secrets/placeholders still required

Update these in `C:\Users\JONBEATZ\.cursor\mcp.json` before full use:

- `postgres.env.DATABASE_URI`
- `postman.env.POSTMAN_API_KEY`
- `resend.env.RESEND_API_KEY`
- `mcp-vercel.env.VERCEL_API_TOKEN`
- `payload` header token placeholder (if continuing Payload MCP usage)

### Notes for tomorrow

- `browser-tools-mcp` requires companion process in a separate terminal:
  - `npx @agentdeskai/browser-tools-server@latest`
- `mcp-validator` was intentionally not wired as a normal Cursor MCP server (it is a validator/test suite toolchain).
- `crystaldba/postgres-mcp` now uses isolated Python runtime; do not switch it back to system Python 3.14.

## MCP configuration checkpoint (2026-05-06 late)

Global MCP config updated at `C:\Users\JONBEATZ\.cursor\mcp.json` with verified Windows-safe launch patterns (`cmd /c` where needed).

### Added / updated MCP servers

| Server key | Launch configuration | Status |
|------|--------|
| `secure-shell-terminal` | `cmd /c npx -y @mako10k/mcp-shell-server` | Starts correctly on this machine. |
| `terminal-controller` | `python -m terminal_controller` | Installed and starts correctly. |
| `task-master-ai` | `cmd /c npx -y task-master-ai` (+ `TASK_MASTER_TOOLS=core`) | Starts and registers tools. |
| `sequential-thinking` | `cmd /c npx -y @zengwenliang/mcp-server-sequential-thinking` | Starts correctly. |
| `local-wp` | `cmd /c npx -y @verygoodplugins/mcp-local-wp@latest` | Starts; on Windows logs `ps` probe warning, then falls back and continues. |
| `mcp-wordpress` | `cmd /c node C:\Users\JONBEATZ\AppData\Roaming\npm\node_modules\mcp-wordpress\dist\index.js` | Works with env vars; direct packaged CLI path fails on Windows here. |
| `brave-search` | `cmd /c npx -y @brave/brave-search-mcp-server --transport stdio` | Package runs; requires valid `BRAVE_API_KEY`. |

### Non-MCP tools requested and installed

- `plugship` CLI installed globally and verified (`1.0.6`).
- `pm2` CLI installed globally and verified (`7.0.1`).

### Known caveats (important)

- `@modelcontextprotocol/server-shell` is not available on npm in this environment; use `@mako10k/mcp-shell-server`.
- `mcp-wordpress` packaged CLI invocation fails on Windows (`ERR_UNSUPPORTED_ESM_URL_SCHEME`); direct `node ...\dist\index.js` launch is the working workaround.
- `brave-search` will stay in error state until `BRAVE_API_KEY` is replaced with a real key.
- Several MCP smoke tests show terminal `exit_code=4294967295` because processes were intentionally stopped after successful startup verification.

**Last doc update:** 2026-05-07 — active dev branch: **`Node-Launcher-v7`** (`origin/Node-Launcher-v7`). Full Windows release pipeline: [Custom-Commands — **rebuild exe**](Custom-Commands.md#rebuild-exe). Resolved packaging/runtime issues: [Stability-Fix-Backlog](Stability-Fix-Backlog.md). **Packaging identity:** `package.json` **`name`:** `vader-project-engine`, **`productName`:** Vader Project Engine, **`build.appId`:** `com.vader.projectengine`; NSIS **per-user** multi-step installer (default under `%LocalAppData%\Programs\Vader Project Engine\`, user can change path); **custom `.exe` icon** via **`afterPack` + `rcedit`** because **`signAndEditExecutable: true`** hits winCodeSign symlink limits on some Windows setups (see backlog). **Current optimized packaging mode:** `build.asar = true`.

## Current project status (snapshot)

| Area | Status |
|------|--------|
| **Branch** | **`Node-Launcher-v4`** — packaging polish: `src/renderer/out/` gitignored; `prebuild:main` runs static export before **`build:main`**. |
| **Renderer** | **Next.js `15.0.7`** + **React `19.0.0`** — patches **CVE-2025-66478** line (see [advisory](https://nextjs.org/blog/CVE-2025-66478)); `npm run build:renderer` → **4/4** static routes. |
| **Quality gates** | **`npm run lint`** clean; CI: lint → build → AST stub → Playwright (Chromium `--with-deps`). |
| **Persistence** | SQLite/JSON under **`app.getPath('userData')/vpe-db`**; thumbnails scratch under **`userData/media/thumbnails`**. |
| **Native modules** | **`npm run rebuild:natives`** = `electron-rebuild -f -o better-sqlite3` only (avoids Windows **node-pty** + Spectre MSVC trap). |
| **Design assets** | Committed: [`_design_references/VPE.ico`](../../_design_references/VPE.ico), [`_design_references/msc-icon.png`](../../_design_references/msc-icon.png) (commit `e7bcdd3`). [`.cursorignore`](../../.cursorignore) still excludes `_design_references/` from **Cursor indexing** only — files **are** in git. |
| **Git markers** | Empty restore-point commit before packaging: **`Clean restore-point about to make.exe`** (`1adddf9`). |
| **Windows installer / icon** | NSIS **`oneClick: false`**, **`allowToChangeInstallationDirectory: true`** (interactive wizard); **`build.win.signAndEditExecutable: false`** + [`scripts/msc-after-pack-embed-icon.cjs`](../../scripts/msc-after-pack-embed-icon.cjs) embeds **`build/icon.ico`** into **`Vader Project Engine.exe`** (Explorer icon + uninstaller verified **2026-05-06**). |
| **PM2 daemon badge behavior** | System Health `PM2 Daemon` now reads **Online** only when PM2 RPC is connected **and** at least one workspace project is currently `running` (prevents misleading Online while all cards are stopped). |
| **Runner stability / ghost ports** | `project-runner` startup preflight force-sweeps occupied target ports on Windows (`netstat -ano | findstr :<port>` + `taskkill /F /PID ...`; fallback `taskkill /F /IM node.exe` if still blocked), preventing 2s self-stop from orphaned Next.js listeners. |
| **Next packaging step** | Tell the agent **rebuild exe** (see [Custom-Commands](Custom-Commands.md#rebuild-exe)): icon → **`build:renderer`** → **`rebuild:natives`** → lint → E2E (`CI=true`) → clean **`dist/`** → **`build:main`** → remove blockmap / `builder-debug.yml` / `latest.yml`. Icons: [`package.json`](../../package.json) `build` + `build/icon.ico` from **`VPE.ico`**. |

**Context — health line on cards:** `GET /` probe does not follow redirects. **HTTP 307** on a project = server responded with redirect (e.g. Next middleware); browser **OPEN** still works. Green **“Active — HTTP 200”** only for **2xx** (see [`Msc_ProjectCard.tsx`](../../src/renderer/components/Msc_ProjectCard.tsx) `getHealthLine`).

## What Was Set Up
- Initialized git and connected GitHub remote: `https://github.com/jonbeatz/Node-Launcher`.
- Added repo hygiene:
  - `.gitignore`
  - `.github/workflows/ci.yml`
- Created and pushed initial commit to `main`.

## Major Fixes Completed
- Unified PM2/Tray with persistent store (moved away from direct `projects.json` usage).
- Added archive flow for legacy `projects.json` into `media/_vpe_archive/`.
- Wired PM2 logs into `vpe:log-update` stream for renderer log drawer.
- Fixed renderer hydration mismatch path by client-side initialization gating.
- Wired settings/save/add/delete/nuke flows to persistent-store IPC.
- Added folder picker via Electron dialog for project path selection.
- Added thumbnail picker/upload flow:
  - optimized scratch files under `app.getPath('userData')/media/thumbnails` (packaged-safe); UI still uses `thumbnail_url` / data URL as wired
  - saved in project `thumbnail_url`
  - preview now works in project settings/card.
- Rebuilt `better-sqlite3` for Electron runtime and restored SQLite mode in app startup.
- Fixed Electron cache path/permissions by forcing writable paths in LocalAppData.
- Added project URL auto-open after successful run (`openProjectUrl` IPC).
- Added reserved-port guard: managed projects cannot use the launcher renderer port (`3000` by default via `VPE_RENDERER_PORT` / `PORT`).
- Updated runner to honor configured project ports by injecting `PORT`/`NEXT_PORT`/`DEV_PORT` env.
- After dev start, main process probes `GET http://127.0.0.1:{projectPort}/` and stores HTTP status on the project row; grid card and list view show the result.
- One-time DB migration bumps any SQLite project rows still using the launcher port to the next free port; JSON store runs the same rule on load.

## Important Behavior Notes
- **`http://localhost:3000`** is the Node-Launcher UI (shell), not a managed app URL.
- Managed projects must bind to **`3001+`** (anything strictly above the launcher port).
- Project path must point to folder containing `package.json`.

## Current Known Issues / Risks
- `npm run lint` is wired for non-interactive use when `CI=true` (see GitHub Actions). Local runs use existing [`src/renderer/.eslintrc.json`](../../src/renderer/.eslintrc.json). **Unused-handler lint** in [`system-health-panel.tsx`](../../src/renderer/components/system-health-panel.tsx) was fixed (commit `da417f2`).
- ~~**Next `15.0.0` / CVE-2025-66478**~~ — Addressed on **`Node-Launcher-v3`**: **`next@15.0.7`** + **`eslint-config-next@15.0.7`** (same 15.0 line; see [Next security advisory](https://nextjs.org/blog/CVE-2025-66478)).
- **Transitive deprecations / `npm audit`**: noisy but expected until upstream bumps (ESLint 8, old `glob`/`rimraf`, etc.).
- **`_design_references/`**: tracked icons added (`VPE.ico`, `msc-icon.png`); [`.cursorignore`](../../.cursorignore) only limits **Cursor** indexing of that folder — not git ignore. Optional future cleanup: trim or move very large reference dumps if the repo grows awkwardly.
- If a managed project appears "running" but URL does not load, verify:
  - port is not reserved for the launcher (`3000` by default)
  - project path has correct root `package.json`
  - no port conflict from external dev server.

## First Things To Fix Tomorrow
1. ~~**Finalize project card launch UX**~~ — Done: [`Msc_ProjectCard.tsx`](../../src/renderer/components/Msc_ProjectCard.tsx) shows "Started on" + Open; [`page.tsx`](../../src/renderer/app/page.tsx) toast on start/stop.
2. ~~**Harden managed project diagnostics**~~ — Done: [`project-runner.js`](../../src/main/project-runner.js) `_runDevPreflight` (reserved port, port-in-use, script port mismatch); [`path-guard.js`](../../src/main/path-guard.js) validates `package.json`.
3. ~~**Improve thumbnail pipeline (IPC limits)**~~ — Done in [`vpe-ipc.js`](../../src/main/vpe-ipc.js): `MAX_THUMB_EDGE` 960, `MAX_THUMB_BYTES` 512 KiB; picker scratch files go under `app.getPath('userData')/media/thumbnails` (not `cwd`), see milestone below.
4. ~~**CI/Lint stabilization**~~ — Done: ESLint green locally; CI includes Playwright smoke, AST stub, `actions/checkout@v6` + `setup-node@v6`, Chromium `--with-deps` on Ubuntu.
5. ~~**Repository cleanup pass**~~ — Partially addressed: key icons committed; optional later pass if non-essential binaries bloat the tree.

## Regain Context (Read This First Next Session)
1. Read this file: `.cursor/docs/Checkpoint.md`. For a **full cold-start index** (authority order, MCP, skills, tick list): `.cursor/docs/AGENT-BOOT-CHECKLIST.md`.
2. Read architecture + constraints:
   - `.cursorrules`
   - `Node-Launcher-PRD.md`
   - `SKILL.md`
3. Review latest runtime-critical files:
   - `src/main/main.js`
   - `src/main/db/persistent-store.js`
   - `src/main/vpe-ipc.js`
   - `src/main/project-runner.js`
   - `src/main/pm2-manager.js`
   - `src/renderer/app/page.tsx`
   - `src/renderer/components/project-settings-modal.tsx`
4. Run startup sanity checks:
   - `npm run dev`
   - confirm launcher UI at `http://localhost:3000` (see `dev:renderer` port; overridable via launcher port env).
   - confirm each managed project uses a port **above** the launcher port and opens correctly.
5. Validate persistence mode in logs:
   - prefer `VPE persistence: SQLite (better-sqlite3)`.

## Milestone — Boot reconcile, system stats, production telemetry (completed)

- **Boot reconcile** ([`boot-running-reconcile.js`](../../src/main/boot-running-reconcile.js) + [`main.js`](../../src/main/main.js)): On engine start, rows with `status === 'running'` get a one-shot HTTP health probe ([`health-probe.js`](../../src/main/health-probe.js)); unreachable within probe timeout → stopped + health cleared; `_emitProjectsRefresh` updates UI.
- **VPE IPC registration order** ([`main.js`](../../src/main/main.js)): **`msc_attachEngineAfterWindow`** runs **before** **`loadURL` / `loadFile`** so `vpe:get-system-stats` (and other handlers) exist before the renderer boots—avoids early polls against missing handlers.
- **System Health IPC** ([`vpe-ipc.js`](../../src/main/vpe-ipc.js), [`preload.js`](../../src/preload/preload.js), [`vpe-bridge.ts`](../../src/renderer/lib/vpe-bridge.ts), [`system-health-panel.tsx`](../../src/renderer/components/system-health-panel.tsx), [`use-vpe-system-stats.ts`](../../src/renderer/hooks/use-vpe-system-stats.ts)): **`vpe:get-system-stats`** returns a **plain JSON-serializable** payload (`cpu`, `memory` {GB + `percentage`}, `pm2` {`status`, `activeCount`}, `uptime`, `projects`) so Electron **structured clone** never throws; renderer validates shape + uses placeholders on failure.
- **Native CPU / RAM (telemetry path only):** Implemented **inline** in [`vpe-ipc.js`](../../src/main/vpe-ipc.js) using **`os.cpus()`** tick deltas and **`os.totalmem()` / `os.freemem()`**—no optional telemetry packages. First CPU sample returns sentinel **`cpu: -1`** (UI shows **—** until the next ~3s poll). Legacy [`host-cpu-ticks.js`](../../src/main/host-cpu-ticks.js) remains in tree but is **not** required by this IPC path.
- **PM2 telemetry without `pm2.list`:** Calling **`pm2.list()`** from telemetry lazy-loads optional deps that can fail under **ASAR** (*Cannot find module* / unhandled rejections). Telemetry **`pm2.status`** is **`online`** only when [`pm2-manager.js`](../../src/main/pm2-manager.js) **`pm2.connect`** has succeeded (`msc_isPm2RpcConnected()`); **`pm2.activeCount`** stays **`0`** here (process list avoided on purpose). Operational PM2 features still use **`require('pm2')`** in **`pm2-manager.js`**.
- **Daemon alignment fix (2026-05-06 late):** [`pm2-manager.js`](../../src/main/pm2-manager.js) now requires both RPC connectivity and active running workspace rows (`status === 'running'`) for `msc_isPm2RpcConnected()` to return true. This keeps the System Health PM2 badge truthful for this launcher scope.
- **Ghost-port startup fix (2026-05-06 late):** [`project-runner.js`](../../src/main/project-runner.js) preflight now purges stale Windows listeners on the project port before spawn, then rechecks the port. Startup health safety kill is delayed (15s + 5 failed probes) to avoid killing slow CMS/database boots.
- **ASAR unpack:** [`package.json`](../../package.json) **`build.asarUnpack`** includes **`better-sqlite3`**, **`node-pty`**, and **`pm2`** trees for reliable resolution in production.
- **Default view:** [`app-settings-modal.tsx`](../../src/renderer/components/app-settings-modal.tsx) **Default View** initial state matches dashboard **Card** / grid default ([`page.tsx`](../../src/renderer/app/page.tsx)).
- **CI**: [`ci.yml`](../../.github/workflows/ci.yml) runs **`npm run lint`** (with `CI=true`) before **`npm run build:renderer`**. Root [`.npmrc`](../../.npmrc) sets **`legacy-peer-deps=true`** so **`npm ci`** succeeds with React 19 + Next **15.0.x** peer metadata (GitHub “lint-and-build failed in ~11s” was typically **`ERESOLVE`** on install). Renderer pins **Next `15.0.7`** for security patches.

See also: [`health-scheduler.js`](../../src/main/health-scheduler.js), [`launcher-port.js`](../../src/main/launcher-port.js), [`package-json-script-patch.js`](../../src/main/package-json-script-patch.js) for related runner/IPC behavior.

## Milestone — Repair runs, Playwright CI, userData DB, Node 24 rebuild (completed)

- **Repair history persistence**: SQLite/JSON [`persistent-store.js`](../../src/main/db/persistent-store.js) — `repair_runs` table + `insertRepairRun` / `listRepairRunsDesc`; IPC [`vpe:get-repair-runs`](../../src/main/vpe-ipc.js) / [`vpe:record-repair-run`](../../src/main/vpe-ipc.js); [`preload.js`](../../src/preload/preload.js) + [`vpe-bridge.ts`](../../src/renderer/lib/vpe-bridge.ts); [`repair-history-view.tsx`](../../src/renderer/components/repair-history-view.tsx) loads from main; [`page.tsx`](../../src/renderer/app/page.tsx) records on apply + `repairLogRev` refresh.
- **Playwright**: [`playwright.config.ts`](../../playwright.config.ts), [`e2e/smoke.spec.ts`](../../e2e/smoke.spec.ts), `npm run test:e2e`; CI installs **`chromium --with-deps`**; dev server readiness uses **`127.0.0.1`** in CI with longer timeout.
- **AST smoke**: [`scripts/vpe-repair-stub.cjs`](../../scripts/vpe-repair-stub.cjs) + `npm run repair:ast` (CJS for stable `@babel/traverse` interop on Linux CI).
- **Writable persistence (ASAR-safe)**: Store files live under **`app.getPath('userData')/vpe-db`** (see `msc_getStorePaths` / `msc_migrateLegacyDbFiles` in [`persistent-store.js`](../../src/main/db/persistent-store.js)); legacy copies from `src/main/db/` when upgrading.
- **System stats hardening**: [`vpe-ipc.js`](../../src/main/vpe-ipc.js) nested try/catch on **`vpe:get-system-stats`** → `msc_fallbackSystemStats`; [`host-cpu-ticks.js`](../../src/main/host-cpu-ticks.js) documents poll semantics + `Number.isFinite` guard before clamping CPU %.
- **Node 24 + `@electron/rebuild`**: Do **not** pass **`--legacy-peer-deps`** to the rebuild CLI (npm-only flag → `ERR_PARSE_ARGS_UNKNOWN_OPTION`). Use **`npm run rebuild:natives`** ([`package.json`](../../package.json)) after `npm install` — script uses **`electron-rebuild -f -o better-sqlite3`** (`--only`) so Windows does not also rebuild **node-pty** (which may require Spectre-mitigated MSVC components). Peer deps remain controlled by [`.npmrc`](../../.npmrc).

## Quick Command Snippets
- Clean restart:
  - `Get-Process -Name node,electron -ErrorAction SilentlyContinue | Stop-Process -Force`
  - `npm run dev`
- Verify launcher:
  - `Invoke-WebRequest http://localhost:3000 -UseBasicParsing`
- Clear Next dev cache (fixes stale client-entry / odd webpack state):
  - `Remove-Item -Recurse -Force src/renderer/.next -ErrorAction SilentlyContinue`
- Native SQLite for current Electron ABI (no extra flags on rebuild CLI):
  - `npm run rebuild:natives`
- CI-parity quick checks:
  - `npm run repair:ast`
  - `npm run test:e2e`
  - `npm run lint`
- Production installer (full gates + clean **`dist/`**): say **rebuild exe** or follow [Custom-Commands — rebuild exe](Custom-Commands.md#rebuild-exe). Minimal: **`npm run build`** / **`npm run build:win`** ( **`build:main`** → **`prebuild:main`** runs icon + **`build:renderer`** once). Dev-then-pack: [Vader Sync](Custom-Commands.md#vader-sync). Unified rules: [VPE-BUILD-PROTOCOL.md](VPE-BUILD-PROTOCOL.md).

