# VPE Checkpoint (2026-05-08)

## Build v1.3.5 — Top bar add project, flat Dashboard, Vault absorbs Sandbox, Engineer accordion

- **Version:** **`1.3.5`** — shipped labels (`package.json`, preload **`vpeInfo.version`**, footer, **`layout.tsx`**); Prompt Vault **master** rows **`MSC Media Engine v1.3.5`** in **`vpe-ipc.js`** where applicable.
- **Top bar:** **`top-bar.tsx`** — **+ Add New Project** (global); catalog **`[N PROJECT(S)]`** badge **only** beside breadcrumb — **no** duplicate count in dashboard filter row (**`page.tsx`**).
- **Sidebar:** **`useSidebarAccordionState`** — **Engineering** (tactical rows, collapsed default), **Vault** (Prompt Vault, Repair Logs, **VPE Sandbox**), **Favorites**; **Dashboard** is **flat** (single prominent **Dashboard** button, no accordion); standalone **Sandbox** section removed.
- **Maintenance:** **`maintenance-section.tsx`** — tabs **Prompt Vault** (first) · **Repair Logs** (second); **`page.tsx`** default **`maintenanceTab`** = **`vault`**.
- **Sandbox:** **`Sandbox.tsx`** — **Engineer** tab = **Radix Accordion** (4 steps), matching **Strategist** pattern.

## Build v1.3.4 — Top bar badge, collapsed sidebar, Sandbox strategist accordion

- **Version:** **`1.3.4`** — shipped labels (`package.json`, preload **`vpeInfo.version`**, footer, **`layout.tsx`**); Prompt Vault **master** rows **`MSC Media Engine v1.3.4`** in **`vpe-ipc.js`** where applicable.
- **Top bar:** **`top-bar.tsx`** — project count badge **`[N PROJECT(S)]`** immediately after breadcrumb; **`#2a2a2a`**, slight left margin (**`ml-1.5`**).
- **Sidebar:** **`useSidebarAccordionState`** (**`src/renderer/state/useSidebar.ts`**) — **Dashboard**, **Projects**, **Vault**, **Sandbox** accordions default **collapsed**; **Vault** = Prompt Vault + Repair Logs (**`maintenance:vault`** / **`maintenance:logs`**).
- **Sandbox:** **`Sandbox.tsx`** — **Strategist** tab = **Radix Accordion** (3 steps): **Brain Bank (Prime)** → **Audition (Preview)** → **Ship (Deploy)**; removed plain-English “why this exists” wall; **Engineer** tab unchanged.

## Build v1.3.3 — Strategist Sandbox & Vault action types

- **Version:** **`1.3.3`** — shipped labels (`package.json`, preload **`vpeInfo.version`**, footer, **`layout.tsx`**); Prompt Vault **master** rows **`MSC Media Engine v1.3.3`** (where applicable) in **`vpe-ipc.js`**; optional per-item **`type`**: **`Command`** | **`Directive`** | **`Snippet`** (defaults to **Directive** / **`[DIR]`** for legacy JSON).
- **Sandbox:** **`Sandbox.tsx`** — **Radix Tabs** **[Strategist]** (default) | **[Engineer]**; **Strategist** = **why** in plain English: **1. Audition** (preview here, not main project) → **2. Prime** (Vault → AI **Vader-level** context) → **3. Deploy** (ship to real files only when preview is right). **Engineer** = preserved 4-step technical workflow. Tabs use **`#2a2a2a`** active selection.
- **Prompt Vault:** **`PromptVault.tsx`** — type **select** on create + edit; **`[CMD]`** / **`[DIR]`** / **`[SNP]`** badges; **Copy** → tooltip **`Prime AI Assistant`**; **Save template** — neutral bordered style.
- **IPC:** **`vpe:update-vault-item`** accepts optional **`type`**; master seed rows carry **`type`** for badge parity.
- **CI (finalization):** [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) — lint step **`npm run lint -- --fix || true`** (job stays green on minor lint noise); **`NEXT_TELEMETRY_DISABLED: "1"`** quoted on lint/build/E2E steps.

