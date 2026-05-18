# Project Update & Fix Log

This document serves as a check-in and reference tracker. Whenever we do an "Update Docs" sweep or complete a significant set of fixes, we will log the changes here. This provides a running historical record of what was fixed, how it was fixed, the root issues that were resolved, and any helpful notes for future reference.

---

## [2026-05-18] — VPE Jedi-Master v3.0 Baseline Synchronization & UI Refinement

### 🛠 Changes

#### 1. Package Version Bumped to `3.0.0` (`package.json`)
- **Previous:** `"version": "2.2.6-SOVEREIGN"`
- **New:** `"version": "3.0.0"`, description updated to "Vader Project Engine — Jedi-Master (v3.0)"

#### 2. Footer Rebranded to VPE Jedi-Master (`src/renderer/lib/vpe-bridge.ts`)
- **Previous:** `msc_mscEngineFooterLine()` returned `"Powered by the MSC Media Engine · v{version}"`
- **New:** Returns `"Powered by the VPE Jedi-Master · v{version}"` — version still sourced dynamically from `window.vpeInfo.version` → `package.json`

#### 3. Sidebar Footer Version Line Removed (`src/renderer/components/app-sidebar.tsx`)
- **Previous:** A `msc-sidebar-engine-line` `<div>` at the bottom of the sidebar rendered the same branding string as the global footer.
- **New:** Completely removed. The lower sidebar region is now clean (only STOP ALL + Settings buttons). The global footer at the bottom of the main window is the single source of branding.
- Also removed the now-unused `msc_mscEngineFooterLine` import.

#### 4. Automated Build Script Refactored (`scripts/upload_build.ps1`)
- **Previous:** Hard-coded to `Node-Launcher-v3\dist`, branch prefix `VPE-JediBuild-*`, ZIP name was the raw branch name.
- **New:**
  - Reads version from `package.json` automatically (`$pkgJson.version` → display form `major.minor`).
  - ZIP always named `Node-Launcher-vX.Y-JEDI-MASTER.zip`.
  - Release tag always `VPE-Jedi-Master-vX.Y` (or `VPE-Jedi-Master-vX.Y-bN` if tag already exists).
  - All paths use `$repoRoot = Split-Path -Parent $PSScriptRoot` — no hard-coded drive letters.

#### 5. Git Branch Renamed to `VPE-Jedi-Master-v3.0`
- **Previous branch:** `VPE-JediBuild-v1.4`
- **New branch:** `VPE-Jedi-Master-v3.0` (pushed to GitHub remote)
- **Convention going forward:** App display `Powered by the VPE Jedi-Master · vX.Y` ↔ Git branch `VPE-Jedi-Master-vX.Y`

#### 6. Documentation Sync (all core docs)
- All doc headers, signatures, and version references updated from `MSC Media Engine · v2.2.6-SOVEREIGN` → `VPE Jedi-Master · v3.0`.
- Files updated: `README.md`, `VADER_STATION_LOG.md`, `REPAIR_PROTOCOLS.md`, `TRUTH.md`, `Project-Bible.md`, `Start-Master.md`, `VADER_MASTER_MANIFEST.md`, `Goalz.md`.

#### 8. Production Native Binaries & Version Detection (`main.js`, `package.json`)
- **Native Binary Binding:** Fixed "DLL initialization routine failed" error by explicitly configuring `asarUnpack` for `better-sqlite3` and running `electron-rebuild` to align native binaries with the Electron runtime.
- **Reliable Version Detection:** Refactored `msc_vpeDetectLocalFirstUserData()` in `main.js` to use `app.getVersion()` instead of reading `package.json` from the disk. This fixes the "LEGACY ENGINE DETECTED" error in packaged production builds.

### ✅ Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit -p src/renderer/tsconfig.json` | ✅ Exit 0 |
| `node --check src/main/main.js` | ✅ Exit 0 |
| Absolute Path Leak Scan | ✅ Clean |
| Packaged App Version Detection | ✅ Fixed (app.getVersion) |
| better-sqlite3 DLL Initialization | ✅ Fixed (asarUnpack + rebuild) |
| VPE boots, vault lock logs `3.0.0` | ✅ |
| App footer shows "Powered by the VPE Jedi-Master · v3.0" | ✅ |
| Sidebar lower region clean (no version text) | ✅ |
| Git branch = `VPE-Jedi-Master-v3.0` | ✅ |

### 📝 Files Changed

| File | Change |
|---|---|
| `package.json` | version `3.0.0`, description updated |
| `src/renderer/lib/vpe-bridge.ts` | Footer string → VPE Jedi-Master |
| `src/renderer/components/app-sidebar.tsx` | Removed sidebar footer block + unused import |
| `scripts/upload_build.ps1` | Full refactor: version from package.json, Jedi-Master ZIP naming, repo-relative paths |
| All core docs | Version + signature strings updated |

