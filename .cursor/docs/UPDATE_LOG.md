# Project Update & Fix Log

This document serves as a check-in and reference tracker. Whenever we do an "Update Docs" sweep or complete a significant set of fixes, we will log the changes here. This provides a running historical record of what was fixed, how it was fixed, the root issues that were resolved, and any helpful notes for future reference.

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
- **Project-Level MCP Configuration**: Extracted the `novamira-*` MCPs from the global `C:\Users\JONBEATZ\.cursor\mcp.json` and placed them into the project-local `D:\Cursor_Projectz\Node-Launcher-v2\.cursor\mcp.json`. This keeps project-specific tools sandboxed and prevents main file clutter.
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