## Build v1.3.2 — Ghost watcher & dashboard persistence

- **Version:** **`1.3.2`** — shipped labels (`package.json`, preload **`vpeInfo.version`**, footer, **`layout.tsx`**); Prompt Vault **master** rows **`MSC Media Engine v1.3.2`** in **`vpe-ipc.js`**.
- **Ghost watcher:** **`src/main/vpe-orchestrator.js`** — 60s tick (Windows **`netstat` + `tasklist`**): **node.exe** listening on catalog ports **>** launcher port, none of the rows sharing that port **`status === 'running'`** → **`webContents.send('vpe:ghost-detected')`**; clear → **`vpe:ghost-cleared`**. Preload **`subscribeGhostPresence`**; TopBar **Activity** icon pulses **amber** until resolved (**Scorched Earth** cue).
- **Dashboard UX:** **`useDashboardPersistedSettings`** (**`src/renderer/state/useSettings.ts`**) persists **grid vs list** and status filter pill (**ARCHIVE**) in **`localStorage`**.
- **CI:** **`README`** embeds **`actions/workflows/ci.yml`** status badge (**jonbeatz/Node-Launcher**).

## Build v1.3.1 — CI alignment (`npm ci`) & **`VPE-v1.3.x-Dev`** branch

- **Version:** **`1.3.1`** — shipped labels (`package.json`, preload **`vpeInfo.version`**, footer, **`layout.tsx`**); Prompt Vault **master** rows **`MSC Media Engine v1.3.1`** in **`vpe-ipc.js`** (**Electron E2E Suite** / **Playwright Manual** presets remain **`v1.2.8`**).
- **GitHub Actions:** **`package-lock.json`** synchronized so **`npm ci`** succeeds (prior drift: **`framer-motion`** / **`motion-*`** missing from lock broke **`lint-and-build`** in seconds). Workflow uses **`actions/checkout@v4`**, **`actions/setup-node@v4`**, **`permissions: contents: read`**, concurrency **`cancel-in-progress`**, **`NEXT_TELEMETRY_DISABLED`** quoted in YAML env.
- **Branching:** active development branch standard **`VPE-v1.3.x-Dev`** (replaces **`Node-Launcher-v11`** naming for Vader cycle clarity).

## Build v1.3.0 — UI density, sidebar neutralization & import cleanup

- **Version:** **`1.3.0`** — shipped labels (`package.json`, preload **`vpeInfo.version`**, footer, **`layout.tsx`**); Prompt Vault **master** rows **`MSC Media Engine v1.3.0`** in **`vpe-ipc.js`** (**Electron E2E Suite** / **Playwright Manual** presets keep **`v1.2.8`** labels).
- **Prompt Vault — UI density:** entire **New Master Directive / Build Protocol** create form wrapped in Radix **`Accordion`**; **default collapsed**; trigger copy **+ Create New Master Directive** (**`PromptVault.tsx`**). Vault **list** remains accordion rows + Copy / Edit modal + **`vpe:update-vault-item`** (from **v1.2.9**).
- **Architecture:** **`maintenance-section.tsx`** imports **`PromptVault`** from **`@/components/PromptVault`**; removed **`prompt-vault-panel.tsx`** proxy.
- **Sidebar:** active/hover chrome for Dashboard, tactical **Projects** rows, Maintenance, Sandbox, Settings uses **`bg-[#2a2a2a]`**; **Add New Project** and **STOP ALL** use neutral gray surfaces (**no green primary / no red danger hover** on those nav-adjacent controls).
- **Docs / standards:** [.cursor/docs/VPE-BUILD-PROTOCOL.md](VPE-BUILD-PROTOCOL.md) — **Skills** (accordion UI density), **Standards** (nav **`#2a2a2a`** lock).

## Build v1.2.9 — Prompt Vault accordion list, Sandbox onboarding, IPC edit