---

## [2026-05-18] — Thumbnail Vault Staging: ENOENT Self-Copy Fix, file:// Routing & Duplicate Path UX

### 🛠 Fixes & Root Issues Resolved

#### 1. ENOENT Self-Copy Crash on Add Project with Thumbnail (`src/main/ipc/project-handlers.js`)

- **Root Issue:** `vpe:add-project` staged thumbnails through two sequential branches:
  - **Branch A** decoded a `data:image/` base64 preview, called `msc_writeVaultInternalThumbnail(tmpPath, ...)`, and stored the returned **`file://` URL** (e.g. `file:///D:/.../media/vault/PUBLIC/_vpe_thumb.png?t=...`) back into `resolvedThumbUrl`.
  - **Branch B** ran next and checked `!resolvedThumbUrl.startsWith('vpe-vault:')` — which passed because the URL now started with `file:`. Branch B then resolved the vault path as `srcFilePath` and called `msc_writeVaultInternalThumbnail(vaultPath, 'PUBLIC', id)`, attempting to **copy the vault file to itself** → OS-level `ENOENT: no such file or directory, copyfile 'vault/PUBLIC/_vpe_thumb.png' → 'vault/PUBLIC/_vpe_thumb.png'`.
  - The project was still registered successfully in SQLite (the crash was swallowed by `catch`), but the card rendered a broken placeholder — no thumbnail appeared on the dashboard without a manual re-save via Project Settings.
- **Fix:** Added a `let thumbAlreadyVaulted = false;` sentinel before both branches. Branch A sets it to `true` immediately after a successful vault write. Branch B's entry guard is now `!thumbAlreadyVaulted && ...` — once any branch stages the image, the other skips unconditionally regardless of the URL format stored in `resolvedThumbUrl`.

#### 2. `file://` / Raw Path Thumbnails Never Staged to Vault (`src/main/ipc/project-handlers.js`)

- **Root Issue:** Both `vpe:add-project` and `vpe:save-settings` only handled `data:image/` base64 blobs. When a raw Windows path (e.g. `C:\Users\JONBEATZ\Pictures\Vaderz-v2\mytest.jpg`) or `file://` URL was supplied — common when calling `addProject` programmatically via MCPs or agents — the path passed through un-staged and was stored in SQLite as-is. Chromium's renderer sandbox blocks loading external `file://` paths from the `img` tag, so the card showed a broken placeholder.
- **Fix (add-project Branch B):** After Branch A, a new Branch B detects any `file://` URL, raw Windows absolute path (`C:\...`), or POSIX absolute path (`/...`) that isn't already a `vpe-vault:` or `vpe-thumb:` URL, resolves it to a local `srcFilePath`, verifies the file exists, calls `msc_writeVaultInternalThumbnail(srcFilePath, ...)`, and stores the returned vault URL. Sets `thumbAlreadyVaulted = true` on success.
- **Fix (save-settings):** Added the identical file-path vault staging block to `vpe:save-settings` — runs before `msc_normalizeThumbnailUrlForPersistence`. Promoted the handler from a sync callback to `async` (it was the only sync IPC handler that needed `await`).

#### 3. "Add Project Failed" Toast Showed Raw IPC Error Prefix (`src/main/ipc/project-handlers.js` + `src/renderer/app/page.tsx`)

- **Root Issue:** The duplicate-path guard inside `vpe:add-project` used `throw new Error(...)`. Electron's IPC system wraps thrown errors with `"Error invoking remote method 'vpe:add-project':"` — producing a noisy, confusing toast message in the renderer.
- **Fix (main):** The guard now `return`s a structured `{ ok: false, code: 'DUPLICATE_PATH', error: '...', duplicate: { id, name, path } }` response instead of throwing. The error message names the conflicting project: `"TSL-v2" already uses this directory. Each workspace path can only be registered once — choose a different folder or edit the existing project.`
- **Fix (renderer):** After `await api.addProject(...)`, `page.tsx` checks `result.ok === false` and shows a `'Path already registered'` toast with the clean message. The existing `catch` block still handles genuine exceptions (non-IPC errors).

#### 4. CDP Base Port Changed to `9227` (`scripts/kill-dev-ports.cjs`)

- **Root Issue:** `CDP_BASE_PORT = 9226` but the global `playwright-electron` MCP in `~/.cursor/mcp.json` was configured to connect to `http://127.0.0.1:9227`. Every VPE session landed on `9226` and the MCP could not connect.
- **Fix:** Changed `CDP_BASE_PORT` from `9226` → `9227`. The port scanner now probes `9227–9236`, and VPE reliably starts on `9227`, matching the MCP config.