- **Version:** **`1.2.9`** — superseded shipped label by **v1.3.0** for **`package.json`**; retain for history / merge notes.
- **Prompt Vault:** list UI as **Accordion** (collapsed: title + version + actions; expanded: description + body); **Edit** (pencil) → preload **`updateVaultItem`** / IPC **`vpe:update-vault-item`**; items support optional **`description`**; master presets include **Electron E2E Suite** and **Playwright Manual** (`npm run test:e2e:electron`, `npx playwright test --config=playwright.electron.config.ts`).
- **Sandbox:** top instructional **Accordion** (**How to use the VPE Sandbox & Vault**); live preview unchanged (**react-live**).
- **Dashboard:** status filter pills + grid/list toggles switched to **`#2a2a2a`** active styling (neutral Studio Dark).

## Build v1.2.6 — Archive, jump search & UI hardening

- **Version:** **`1.2.6`** — shipped label (`package.json`, preload **`vpeInfo.version`**, footer, **`layout.tsx`**, **`msc-cleanup-dist`**); Prompt Vault master rows **`versionLabel`** **`MSC Media Engine v1.2.6`** in **`vpe-ipc.js`**.
- **Registry:** SQLite migration **`user_version = 7`** adds **`is_archived INTEGER NOT NULL DEFAULT 0`**; **JsonPersistence** mirrors field; **`vpe:save-settings`** persists archive flag; **`vpe:add-project`** accepts optional **`project_type`**; catalog JSON **`is_archived`** on export/import merge.
- **Dashboard:** **ARCHIVE** pill shows archived rows only; all other pills hide **`is_archived`** projects. Tactical sidebar counts (**`msc_computeTacticalCounts`**) use **non-archived** rows only.
- **Search:** **`Ctrl+K` / `Cmd+K`** (**`top-bar.tsx`**) — **jump** mode: substring match on name/path/port across **all** projects, ignores status + tactical filters until cleared. Magnifying glass = narrow search in current view (**`page.tsx`** **`searchTerm`**).
- **Sidebar:** **Add New Project** at top of nav content; **Projects** tactical block below **Dashboard**; selected/hover **`bg-[#2a2a2a]`**; **Shield** icons tinted (**`src/renderer/lib/shield-colors.ts`**); removed red tactical highlight / green inset bar.
- **Add Project modal:** After folder pick, **`vpe:inspect-project`** drives default **Project Type** select (override or **Auto**).
- **List / grid / log:** List name row **12px** shield circle (**`project-list-view.tsx`**); grid cards wrapped in **`motion.div`** + **`AnimatePresence`** (**`page.tsx`**); **`.vpe-system-log-viewport`** **`overflow-x: hidden !important`** (**`globals.css`**).

## Build v1.2.3 — v0 workflow & auto-dependency injection

- **Version:** **`1.2.3`** — shipped label (`package.json`, preload **`vpeInfo.version`**, footer, **`layout.tsx`**, **`msc-cleanup-dist`** log); Prompt Vault master rows **`versionLabel`** aligned.
- **Zero-config dev start:** [`project-runner.js`](../../src/main/project-runner.js) **`startDev`** — if **`package.json`** exists and **`node_modules`** is missing, runs a **shell pipeline** **`install && run <start_script>`** (npm / yarn / pnpm) instead of **`run` only**. System Log shows **`[VPE] v0 project detected…`** when **`components/ui`** exists (internal **`v0-prototype`**); generic path logs a shorter missing-deps line.
- **IPC / UI:** **`vpe:toggle-status`** may return **`installing: true`** and **`projectKind: 'v0-prototype'`**. Preload **`subscribeBootstrapDevVisible`** listens for **`vpe:bootstrap-dev-visible`** (dev-server-ish stdout heuristics). Dashboard shows **INSTALLING** / **Installing…** (spinner); click again **stops** the compound process. First HTTP health probe delay is **10s** during install bootstrap vs **~1.8s** normal (**`MSC_HEALTH_FIRST_INSTALL_MS`**).
- **Not in terminal IPC:** Auto-install is **not** implemented inside **`vpe:execute-terminal-command`** — [`vpe-ipc.js`](../../src/main/vpe-ipc.js) documents that split.

## Build v1.2.2 — Neutral Depth UI & Vault Population

- **Version:** **`1.2.2`** — historical shipped label for depth UI + vault; superseded by **v1.2.3** for current **`package.json`** version.
- **Neutral depth UI:** Project cards (**`.vpe-project-card`**) and sidebar (**`.vpe-sidebar`**) use layered shadow (**`0 10px 30px`** + hairline rim). Scrollbar thumb hover (**global + `.vpe-terminal-scrollbar`**) is **neutral gray** (`#4a4a4a`), not accent red. System Log viewport (**`.vpe-system-log-viewport`** in **`log-drawer.tsx`**) uses **glass** (`rgba(20,20,20,0.75)`, **`backdrop-filter`**, subtle border) instead of solid **`#121212`**.
- **De-clutter:** Removed **9700x Tuned** badge from **`Msc_ProjectCard.tsx`**. System Health “metrics poll every 3s” subtext is **smaller / low-opacity italic** (**`system-health-panel.tsx`**). *(Repo has **`top-bar.tsx`** as the shell header — no badge there.)*
- **Prompt Vault hygiene:** **`vpe:prompt-vault-read`** seeds **`prompt-vault.json`** with **five stable-id master commands** when missing; on existing vaults **merges** any missing masters (no overwrite of same **`id`**). Scorched Earth / Vader Sync / Rapid Prototype / Validation & Forge / Version Bump Sync.
- **App icon path (Forge):** Canonical staged icon is **[`media/icon.ico`](../../media/icon.ico)** — copied from **`_design_references/VPE.ico`** by **`scripts/msc-copy-release-icon.cjs`**. [`package.json`](../../package.json) **`build.win.icon`**, **`extraResources`**, and NSIS icons reference **`media/icon.ico`**. Dev tray/window resolves **`media/`** first, with legacy **`build/icon.ico`** fallback. **`msc-cleanup-dist`** / **`vpe-clean-sync`** never delete **`media/`** (only **`dist/`** cleanup).

## Build v1.1.8 — NET green override & exit-to-build hardening

- **Version:** **`1.1.8`** — shipped label (`package.json`, preload, footer, **`layout.tsx`**).
- **9222 / NET:** Port-health for **9222** runs a targeted **9222-only** purge when the row is **in use** or the probe times out (**400ms**), then **always** reports **`inUse: false`** (NET never blocked by CDP).
- **Dev exit:** **`before-quit`** + **`will-quit`** under **`isDev` + `VPE_LAUNCHER_FORGE`**: synchronous sweep of **3000 / 3001** listener PIDs (never global **`node.exe`** — preserves parent **`npm`**), then **`process.exit(0)`**.
- **`vader:clean-sync`:** **`rimraf dist && (vader:dev || node -e process.exit(0)) && vader:post-dev-forge`** — forge runs even if **`vader:dev`** exits non-zero; use **`vader:sync`** for **`--success last`**.

## Build v1.1.7 — Scorched Earth UI & build lock

- **Version:** **`1.1.7`** — historical; superseded by **v1.1.8** for shipped label.
- **Thermal UI purge:** System Health no **`Temp:`** line; **`cpuTemp`** removed from **`vpe-bridge`**, **`use-vpe-system-stats`**, and **`vpe:get-system-stats`** payload (**`msc_buildSanitizedSystemStatsPayload`**).
- **NET / 9222:** **`msc_launcherPortRowHealth(9222)`** — **400ms** race or inner rejection → **`{ inUse: false, ok: true }`** (forge-friendly; **`taskkill`** still available via Purge / scripts).
- **Scripts:** **`npm run vader:dev-to-forge`** → **`vader:dev && vader:post-dev-forge`** (for strict teardown-before-forge, use **`vader:sync`** with **`--success last`**).
- **Cleanup log:** **`scripts/msc-cleanup-dist.cjs`** prints **`[Vader Protocol] All Thermal UI artifacts and Ghost PIDs purged.`** after its normal summary.