### ✅ Verification (MCP end-to-end test)

| Check | Evidence | Result |
|---|---|---|
| `addProject` with raw `file://` thumbnail | `{"ok":true}` — no ENOENT in log | ✅ |
| Vault file on disk | `media/vault/ThumbVerify/_vpe_thumb.png` — 4,572,188 bytes | ✅ |
| DB stores `vpe-vault://` protocol | `vpe-vault://verify-thumb-.../_vpe_thumb.png?pulse=...` | ✅ |
| Live DOM `<img src>` on card | `vpe-vault://...` — no `file://`, no placeholder | ✅ |
| Duplicate-path toast (UI) | `'Path already registered'` — no IPC prefix noise | ✅ |
| `npx tsc --noEmit` | Exit 0 | ✅ |

### 📝 Files Changed

| File | Change |
|---|---|
| `src/main/ipc/project-handlers.js` | `thumbAlreadyVaulted` flag; Branch B file-path vault staging; duplicate-path returns `{ ok:false }` instead of throw; `vpe:save-settings` promoted to `async` + vault staging block |
| `src/renderer/app/page.tsx` | Handle `{ ok: false }` from `addProject`; show `'Path already registered'` toast |
| `scripts/kill-dev-ports.cjs` | `CDP_BASE_PORT` changed `9226` → `9227` |

---

## [2026-05-18] - MCP Reliability, Port Conflict Resolution & Workflow Verification

### 🛠 Fixes & Root Issues Resolved

- **Persistent Port Conflicts (`EADDRINUSE :3000` / CDP bind error)**
  - **Root Issue:** Old dev sessions left headless Electron processes holding ports 3000 and the CDP debug port. The previous cleanup used `netstat | findstr` which doesn't reliably match all socket states on Windows (especially `TIME_WAIT` zombie sockets and processes killed hard by the OS).
  - **Fix:** New `scripts/kill-dev-ports.cjs` uses PowerShell `Get-NetTCPConnection` for accurate PID resolution, `taskkill /F /PID` for each owner, and also kills headless (no main window) Electron processes by name. Runs automatically before every `dev` and `vader:dev` npm start.

- **playwright-electron MCP Never Connecting**
  - **Root Issue:** `dev:main` launched Electron with `--remote-debugging-port=9222` but the `playwright-electron` MCP in `~/.cursor/mcp.json` was configured to `http://127.0.0.1:9225`. The two were always on different ports.
  - **Fix:** Changed `dev:main` to `cross-env VPE_REMOTE_DEBUG_PORT=9226 electron . --remote-debugging-port=9226` (9226 chosen as a fresh port with no stale socket history). Updated the global `playwright-electron` MCP entry to `http://127.0.0.1:9226`.

- **`agent-browser` MCP Startup Error**
  - **Root Issue:** `.cursor/mcp.json` contained `"agent-browser": { command: "npx", args: ["-y", "agent-browser", "serve"] }`. The `serve` subcommand does not exist — `agent-browser` (v0.27.0) is a standalone CLI automation tool, not an MCP server. Cursor logged an error for this entry on every startup.
  - **Fix:** Removed the invalid entry from `.cursor/mcp.json`. The tool is fully usable via Shell commands: `npx agent-browser --cdp 9226 snapshot|click|fill|screenshot|eval`.

- **Electron Splash Popup during Testing**
  - **Root Issue:** During a previous debugging session, the agent ran `npx electron db_query.js` to query SQLite directly. Since `db_query.js` has no `BrowserWindow` setup, Electron displayed its default splash screen showing `$ node_modules\electron\dist\electron.exe path-to-app`. Not a VPE bug.
  - **Fix (process):** For plain Node.js scripts that need Electron's native modules, always use `npm run test:migrations` pattern which sets `ELECTRON_RUN_AS_NODE=1`.

### 📝 Updates & Improvements

- **`scripts/kill-dev-ports.cjs` (new file):** Pre-dev port cleanup script. Clears ports 3000 and 9226 using `Get-NetTCPConnection` + `taskkill`. Also sweeps headless Electron processes from previous dev sessions. Invoked automatically by both `dev` and `vader:dev` npm scripts.
- **`package.json` `dev:main`:** Updated from `--remote-debugging-port=9222` to `cross-env VPE_REMOTE_DEBUG_PORT=9226 electron . --remote-debugging-port=9226`.
- **`agent-browser` CLI confirmed working:** Connects to VPE via `--cdp 9226` for full UI automation (snapshot, click, fill, screenshot, eval). Used to complete full workflow test without playwright-electron.
- **TalkShowLand-v1 workflow verified:** Project added (`F:\Websitez\Yolando\TalkShowLand\Local_WP\TalkShowLand_v1\app\public`), vault folder at `media/vault/TalkShowLand-v1`, START → RUNNING on `http://talkshowland-v1.local/`, STOP → clean — all confirmed via `agent-browser --cdp 9226`.