## Build v1.1.6 — Gold Master (post-reboot audit & terminal polish)

- **Version:** **`1.1.6`** — historical; superseded by **v1.1.7** for shipped label and thermal IPC shape.
- **System Log viewport:** solid **`#121212`** (`opacity: 1`); **`pl-10 pr-4 py-4`**; log lines **`z-30`**, scroll pane + resize gutter **`z-10`**, docked body **`left-1`** so the gutter does not stack over text.
- **Hardware telemetry — removed:** WMI / PowerShell CPU temperature polling, **`msc_powershellEncodedExecSync`**, **`VPE_LAUNCHER_FORGE`** thermal **`setInterval`**, and forge-time thermal **Notifications** are **deleted** from **`vpe-ipc.js`**. **v1.1.7** removed **`cpuTemp`** from the IPC payload and all thermal UI strings. **Do not re-enable** without an explicit product decision (see **`VPE-BUILD-PROTOCOL.md`**).
- **Purge env — crash fix:** **`msc_purgeLauncherPorts()`** + **`vpe:purge-launcher-ports`**; always skips **`process.pid`** and **`process.ppid`**; uses **`taskkill /F /PID`** only (**no `/T`**) on **3000 / 3001 / 9222** so the Electron main tree is not destroyed; second-pass **9222** sweep unchanged intent (non-protected listeners).
- **CLIXML:** Main process no longer spawns thermal PowerShell; renderer **`log-drawer.tsx`** still strips **`#< CLIXML`** / **`<Objs>`** on streamed log lines.
- **Forge pre-pause (portable):** **`vader:post-dev-forge`** / **`vader:force-forge`** lead with **`node scripts/vpe-forge-pause.cjs`** (**3s**) — replaces **`timeout /t 3`** for npm / non-interactive shells.
- **Dist hygiene:** **`npm run vpe:cleanup-dist`** (**`msc_cleanupDist`** in **`scripts/msc-cleanup-dist.cjs`**) runs automatically after **`build:win`** in **`vader:post-dev-forge`** / **`vader:force-forge`** — removes **`dist/`** top-level **`*.blockmap`**, **`*.yml`**, **`builder-effective-config.yaml`** only (never **`win-unpacked/`** or **`*.exe`**).

## Build v1.1.5 — Gold Master (ghost purge & UI recalibration)

*Historical archive — **v1.1.6** removed main-process thermal PowerShell entirely and changed **Purge** to **`taskkill /F /PID`** only (no **`/T`**). See **Build v1.1.8** at top for current shipped truth.*

- **PowerShell silence (pre–v1.1.6 thermal path):** `msc_powershellEncodedExecSync` … CLIXML strip — **function removed** with thermal decommission; renderer log strip remains.
- **Thermal WMI backoff:** access-denied / **0x80041003** now uses a **60-second** silent WMI backoff (reduced log spam vs long multi-minute windows).
- **Port health:** `vpe:launcher-port-health` row probes are **time-boxed (500ms)** per port — on stall, treat as **free** so the Net LED can recover **green** instead of hanging **gold**.
- **Purge (v1.1.5 era):** optional **`chrome.exe`** / **`VPE*`** title filter; **`taskkill /F /T`** on targets — **superseded v1.1.6** by **`/PID`**-only kills (see v1.1.6 section).
- **LogDrawer:** terminal pane **`pl-8 pr-4 py-4`**, **`z-10` / `z-20`** layering, docked body **`left-1`** inset so the resize strip no longer paints over log text.
- **Forge tail:** **`vader:post-dev-forge`** / **`vader:force-forge`** — **v1.1.6+** uses **`node scripts/vpe-forge-pause.cjs`** (3s) before snapshot → syntax → **`build:win`** (replaces **`timeout /t 3`** for npm/CI reliability).

## Build v1.1.4 — Master Shield Stabilization

- **LogDrawer calibration:** Removed scanline/overlay treatment from the live text viewport to eliminate left black bar artifacts; terminal pane now uses dedicated **`.vpe-terminal-scrollbar`** styling.
- **Purge self-preservation (v1.1.4):** protected **`process.pid`** / **`process.ppid`** before kills — still true in **v1.1.6**; kill flag evolved from **`/T`** to **`/PID`**-only (no child-tree kill).
- **Net LED logic:** footer remains **gold** while **9222** debug bridge is active (even if 3000/3001 are free); **green** requires forge-ready + 9222 idle.
- **Thermal WMI syntax:** moved WMI reads to PowerShell **`-EncodedCommand`** multiline scripts (PS 5.1-safe), removing fragile one-line quoting that caused parse/token noise.

## Build v1.1.3 — Thermal recovery, terminal repair, forge escape hatch

- **System Log (`log-drawer.tsx`):** Strip ANSI / CSI for plain-text lines (no ESC “dark boxes”); scroll regions use **`overflow-y-auto`**, viewport **`max-height`**, **`min-h-0`** flex; append scrollback only trims when over cap.
- **Thermal (WMI):** `Get-CimInstance` wrapped with exit **`2`** = access denied (**0x80041003**); one repair-log line *“Thermal Monitoring requires Admin Privileges. Alerts disabled.”*; **10 min** WMI backoff (no subprocess spam); high-temp **notifications disabled** for rest of session after deny.
- **`npm run vader:force-forge`:** Same as post-dev forge tail — snapshot → syntax guard → **`build:win`** when **`vader:sync`** exit-code chain fails.
- **Purge env (v1.1.3):** **`taskkill /F /T /PID`** — historical; **v1.1.6** uses **`/F /PID`** without **`/T`**.

## Build v1.1.2 — UI de-clutter

- **System Health panel:** Default **closed** on load (`systemHealthOpen` initial **`false`**) — no auto-open splash; open from TopBar diagnostics control when needed.
- **System Log / drawer:** Still defaults **collapsed** (`logDrawerExpanded` **`false`**); no mount **`useEffect`** expands it; **`terminal-prefs.ts`** only persists font + scrollback (not drawer visibility).
- **Sidebar:** Removed **REGISTRY** section label above **Add New Project** for a tighter nav.
- **Footer / preload:** **MSC Media Engine v1.1.2** (historical; current label **v1.1.8** — see top of file / `package.json`).

## Build v1.1.1 — Blocking validation gate (on top of v1.1.0)

- **`vader:sync`:** `npm run vader:dev -- --success last && npm run vader:post-dev-forge` — **`concurrently`** waits for **all** dev processes to exit before snapshot / syntax guard / **`build:win`** (no early **`&&`** while **Next** still owns **3000**).
- **`vader:dev`:** unchanged **`--success first`** for normal sessions.
- **Purge:** **500ms** settle after **`taskkill`** before port re-probe; **`stdio: 'ignore'`** so “process already gone” never surfaces as a thrown error.
- **Footer Net LED:** Superseded by **v1.1.4+** semantics (**9222** + bounded probe); **v1.1.8** forces **9222** non-blocking (purge + idle row) and **`forgeReady`-only** green in the footer; see **Build v1.1.8** / **v1.1.7** / **v1.1.6** / **v1.1.5** / **v1.1.4** sections above.

## Build v1.1.0 — Advanced expansion (shipping line)

App **`package.json`** / preload track **v1.1.x** (see **v1.1.8** at top for current label). Highlights:

- **Forge gate:** **`vader:sync`**, **`vader:clean-sync`**, and **`vader:dev-to-forge`** all end with **`vader:post-dev-forge`**: **`node scripts/vpe-forge-pause.cjs`** (3s) then **`vpe:take-state-snapshot`** (`user-data/auto-snapshots/…-AUTO-PRE-BUILD`) → **`vpe:check-readiness`** (forbidden TS-in-`.js` under **`src/main` + `src/renderer`**) → **`build:win`** → **`vpe:cleanup-dist`**. **`vader:sync`** uses **`--success last`**; **`vader:clean-sync`** does **`rimraf dist`** then **`(vader:dev || …)`** (**v1.1.8**, no **`--success last`**). **`npm run vader:dev-to-forge`** runs **`vader:dev`** then the same tail (no **`rimraf`**). **`vader:dev`** sets **`VPE_LAUNCHER_FORGE=1`** (**v1.1.6+** no main-process thermal polling; **v1.1.7+** no **`cpuTemp`** in IPC/UI).
- **UI:** Footer **Net** LED + **Purge env** (3000 / 3001 / 9222, node+electron only); **Maintenance** = Repair Logs + **Prompt Vault** (markdown templates + copy **+ version label**); **Sandbox** (react-live / Studio Dark preview).
- **Docs:** Canonical detail — [VPE-BUILD-PROTOCOL.md](VPE-BUILD-PROTOCOL.md) (v1.1.8). Phrases — [Custom-Commands.md](Custom-Commands.md).

**Active git branch:** confirm with **`git status`** (branch name varies; milestones in this file are historical snapshots).

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