### 💡 Helpful Info & Notes

- `agent-browser` is a CLI tool (not an MCP server). Chain commands with `&&`: `npx agent-browser --cdp 9226 snapshot && npx agent-browser --cdp 9226 click @ref`. Refs from `snapshot` persist across `&&`-chained calls in the same daemon session.
- The `vpe:e2e-vault-copy-from-path` IPC only registers when `VPE_E2E=1`. To test thumbnail upload programmatically, restart with `cross-env VPE_E2E=1 npm run vader:dev`.
- Setting a custom thumbnail for any project still requires clicking **UPLOAD CUSTOM** in Project Settings (native OS file dialog — cannot be automated without `VPE_E2E=1`).

---

## [2026-05-12] - CI Fixes, MCP Overhaul, and Documentation

### 🛠 Fixes & Root Issues Resolved
- **CI Native Module Mismatch (`ERR_DLOPEN_FAILED`)**: 
  - **Root Issue:** The `better-sqlite3` native module in GitHub Actions was failing to load because it was compiled against a different Node.js/Electron version than what the CI runner expected (Node `v115` vs `v119`).
  - **Fix:** Added `npx electron-rebuild` directly after `npm ci` in the `.github/workflows/ci.yml` pipeline to recompile native modules for the correct environment before tests/builds run.
- **CI Deprecation Warnings**: 
  - **Root Issue:** GitHub Actions runners were warning about outdated Node versions and deprecated Action versions.
  - **Fix:** Opted-in to Node.js 24 via the `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` env var, and bumped `actions/checkout` to `v4.2.2` and `actions/setup-node` to `v4.4.0`.
- **Fetch MCP Crashing on Windows**:
  - **Root Issue:** `mcp-server-fetch` via `uvx` crashes or timeouts on Windows without explicit encoding.
  - **Fix:** Added `"env": {"PYTHONIOENCODING": "utf-8"}` to the global `mcp.json` configuration for the fetch tool.
- **Payload MCP Not Found**:
  - **Root Issue:** The npx command for the payload MCP was looking for a non-existent or renamed package.
  - **Fix:** Updated the command to point to the correct NPM package: `@govcraft/payload-cms-mcp`.

### 📝 Updates & Improvements
- **Project-Level MCP Configuration**: Extracted the `novamira-*` MCPs from the global `C:\Users\JONBEATZ\.cursor\mcp.json` and placed them into the project-local `D:\Cursor_Projectz\Node-Launcher-v3\.cursor\mcp.json`. This keeps project-specific tools sandboxed and prevents main file clutter.
- **New MCP Documentation**: Created `.cursor/docs/MCPs.md` detailing every active MCP, what it does, example usage, and its current health/status.
- **Tavily Search Integration**: Successfully integrated the Tavily MCP for live web search and security queries.

### 💡 Helpful Info & Notes
- When an MCP tool running via Python/`uvx` on Windows gives silent timeouts or decoding errors, always verify if `PYTHONIOENCODING=utf-8` is required in the environment variables.
- Project-level MCPs automatically override or add to global MCPs when you are in that specific Cursor workspace. They live in `.cursor/mcp.json`.

## [2026-05-15] - MCP Infrastructure Overhaul & Design Standards

### 🛠 Fixes & Root Issues Resolved
- **Redundant OS Tools**: 
    - **Root Issue:** `windows-mcp` was erroring and conflicting with other desktop automation tools.
    - **Fix:** Documented removal of `windows-mcp` in favor of more stable `desktop-automation` and `desktop-commander`.
- **`untitledui` Connectivity**:
    - **Root Issue:** False-positive error indicator in Cursor UI.
    - **Fix:** Verified live tool functionality; documented that a settings refresh clears the transient error.

### 📝 Updates & Improvements
- **New MCP Servers (project `.cursor/mcp.json`)**: Added **`firecrawl`**, **`docker`**, and **`google-workspace`** alongside existing NovaMira WordPress MCPs.
- **Design-to-Code workflow:** **`figma`**, **Magic UI**, and **Prisma** MCPs are typically wired in **Cursor global MCP** or vendor docs; **`AGENTS.md`** describes how to combine them with **`untitledui`** / **`fetch`** in prompts.
- **Agent Instruction Layers**:
    - Created **`DESIGN.md`** for 2026 UI/UX standards (Tailwind v4, OKLCH).
    - Created **`AGENTS.md`** for multi-agent workflow orchestration.
    - Created **`.cursor/skills/`** with `git-commit.md` and `ui-generator.md` for specialized agent behaviors.

### 💡 Helpful Info & Notes
- **Pending configuration** (keys / paths — see also **`VADER_STATION_LOG.md`** top entry):
    - **`firecrawl`**: `FIRECRAWL_API_KEY` in project **`.cursor/mcp.json`**
    - **`figma`**: Remote MCP + OAuth per Figma docs (not necessarily in repo **`mcp.json`**)
    - **`google-workspace`**: `GOOGLE_CREDENTIALS_PATH` + `GOOGLE_TOKEN_PATH` in project **`.cursor/mcp.json`**
    - **`postman`**: `POSTMAN_API_KEY` in Cursor MCP settings
    - **`resend`**: `RESEND_API_KEY` in Cursor MCP settings
    - **`vercel` / `mcp-vercel`**: `VERCEL_API_TOKEN` in Cursor MCP settings
    - **Local `postgres` MCP**: valid DB connection string in env if you use it
    - **UntitledUI PRO**: optional license / OAuth per vendor if you want full PRO catalog

---

## [2026-05-15] - End Project bridge teardown + Start Project port recovery

### 📝 Docs & scripts
- **`google-api/vpe-end-api-bridge.ps1`**: free **:4000**, stop matching **ngrok**; **`.gitignore`** allowlist; **`.cursorrules`** Command Authority.
- **`End-Project.md`**: step 1 = teardown; **commit/push only if operator asked** (align repo rules); **operator paste block**.
- **`Start-Project.md`** + **`start-project-ritual.mdc`**: **`Cursor-LiteLLM-Bridge.md`** in mandatory reads; bridge steps renumbered; **`vpe-end-api-bridge`** before retry on port conflict; default **operator paste** includes **`Cursor-LiteLLM-Bridge.md`** + port recovery.
- **`Cursor-LiteLLM-Bridge.md`**: **Sovereign fix summary** table.
- **`TRUTH.md`** §7, **`Project-Bible.md`** §8, **`README.md`** §1: aligned with mandatory reads, **`vpe-end-api-bridge`**, and **`vpe-start-api`** preflight (**`PORT`**, **:4000** lock).

---

## [2026-05-14] - Cursor ↔ LiteLLM: `ERROR_PROVIDER_ERROR` runbook

### 📝 Docs
- Added **[`.cursor/docs/Cursor-LiteLLM-Bridge.md`](./Cursor-LiteLLM-Bridge.md)** — OpenAI override must use **`…/v1`** (not **`…/cursor`**) for Gemini 3 on LiteLLM **1.83.x**; **`POST /cursor/chat/completions`** can **500** while **`/v1/chat/completions`** and **`/v1/responses`** succeed; ngrok / Agent vs Ask / key path notes; **stale ngrok (ERR_NGROK_3200)** as #1 “worked yesterday” failure.
- Added **`google-api/vpe-verify-public-url.ps1`** — fails fast when Cursor’s ngrok **`/v1/models`** URL is offline (**ERR_NGROK_3200**). **`vpe-start-api.ps1 -StartNgrok`** now prints a **Cursor must update URL** reminder. **`vpe-print-cursor-settings.ps1`** warns that ngrok hostnames expire when the tunnel stops.

---

## [2026-05-14] - Start Project ritual: doc re-read + smoke script + no dev autostart

### 📝 Docs & tooling
- **`npm run start-project:smoke`**: **`typecheck`** + **`test:migrations`** — default agent health check on **Start Project** (no Next/Electron dev).
- **`.cursor/prompts/Start-Project.md`**: mandatory ordered **Read** list, smoke step, API bridge, **verify-only** still runs smoke + probes **:4000** only.
- **`.cursor/rules/start-project-ritual.mdc`**: **`alwaysApply: true`** reinforcement.
- **Aligned:** **`.cursorrules`**, **`TRUTH.md` §7**, **`Project-Bible.md` §7–§8**, **`README.md`**, **`VADER_STATION_LOG.md`**, **`Start-Master.md`**, **`Goalz.md`**, **`google-api/README.md`**, **`End-Project.md`**, **`.cursor/hooks/start-api.ps1`** banner.

---

## [2026-05-13] - Automated Build System Implemented

### 🛠 Features & Logic
- **Build Engine**: Created `scripts\upload_build.ps1` to automate packaging and deployment.
- **Versioning**: Implemented `VPE-JediBuild-$branch-v1.x` auto-incrementing logic.
- **Cursor Integration**: Added project-level rule to trigger deployment via the "Upload Build" phrase.

### ✅ Results
- **First Build**: Successfully pushed `VPE-JediBuild-main-v1.1` to GitHub.
- **Workflow**: Reduced deployment time from ~5 minutes (manual) to <10 seconds (automated).