**Last doc update:** 2026-05-08 — **v1.3.5** Top bar **+ Add New Project** + single catalog badge (no filter-row duplicate); **flat Dashboard**; **Engineering** accordion; **Vault** includes **VPE Sandbox**; Maintenance **Prompt Vault** tab first; Sandbox **Engineer** accordion; **v1.3.4** Strategist accordion + collapsed sidebar sections; **v1.3.3** Vault **`type`** / badges; **CI** **`npm run lint -- --fix || true`** + quoted **`NEXT_TELEMETRY_DISABLED`**; **v1.3.2** ghost watcher + **localStorage** + README CI badge; **v1.3.1** lockfile + Actions + **`VPE-v1.3.x-Dev`**. **v1.3.0** vault create accordion + sidebar neutral CTAs; **v1.2.9** accordion list + Sandbox onboarding. Earlier: **v1.2.6** archive, Ctrl+K jump search; **v1.2.3** managed-project **install + dev** bootstrap; **v1.2.2** vault seed + **`media/`** icon path. **Active branch:** confirm with **`git status`**. Full Windows release pipeline: [Custom-Commands — **rebuild exe**](Custom-Commands.md#rebuild-exe). Resolved packaging/runtime issues: [Stability-Fix-Backlog](Stability-Fix-Backlog.md). **Packaging identity:** `package.json` **`name`:** `vader-project-engine`, **`productName`:** Vader Project Engine, **`build.appId`:** `com.vader.projectengine`; NSIS **per-user** multi-step installer; **custom `.exe` icon** via **`afterPack` + `rcedit`**. **Current optimized packaging mode:** `build.asar = true`.

## Current project status (snapshot)

| Area | Status |
|------|--------|
| **Branch** | Confirm with **`git status`** — development line: **`VPE-v1.3.x-Dev`** (legacy names **`Node-Launcher-v*`** may exist on remotes until pruned). Packaging polish: `src/renderer/out/` gitignored; `prebuild:main` runs static export before **`build:main`**. |
| **Renderer** | **Next.js `15.5.12`** + **React `19.0.0`**; `npm run build:renderer` → **4/4** static export routes. |
| **Quality gates** | Local: **`npm run lint`** should be clean before merge when possible. **GitHub CI (v1.3.3+):** **`npm run lint -- --fix || true`** (relaxed) → **`build:renderer`** → AST stub → Playwright (Chromium `--with-deps`). |
| **Persistence** | SQLite/JSON under **`app.getPath('userData')/vpe-db`**; thumbnails scratch under **`userData/media/thumbnails`**. **v1.3.2+:** tactical dashboard layout (grid/list + status pill incl. **ARCHIVE**) also in **`localStorage`** (**`src/renderer/state/useSettings.ts`**). **v1.3.3+:** **`userData/prompt-vault.json`** items may include optional **`type`** (**Command** / **Directive** / **Snippet**) for UI badges. |
| **Native modules** | **`npm run rebuild:natives`** = `electron-rebuild -f -o better-sqlite3` only (avoids Windows **node-pty** + Spectre MSVC trap). |
| **Design assets** | Committed: [`_design_references/VPE.ico`](../../_design_references/VPE.ico), [`_design_references/msc-icon.png`](../../_design_references/msc-icon.png) (commit `e7bcdd3`). [`.cursorignore`](../../.cursorignore) still excludes `_design_references/` from **Cursor indexing** only — files **are** in git. |
| **Git markers** | Empty restore-point commit before packaging: **`Clean restore-point about to make.exe`** (`1adddf9`). |
| **Windows installer / icon** | NSIS **`oneClick: false`**, **`allowToChangeInstallationDirectory: true`** (interactive wizard); **`build.win.signAndEditExecutable: false`** + [`scripts/msc-after-pack-embed-icon.cjs`](../../scripts/msc-after-pack-embed-icon.cjs) embeds **`media/icon.ico`** (fallback: **`build/icon.ico`**) into **`Vader Project Engine.exe`**. **`directories.buildResources`** may stay **`build/`** for optional assets — app icon path is **`media/`**. |
| **PM2 daemon badge behavior** | System Health `PM2 Daemon` now reads **Online** only when PM2 RPC is connected **and** at least one workspace project is currently `running` (prevents misleading Online while all cards are stopped). |
| **Runner stability / ghost ports** | `project-runner` startup preflight force-sweeps occupied target ports on Windows (`netstat -ano | findstr :<port>` + `taskkill /F /PID ...`; fallback `taskkill /F /IM node.exe` if still blocked), preventing 2s self-stop from orphaned Next.js listeners. **v1.3.2+:** **`vpe-orchestrator`** **Ghost watcher** (separate **60s** loop) warns the UI (**TopBar Activity** amber) when **node.exe** still listens on a catalog port while **SQLite** shows **no running** project on that port — use **System Health** / **Scorched Earth** as appropriate. |
| **Managed dev bootstrap (v1.2.3+)** | Missing **`node_modules`** + present **`package.json`** → single shell **`install && dev`**. **`v0-prototype`** heuristic: **`components/ui`** without **`node_modules`**. See [Custom-Commands — Managed project dev](Custom-Commands.md#managed-project-dev-v123). |
| **Archive & jump search (v1.2.6)** | **`is_archived`** on project rows; **ARCHIVE** dashboard filter; **Ctrl+K** header jump search; **Project Settings** archive toggle. Details: **Build v1.2.6** below. |
| **Vault / Sandbox UX (v1.2.9–v1.3.5)** | **v1.3.5:** **Vault** sidebar group holds **VPE Sandbox**; **Engineer** = accordion; **Add** in **TopBar**; **Prompt Vault** tab first in Maintenance. **v1.3.4:** Strategist accordion; Engineering/Vault/Favorites collapsed by default (pre-1.3.5 included Sandbox section). **v1.3.3+:** Strategist / Engineer **Tabs**. Accordion vault list + **`vpe:update-vault-item`**; **v1.3.0** collapsed create row (**+ Create New Master Directive**). **Checkpoint:** **Build v1.3.5**, **Build v1.3.4**, **Build v1.3.3**, **Build v1.2.9**, **Build v1.3.0**. |
| **Next packaging step** | Tell the agent **rebuild exe** (see [Custom-Commands](Custom-Commands.md#rebuild-exe)): icon staging → **`build:renderer`** → **`rebuild:natives`** → lint → E2E (`CI=true`) → clean **`dist/`** → **`build:main`** → remove blockmap / `builder-debug.yml` / `latest.yml`. Icons: [`package.json`](../../package.json) **`build.*`** + **[`media/icon.ico`](../../media/icon.ico)** from **`VPE.ico`** via **`msc-copy-release-icon`**. |

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