### 📝 Docs / ritual (same day)
- **Start Project default** flipped to **agent auto-starts** the **`google-api`** bridge (**`vpe-start-api.ps1 -StartNgrok`**) + **`vpe-ping-api.ps1`** unless **verify-only**; reconciled **`.cursorrules`**, **`TRUTH.md` §7**, **`Project-Bible.md` §8**, **`VADER_STATION_LOG.md`**, **`End-Project.md`**, hook banner text, **`Workspace-Hygiene-Report.md`**, and **`Start-Project.md`** (repo-relative **`pwsh -File .\google-api\...`**). **`Command Authority`** in **`.cursorrules`** now explicitly allows those launchers.

---

## [2026-05-18] — Zero-Hardcoding Path Refactor & Ghost Vault Folder Fix

### 🛠 Fixes & Root Issues Resolved

#### 1. Hardcoded Drive Paths in Vault Resolution (`src/main/vpe-vault-paths.js`)

- **Root Issue:** `msc_projectVaultRootDir()` contained `path.join('d:', 'Cursor_Projectz', 'Node-Launcher', 'media', 'vault')` and `msc_projectVaultRootDirSovereign()` contained `path.resolve('d:/Cursor_Projectz/Node-Launcher-v3/media/vault')`. Any machine or folder rename would silently redirect vault reads/writes to stale paths, creating ghost directories outside the active repo.
- **Fix:** Introduced `msc_resolveVaultAppRoot()` — a priority-chain resolver: packaged EXE → `path.dirname(process.execPath)`, dev/unpacked → `app.getAppPath()`, headless/Node → `process.cwd()`. Both `msc_projectVaultRootDir()` and `msc_projectVaultRootDirSovereign()` now call this helper. `VPE_VAULT_ROOT` env override still wins at the top of each function. No hardcoded drive letters or folder names remain.

#### 2. Stale Absolute Paths in SQLite Projects Table (`src/main/db/persistent-store.js`)

- **Root Issue:** After renaming the working folder from `Node-Launcher` / `Node-Launcher-v3` to `Node-Launcher-v2`, existing SQLite rows in the `projects` table still contained absolute paths with the old folder names in the `path` and `thumbnail_url` columns. These caused broken path resolution on every project operation.
- **Fix:** Added `msc_runLegacyPathHealingMigration(db)` — a transactional boot-time scan that rewrites any cell still referencing `Node-Launcher-v3` or bare `Node-Launcher` (explicitly skips `-v2`) to the current `msc_getSovereignAppRoot()`. Non-fatal: any error is logged and swallowed so boot is never interrupted. Wired into `msc_createPersistentStore()` after `msc_seedSqlite`.
- **Bonus:** Removed `SEED_PROJECTS` hardcoded `C:/Users/Vader/Projects/...` placeholder array — it was never inserted into non-empty DBs and was dead weight. Replaced with an empty array.

#### 3. Legacy Workspace Cleanup (`src/main/main.js`)

- **Root Issue:** Old repo folders (`D:\Cursor_Projectz\Node-Launcher`, `D:\Cursor_Projectz\Node-Launcher-v3`) still existed on disk, causing confusion in path traces and consuming space.
- **Fix:** Added `msc_vpeCleanupLegacyWorkspaceFolders()` — called once at boot after the vault version lock. Silently deletes the two legacy folders if they exist using `fs.rmSync({ recursive: true, force: true })`. Per-path `try/catch` prevents boot interruption on any error. Skippable via `VPE_SKIP_LEGACY_CLEANUP=1`.

#### 4. Ghost "PUBLIC" Vault Folder on Add Project (`src/main/ipc/vault-handlers.js`)

- **Root Issue:** The `vpe:pick-thumbnail` IPC handler called `msc_writeVaultInternalThumbnail()` unconditionally, **before** checking whether the project existed in the DB. When a user clicked "Upload Thumbnail" during Add Project setup while the auto-detected name was still the default (e.g., `PUBLIC` — derived from the scanned folder path), the handler created `media/vault/PUBLIC/` and wrote the thumbnail there. The user then renamed the project to e.g., `TSL-v2` and submitted. `vpe:add-project` correctly created `media/vault/TSL-v2/` — but the ghost `PUBLIC/` folder persisted alongside it.
- **Fix:** Restructured `vpe:pick-thumbnail` to branch immediately after the file dialog:
  - **Draft mode** (`row === null` — project not in DB): reads the source image bytes directly, returns a `data:image/...;base64,...` URL. Zero vault folders are created. The modal holds the data URL in React state until submit. `vpe:add-project` decodes it once, writing the vault folder under the final confirmed name only.
  - **Existing project** (`row !== null`): unchanged behavior — calls `msc_writeVaultInternalThumbnail` with the verified DB name, updates the DB row, returns a `vpe-vault:` URL.
- **Also removed:** The old unreachable fallback `readFile(outPath)` block that returned a `data:` URL after an unnecessary write (was dead code in draft path).

### ✅ Verification
- `npm run start-project:smoke` → **exit 0** after every change (`typecheck` pass, `user_version=19 projects_cols=23`).

---

## [2026-05-17] — WordPress-Local Bug Sprint: Port Conflict, Thumbnail, STOP ALL & State Isolation

### 🛠 Fixes & Root Issues Resolved

#### 1. Port-4000 False Positive — LiteLLM vs LocalWP GraphQL (`src/main/project-runner.js`)

- **Root Issue:** `msc_isLocalGraphqlListening()` only performed a TCP socket probe on port 4000. Because VPE's own **LiteLLM API bridge** (`vpe-start-api.ps1`) also listens on port 4000, a "port is open" check returned `true` even when Local.exe was not running. VPE then tried to call a `startSite` GraphQL mutation against LiteLLM, which returned `{"detail":"Not Found"}`. The site status was set to `unknown`, and `_startWordPressLocal` continued as if LocalWP had started — but the WordPress site was never actually served.
- **Fix — Three-Gate Defense:** Three new/modified helpers implement a layered check:
  - **Gate 1 — `msc_isLocalExeProcessRunning()`** (new): Runs `tasklist /FI "IMAGENAME eq Local.exe"` synchronously. If `Local.exe` is not in the process list, returns `false` immediately — prevents any further probing.
  - **Gate 2 — TCP socket probe** (existing, now dependent on Gate 1): Connects to `127.0.0.1:4000`; confirms the port is listening.
  - **Gate 3 — `msc_validateLocalGraphqlEndpoint(info)`** (new): Sends an HTTP POST with body `{"query":"{ __typename }"}` and `Authorization: Bearer <token>` to the GraphQL endpoint. Parses the JSON response; only returns `true` when a `data` key is present. LiteLLM returns `{"detail":"Not Found"}` which fails this check.
  - `msc_waitForLocalGraphql()` polls all three gates; `maxAttempts` raised from 24 → **120** (60-second cold-start window, 500ms per poll).
- **Additional hardening:** Wrapped the entire `_startWordPressLocal()` async body in a `runStartupAsync` IIFE with a top-level `catch` so any unhandled rejection falls back gracefully to CLI commands rather than crashing with an unhandled `TypeError`.

#### 2. Thumbnail Preview Shows Wrong Icon in "Add New Project" Modal (`src/renderer/components/add-project-modal.tsx`)

- **Root Issue (Phase 1):** `msc_modalThumbnailPreviewSrc()` allowed raw Windows file paths (e.g., `D:\path\to\screenshot.png`) to pass through as `<img src>`. The renderer cannot load `file://` paths without a custom protocol, so the image rendered as broken — showing a placeholder "broken image" glyph that appeared purple in some OS themes.
- **Fix (Phase 1):** Updated `msc_modalThumbnailPreviewSrc()` to only allow specific schemes: `data:`, `vpe-vault:`, `vpe-asset:`, `vpe-thumb:`, `http://`, `https://`. Any value that does not match returns `undefined`, causing the component to render the Camera icon placeholder.
- **Root Issue (Phase 2):** `handleScanDirectory` still auto-populated `thumbnailUrl` from `info.suggested_thumbnail` (the WordPress theme's `screenshot.png`) after each directory scan. This auto-populated a `vpe-thumb:` URL (e.g., pointing to the Divi theme), which passed the scheme filter and rendered as the purple Divi "D" icon.
- **Fix (Phase 2):** Changed the `setProjectData` call inside `handleScanDirectory` to always set `thumbnailUrl: projectData.thumbnailUrl ?? null`, dropping the `?? detectedThumbnailUrl` fallback. The Camera icon now shows by default until the user explicitly picks a file. The main process (`vpe:add-project` handler) still auto-detects and saves the theme screenshot as the project thumbnail on creation.

#### 3. STOP ALL Did Not Stop LocalWP Instances (`src/main/project-runner.js` + `src/main/vpe-ipc.js`)

- **Root Issue:** `msc_vpeStopAllEngines()` (IPC handler for the dashboard STOP ALL button) only called `pm2Manager.stopAll()` and `projectRunner.killAll()`. WordPress-Local sites are not PM2/PTY processes — they are tracked by the `wpLocal: true` flag on the in-memory runtime record (`this.children` map). `_stopWordPressLocal()` (which sends the LocalWP `stopSite` GraphQL mutation and removes the VPE mu-plugin) was never called during STOP ALL, leaving LocalWP sites in a running state.
- **Fix — `stopAllWordPressSites(minimizeLocal = true)` (new public method on `MSC_ProjectRunner`):**
  - Reads `this.store.listProjectsAlphabetical()`, filters for records where `this.children.get(id)?.wpLocal === true`.
  - Calls `_stopWordPressLocal(id, rec)` for each running WordPress site.
  - If `minimizeLocal` is true and `Local.exe` is still running, executes a PowerShell one-liner that uses `Add-Type` to P/Invoke `user32.dll ShowWindow(hwnd, SW_MINIMIZE=6)` on every `Local` process window, minimizing (not closing) Local.exe.
- **`msc_vpeStopAllEngines()` updated:** Step 1 is now `projectRunner.stopAllWordPressSites(true)` before PM2 and PTY teardown, so WordPress sites are gracefully halted first.

#### 4. Project Settings State Cross-Contamination Between Cards (`src/renderer/app/page.tsx`)

- **Root Issue:** `<ProjectSettingsModal>` had no `key` prop. React only re-runs `useState` initialization on mount, so clicking Settings on IWWI-v2 after having opened Settings for IWWI could display stale IWWI values (name, path, thumbnail, port) inside the IWWI-v2 settings panel.
- **Fix:** Added `key={selectedProjectId}` to `<ProjectSettingsModal>`. React fully unmounts and remounts the component whenever `selectedProjectId` changes, guaranteeing every project opens with a completely fresh state.

---

### 📝 New Project via Direct CDP (IWWI_v3)

During this session, `F:\Websitez\IndieWorldWideInc\Local_WP\IWWI_v3\app\public` was added as a new `wordpress-local` project. The UI scan (`inspectProject` IPC) hung on the slow F: drive and crashed the Electron app. As a workaround, the project was added directly via a **PowerShell CDP WebSocket** call targeting the Electron renderer's CDP endpoint (`ws://127.0.0.1:9225`). The payload included `project_type: 'wordpress-local'` and a base64-encoded thumbnail. This revealed a payload mismatch bug: the renderer sends `projectTypePayload` but the main-process handler (`project-handlers.js`) expects `project_type` — confirmed by reading the handler source and corrected in the CDP test payload.

The vault write confirmed: `CRITICAL SUCCESS: FILE PHYSICALLY WRITTEN TO: media\vault\IWWI_v3\_vpe_thumb.png`.

---

### 🔧 MCPs & Tools Used

| Tool / MCP | How it was used |
|---|---|
| **`playwright-electron` MCP** (CDP port **9225**) | Primary Electron UI control: `navigate`, `a11y_take-aria-snapshot`, `content_take-screenshot`, `interaction_click`, `browser_evaluate` (JS injection to trigger React state updates and IPC calls) |
| **PowerShell CDP WebSocket** (`System.Net.WebSockets.ClientWebSocket`) | Fallback when `playwright-electron` MCP dropped after Electron crash. Used to directly call `Runtime.evaluate` via CDP to inject base64 thumbnail data and invoke `window.vpeAPI.addProject()` |
| **`user-serkan-ozal.browser-devtools-mcp`** | Additional browser-side inspection and screenshot capture |
| **`user-browsermcp`** | Browser tab navigation and content checking for WordPress site health |
| **Shell** (`tasklist`, `netstat`, `Get-Process`) | Process presence checks (Local.exe), CDP port verification (9225), PowerShell log reads |
| **Console Ninja** | Live renderer console log streaming during test cycles |

---

### 💡 Key Notes for Future Sessions

- **Port 4000 Conflict Pattern:** If LiteLLM is running when you start a WordPress-Local project, the old TCP-only probe would have returned a false positive. The three-gate defense (process → TCP → GraphQL introspection) prevents this. Run `.\google-api\vpe-end-api-bridge.ps1` before doing WordPress-Local testing to avoid any ambiguity on port 4000.
- **CDP Port:** `playwright-electron` MCP and VPE's Electron dev session both use port **9225** (not the default 9222). This is set via `VPE_REMOTE_DEBUG_PORT=9225` in the dev environment and reflected in `.cursor/mcp.json`. If the MCP fails to connect, verify that `netstat -ano | findstr 9225` shows a listener, and that no zombie Electron process is holding the port.
- **IWWI_v3 on F: drive:** The `inspectProject` IPC handler can hang indefinitely on slow or network drives. Until a timeout is added to that handler, new WordPress projects on slow drives should be added via direct IPC (bypassing the scan step) or by manually constructing the payload.
- **WordPress mu-plugin lifecycle:** VPE writes `wp-content/mu-plugins/vpe-local-urls.php` on START (forces `WP_HOME` / `WP_SITEURL` to `http://`) and removes it on STOP. Always confirm the mu-plugins directory is writable on new WordPress sites.

---

*(Add new entries above this line following the same format)*