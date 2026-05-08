# Custom Commands

This file tracks shorthand commands you want me to execute in this repo.

**Canonical build & command rules** (`vader:*` sequencing, **`concurrently -k`**, **`asar` / `npmRebuild`**, Windows artifacts): [.cursor/docs/VPE-BUILD-PROTOCOL.md](VPE-BUILD-PROTOCOL.md).

**Active branch:** Confirm with `git status` — living status and milestones live in [Checkpoint](Checkpoint.md).

**Solved problems (symptoms → fixes):** [Stability-Fix-Backlog](Stability-Fix-Backlog.md).

## Update Docs

Intent: after a release or behavior change, **reconcile every doc surface** so agents and humans see **one** story—no stale version strings, no conflicting build rules, no orphaned UI specs.

### How to say it

Use **Update Docs** (or **update docs**, **sync documentation**) when you want a full pass with **no code change** unless something is objectively wrong (e.g. broken link). Pair it with context if only a subset changed (e.g. *"Update Docs — footer LED only"*).

### Steps I will run

1. **Version source of truth** — Read root **`package.json` → `"version"`** (and **`description"`** if it carries the build label). That string drives preload, footer copy, and doc headers.
2. **Enforcement rules** — Update [`.cursorrules`](../../.cursorrules): **Current Version**, footer signature line, and any UI bullets that changed (TopBar, sidebar, log drawer, purge/LED, forge scripts).
3. **Agent skill** — Update [`SKILL.md`](../../SKILL.md): design/footer guardrails, **`Vader Sync` / `vader:force-forge`** wording, and any version examples to match **`package.json`**.
4. **Cold-start index** — Update [AGENT-BOOT-CHECKLIST.md](AGENT-BOOT-CHECKLIST.md): **Session verification** version tick, **Quick mental model** table if ports/LED/forge behavior shifted.
5. **Build protocol** — Update [VPE-BUILD-PROTOCOL.md](VPE-BUILD-PROTOCOL.md): document title version, master table if **`package.json`** scripts changed, **§4 In-app tooling** for UI/IPC (purge, Net LED, logs, **`vader:clean-sync`** vs **`vader:sync`**). **Hardware telemetry** is **removed** (**v1.1.7+** scrubs **`cpuTemp`** from IPC/UI).
6. **This file** — Refresh [Custom-Commands.md](Custom-Commands.md): **Active branch** line (Checkpoint link), **Full protocol** parenthetical version, and any command tables that reference new scripts.
7. **Checkpoint** — Update [Checkpoint.md](Checkpoint.md): add or extend a **Build vX.Y.Z** section for the release; fix downstream lines that still say an older “current” version.
8. **Cross-links** — Align [README.md](../../README.md) (packaging line), [START-HERE.md](START-HERE.md), [Stability-Fix-Backlog.md](Stability-Fix-Backlog.md) protocol version string, and [TRUTH.md](TRUTH.md) only if architecture facts changed (do not churn TRUTH for pure marketing bumps).
9. **Shipped UI strings** — If the user-facing version label changed: [`src/preload/preload.js`](../../src/preload/preload.js) **`vpeInfo.version`**, [`src/renderer/app/layout.tsx`](../../src/renderer/app/layout.tsx) **`metadata.description`**, and [`src/renderer/components/footer.tsx`](../../src/renderer/components/footer.tsx) fallback to match **`package.json`**.
10. **Drift sweep** — `rg` (or editor search) for the **previous** patch version and fix stragglers (e.g. **`v1.1.8`** after bumping to **`v1.1.9`**).
11. **Optional** — If **`layout.tsx`** / preload changed: **`npm run lint`** and **`npm run build:renderer`** from repo root.

### Rules

- **Authority order** stays: [TRUTH.md](TRUTH.md) → **`.cursorrules`** → **`SKILL.md`** → PRD → **`package.json`** scripts. Docs describe reality; they do not invent npm scripts.
- **One version story:** every “current build” mention should match **`package.json`** unless explicitly labeled historical (archive bullets in Checkpoint).

## rebuild exe

Intent: produce a **fresh production Windows installer** and portable tree after you have changed code or assets—without you spelling out every npm script.

### How to say it

You can drop the phrase **rebuild exe** (or **rebuild the exe**) in the same message as your work context. The agent should treat it as an order to run the **full sequence** below, not just `npm run build:main`.

Examples:

- *"I just updated the main dashboard layout. **rebuild exe**."*
- *"I tweaked the terminal loading speeds. **rebuild exe**."*
- *"Ship a new installer — **rebuild exe**."*

Short variants that should expand the same way: **production build**, **full exe rebuild**, **run the release pipeline** (when clearly Windows/Electron).

### Steps I will run (repo root: `d:\Cursor_Projectz\Node-Launcher`)

Run **in order**, unless you explicitly ask to skip a gate (e.g. skip E2E):

1. **Icon staging** — Ensure **`media/`** exists; copy **`_design_references/VPE.ico`** → **`media/icon.ico`** (source file untouched):  
   `node scripts/msc-copy-release-icon.cjs`
2. **Optional fail-fast export** — If you want to catch a broken Next export *before* natives/E2E, run **`npm run build:renderer`** once and confirm **`src/renderer/out/index.html`**. Otherwise **`npm run build:main`** (step 7) runs **`prebuild:main`**, which already performs icon copy + **`build:renderer`** once—no duplicate full pipeline when you skip this optional step.
3. **Native SQL alignment** — Rebuild **better-sqlite3** for Electron only (avoids Spectre MSVC / full-tree native rebuild traps on Windows):  
   `npm run rebuild:natives`
4. **Lint** —  
   `npm run lint`
5. **Playwright E2E** — Use **`CI=true`** so the dev server binds **`127.0.0.1`** and the suite is deterministic:  
   `CI=true npm run test:e2e` (PowerShell: `$env:CI="true"; npm run test:e2e`)
6. **Clean `dist/`** (recommended) — Remove the existing **`dist/`** folder so the next step does not leave stale installers next to the new one:  
   `Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue`
7. **Package** — NSIS installer + **`win-unpacked`** tree. **`prebuild:main`** runs **once** (icon + **`build:renderer`**) then **`electron-builder`**:  
   `npm run build:main`  
   After it finishes, confirm **`src/renderer/out/index.html`** exists.
8. **Trim `dist/` junk** — Run **`npm run vpe:cleanup-dist`** (same as the tail of **`vader:post-dev-forge`** / **`vader:force-forge`**): deletes **only top-level files** in **`dist/`** — **`*.blockmap`**, **`*.yml`**, **`builder-effective-config.yaml`** — never **`win-unpacked/`**, **`*.exe`**, repo **`media/`**, or repo **`build/`**. **Keep:** **`dist/Vader Project Engine.exe`** and **`dist/win-unpacked/`**.

### Outputs

| Artifact | Path |
|----------|------|
| Installer | `dist/Vader Project Engine.exe` |
| Portable | `dist/win-unpacked/` (includes `Vader Project Engine.exe`) |

**Installed application location (NSIS multi-step wizard, per-user default):** after running the installer, the **default** directory is **`%LocalAppData%\Programs\Vader Project Engine\`** (same as `C:\Users\<you>\AppData\Local\Programs\Vader Project Engine\`). The user may change the destination in the wizard (**`allowToChangeInstallationDirectory: true`**). **`perMachine: false`** avoids requiring Administrator for the default path.

### Notes

- **Custom `.exe` icon:** With **`build.win.signAndEditExecutable: false`** (avoids winCodeSign symlink failures on some Windows setups), **`npm run build:main`** runs **`build.afterPack`** → [`scripts/msc-after-pack-embed-icon.cjs`](../../scripts/msc-after-pack-embed-icon.cjs) + **`rcedit`** to embed **`media/icon.ico`** (legacy **`build/icon.ico`** if missing) into the main executable. See [Stability-Fix-Backlog](Stability-Fix-Backlog.md).
- **`src/renderer/out/`** is **gitignored**; **`npm run build:main`** / **`npm run build:win`** always triggers **`prebuild:main`** (icon + **`build:renderer`**). **`npm run build`** is an alias that runs **`build:main` only**, so Next is not built twice unless you separately run **`build:renderer`** and then **`build:main`**.
- Electron **`asar`** is **`true`** in **`package.json`** (archive app payload). Keep **`npmRebuild`** at **`false`** for faster packs when natives are already aligned via **`npm run rebuild:natives`**.
- For a lighter loop (no installer, no E2E), use **restart app**, **start app**, or **hardened setup** instead.
- **Smoke (unpacked):** after a build, **`dist\win-unpacked\Vader Project Engine.exe`** is the fastest way to validate static UI + main-process IPC; open DevTools and confirm **`vpe:get-system-stats`** completes without clone/module errors (see [Stability-Fix-Backlog](Stability-Fix-Backlog.md) telemetry entries).

## start app

Intent: run a clean app startup.

Steps I will run when you say **"start app"**:

1. `Get-Process -Name node,electron -ErrorAction SilentlyContinue | Stop-Process -Force`
2. `npm run dev`

Notes:
- Run from repo root: `d:\Cursor_Projectz\Node-Launcher`.
- This is a destructive stop for currently running Node/Electron processes on your machine session.
- Launcher UI dev server defaults to `http://localhost:3000`; managed projects should use `3001+`.

## Vader Sync

Sequential flow: validate UI + IPC in **`npm run vader:dev`** (full Next + Electron), then the same **`vader:post-dev-forge`** tail (**`vpe-forge-pause`** → snapshot → syntax guard → **`build:win`** → **`vpe:cleanup-dist`**). **`npm run vader:sync`** adds **`-- --success last`** so **`concurrently`** does not release the shell to **`post-dev-forge`** until **all** dev children have exited. **`npm run vader:clean-sync`** runs **`rimraf dist`** first, then **`(vader:dev || …)`** so **`post-dev-forge`** still runs after dev teardown even if **`vader:dev`** exits non-zero (**no** **`--success last`**). If the syntax guard fails, the chain stops and the terminal shows **`VPE_SYNTAX_GUARD:`** lines.

**Full protocol:** [VPE-BUILD-PROTOCOL.md](VPE-BUILD-PROTOCOL.md) (v1.1.8: **`vader:clean-sync`** hardened chain, **`vader:dev-to-forge`**, **`--success last`** on **`vader:sync`**, **`&&`**, **`VPE_LAUNCHER_FORGE`**, **`rimraf dist`**, **`vpe-forge-pause`**, **`vader:force-forge`**, ASAR/native guidance).

### How **`vader:sync`** works

- Runs **`npm run vader:dev -- --success last`**: same **`concurrently -k --success first …`** as **`vader:dev`**, but **`npm`** appends **`--success last`** so **`concurrently`** uses **`last`** as the success mode — **blocking gate**: no **`&& npm run vader:post-dev-forge`** until every dev process has finished (avoids **`build:win`** racing a still-listening **Next** on **3000**). **`npm run vader:dev-to-forge`** is **`vader:dev && vader:post-dev-forge`** without that gate — use **`vader:sync`** when you need **full** teardown before the forge.
- **`npm run vader:dev`** alone (no extra args) keeps **`--success first`** for day-to-day work: closing **Electron** still **`-k`** stops **Next** quickly.
- **`--kill-others`:** when one child exits, others are signalled per **`concurrently`** rules; **`--success last`** still ties the **group** exit to the **last** process to finish.
- If either process crashes (non-zero), **`concurrently`** exits non‑zero and **`vader:post-dev-forge`** does not run.
- After dev exits **0**: **`vader:post-dev-forge`** = **`node scripts/vpe-forge-pause.cjs && npm run vpe:take-state-snapshot && npm run vpe:check-readiness && npm run build:win && npm run vpe:cleanup-dist`** — all **`&&`** gated (same chain on **`vader:force-forge`**).

### Commands (repo root)

| Command | When to use |
| :--- | :--- |
| **`npm run vader:dev-to-forge`** | **`vader:dev`** then **`vader:post-dev-forge`** when dev exits. For **no race** with **Next** on **3000**, prefer **`vader:sync`** (**`--success last`**) instead. |
| **`npm run vader:sync`** | **`vader:dev` with `--success last`**, then snapshot → syntax guard → pack. Waits for **full** dev teardown before forge. |
| **`npm run vader:clean-sync`** | **`rimraf dist`**, then **`vader:dev`** (with **`||`** fallback so forge still runs if dev exits non-zero), then **`vader:post-dev-forge`**. For **`--success last`** gating, use **`vader:sync`** instead. |
| **`npm run vader:post-dev-forge`** | Usually internal: **3s** **`vpe-forge-pause`** → snapshot + **`vpe:check-readiness`** + **`build:win`** + **`vpe:cleanup-dist`**. Same order as the tail of **`vader:sync`**. |
| **`npm run vader:force-forge`** | Same as **`vader:post-dev-forge`**. |
| **`npm run vpe:cleanup-dist`** | **`scripts/msc-cleanup-dist.cjs`** — strip **`dist/`** root **`.blockmap`**, **`.yml`**, **`builder-effective-config.yaml`** only (never **`media/`**). Also runnable standalone after **`npm run build:main`**. |
| **`npm run vpe:take-state-snapshot`** | Headless pre-forge backup only (CLI **`userData`** path mirrors main process). |
| **`npm run vpe:check-readiness`** | JS syntax guard only; exit **1** lists **`VPE_SYNTAX_GUARD:`** hits. |

**Not parallel:** packaging runs **after** dev exits—you verify first, then the 9700x runs the forge.

### Outputs

Same as **[rebuild exe](#rebuild-exe)** deliverables:

- **`dist/Vader Project Engine.exe`** (installer)
- **`dist/win-unpacked/Vader Project Engine.exe`** (unpacked runnable)

For a audited release (lint, E2E, natives, trim **`dist`**), say **[rebuild exe](#rebuild-exe)** instead of **Vader Sync**.

## restart app

Intent: **restart** the VPE dev stack—same as **start app** after killing stray processes so a fresh **`npm run dev`** comes up (Next + Electron).

### How to say it

Use **restart app**, **restart the app**, or **restart dev** when you want the agent to stop existing **node/electron** then run **`npm run dev`** again. Use **`npm run vader:sync`** when you want **`--success last`** before the forge tail, or **`npm run vader:clean-sync`** when you also need **`rimraf dist`** first (**hardened `||` gate** — see **[Vader Sync](#vader-sync)**).

### Steps I will run when you say **restart app**

1. `Get-Process -Name node,electron -ErrorAction SilentlyContinue | Stop-Process -Force`
2. `npm run dev`

Notes:

- Run from repo root: `d:\Cursor_Projectz\Node-Launcher`.
- Same destructive stop semantics as **start app**; prefer this phrase when you explicitly mean “kill and bring dev back” after code or MCP changes.

## hardened setup (lint, natives, e2e)

Intent: reproduce a clean local pipeline after dependency or Node upgrades (especially **Node 24+**).

Run from repo root, in order:

1. Stop processes (same as **start app**):  
   `Get-Process -Name node,electron -ErrorAction SilentlyContinue | Stop-Process -Force`
2. Optional — clear Next dev output:  
   `Remove-Item -Recurse -Force src/renderer/.next -ErrorAction SilentlyContinue`
3. Install (peer deps are already controlled by **`.npmrc`** `legacy-peer-deps=true`):  
   `npm install`  
   Do **not** append `--legacy-peer-deps` to **`npx @electron/rebuild`** — that flag is for **npm** only; passing it to the rebuild CLI causes **`ERR_PARSE_ARGS_UNKNOWN_OPTION`** on Node 24.
4. Rebuild **better-sqlite3** for the installed Electron:  
   `npm run rebuild:natives`  
   (runs `electron-rebuild -f -o better-sqlite3` — **`--only`** so **node-pty** is not rebuilt; full-tree rebuild can require **Spectre-mitigated** MSVC libs on Windows.)
5. Optional — Playwright browser + OS deps (Windows):  
   `npx playwright install chromium --with-deps`
6. Sanity scripts:  
   `npm run repair:ast` → `npm run test:e2e` → `npm run lint`

## package production (.exe)

Intent: ship Electron installer after renderer is production-built.

**Preferred:** say **[rebuild exe](#rebuild-exe)** — that runs the full audited pipeline (icon → export → natives → lint → E2E → clean **`dist/`** → **`build:main`** → trim metadata).

**Minimal (when you already ran quality gates):**

1. `npm run build` or **`npm run build:win`** — both run **`build:main`**. **`prebuild:main`** runs icon copy + **`build:renderer`**, then **`electron-builder`** (NSIS **`dir`** + **`nsis`**).  
   Ensure no stray **node/electron** holds locks; release icon source: [`_design_references/VPE.ico`](../../_design_references/VPE.ico) → **`media/icon.ico`** via **`msc-copy-release-icon`** (see **[rebuild exe](#rebuild-exe)**).

## new git branch

Intent: finish current iteration and start a clean next branch.

When you say **"new git branch"**, I will:

1. Check changes and commit with an appropriate message.
2. Push the current branch to remote.
3. Create/switch to the next versioned branch using this pattern:
   - `Node-Launcher-v2` … `Node-Launcher-v8` (historical milestones)
   - **`Node-Launcher-v9`** ← *example “current”* — **always confirm with `git status`**
   - `Node-Launcher-v10` ← *next increment*
   - …always bump the trailing version number by **1** when cutting a new integration branch.
4. Confirm branch is clean and ready as a new starting point.

## Playwright MCP (aligned with VPE)

Global Cursor config uses **`@playwright/mcp`** only (redundant **`@modelcontextprotocol/server-puppeteer`** removed). Two entries, same package, different jobs:

| MCP name (in `mcp.json`) | When to use | How it works |
| :--- | :--- | :--- |
| **`playwright`** | Renderer / CI parity | Launches **Chrome** (Chromium channel), `--allowed-hosts` `127.0.0.1,localhost`, **`--caps devtools`**. Matches **CI** (`npx playwright install chromium --with-deps`) and **`playwright.config.ts`** (`baseURL` `http://127.0.0.1:3000`). Use with **`npm run dev:renderer`** or when the UI is already served on **3000** and you want a fresh browser the MCP controls. |
| **`playwright-electron`** | Full Electron + IPC | **`--cdp-endpoint http://127.0.0.1:9222`** — attaches to the **running** Electron shell (no second standalone browser). Use when **`npm run dev`** or **`npm run start`** is up so **main + renderer + preload** behavior is under test. |

Thumbnail capture inside the app remains **`puppeteer-core`** in main process; that is unrelated to Cursor MCP choice.

## connect app with playwright-electron (CDP)

Intent: attach Cursor’s **`playwright-electron`** MCP to the **already running** Electron app for live UI diagnostics (same role the old “Puppeteer MCP + 9222” flow described).

### Prerequisites

1. Electron must expose remote debugging (repo default):
   - `package.json` **`dev:main`** / **`start`**: `electron . --remote-debugging-port=9222` (and main should bind **`127.0.0.1`** per your `main.js` flags).
2. Start the full stack in dev:
   - `npm run dev` (or `npm run start` for main only + ensure renderer is up as needed)

### Verify debug endpoint is live

Run:

- `Invoke-WebRequest -UseBasicParsing http://127.0.0.1:9222/json/version`
- `Invoke-WebRequest -UseBasicParsing http://127.0.0.1:9222/json/list`

Expected:

- A **Vader Project Engine** target with URL `http://localhost:3000/` (or similar) and a `webSocketDebuggerUrl`.

### MCP attach workflow

When asking Cursor to test the running **Electron** app:

1. Do **not** ask the generic **`playwright`** MCP to open a unrelated browser unless you intentionally want renderer-only.
2. Use tools from the **`playwright-electron`** server (CDP connected to **`9222`**).
3. Open / focus `http://localhost:3000/` (or `127.0.0.1:3000`) in that session.
4. Evaluate dashboard state (e.g., `PM2 Daemon`, projects active) and collect console/network output (**`devtools`** cap enabled).

### Quick troubleshooting

- `ERR_CONNECTION_REFUSED` on **`9222`**: Electron not launched with **`--remote-debugging-port=9222`**; use **`npm run dev`** from repo root.
- Stale dashboard while ports look busy: ensure CDP **`json/list`** target is **`Vader Project Engine`**, not a DevTools orphan page.

### Duplicate Neon MCP

If you still see **two** Neon HTTP entries in Cursor, keep a **single** `neon-postgres` (or one Neon) streamable-http server—duplicate Neon configs register the same remote twice.

## mcp sanity check

Intent: quickly verify global MCP server readiness after config/package changes.

Run from PowerShell:

1. Verify key CLIs:
   - `cmd /c plugship --version`
   - `cmd /c pm2 --version`
2. Smoke-run MCP servers (start should print startup lines; then stop process):
   - `cmd /c npx -y @zengwenliang/mcp-server-sequential-thinking`
   - `cmd /c npx -y @verygoodplugins/mcp-local-wp@latest`
   - `cmd /c npx -y task-master-ai`
   - `cmd /c npx -y @mako10k/mcp-shell-server`
3. WordPress MCP (Windows-safe direct entry):
   - `cmd /c "set WORDPRESS_SITE_URL=<url> && set WORDPRESS_USERNAME=<user> && set WORDPRESS_APP_PASSWORD=<app-password> && node C:\Users\JONBEATZ\AppData\Roaming\npm\node_modules\mcp-wordpress\dist\index.js"`
4. Brave MCP:
   - Ensure `BRAVE_API_KEY` is set in `C:\Users\<you>\.cursor\mcp.json`
   - `cmd /c npx -y @brave/brave-search-mcp-server --transport stdio`

### Extended checks (added 2026-05-06 night)

5. Postgres MCP (isolated Python 3.12 runtime):
   - `C:\Users\JONBEATZ\.cursor\venvs\postgres-mcp312\Scripts\postgres-mcp.exe --help`
   - Verify `DATABASE_URI` set under `postgres.env` in global `mcp.json`.
6. Postman MCP:
   - `cmd /c npx -y @postman/postman-mcp-server@latest --full`
   - If it exits immediately with env validation, set `POSTMAN_API_KEY` and re-test.
7. Resend MCP:
   - `cmd /c npx -y resend-mcp --help`
   - Set `RESEND_API_KEY` before live usage.
8. Cursor Rules Generator MCP:
   - `cmd /c npx -y cursor-rules-generator-mcp@latest`
   - Expected behavior: starts and stays running on stdio until disconnected.
9. Local `mcp-vercel` build:
   - `node C:\Users\JONBEATZ\.cursor\tools\mcp-vercel\build\index.js`
   - Requires `VERCEL_API_TOKEN` env; missing token error confirms binary is reachable.

10. **Playwright MCP** (matches global `mcp.json` **`playwright`** + **`playwright-electron`**):
   - `cmd /c npx -y @playwright/mcp@latest --help` — confirms the MCP package resolves and exits cleanly.
   - **Browser install** (needed before first real MCP-driven session): from repo root, `npx playwright install chromium` — same Chromium family CI uses (**`npm run test:e2e`** via [`ci.yml`](../../.github/workflows/ci.yml)); on Windows without Linux deps use `chromium` or `chrome` per Playwright’s installer output if one fails.
   - **CDP / Electron** (optional, for **`playwright-electron`**): run **`npm run dev`**, then `Invoke-WebRequest -UseBasicParsing http://127.0.0.1:9222/json/version` — expect JSON; failures mean Electron is not up with **`--remote-debugging-port=9222`**. Same flow as [**Playwright MCP (aligned)**](#playwright-mcp-aligned-with-vpe) above.

# Custom Command Shortcuts
- If the user says "start API" (or any variation like "start server" or "run litellm"), you must immediately open a PowerShell terminal and run these two commands in order:
  1. $env:GOOGLE_APPLICATION_CREDENTIALS="D:\\Cursor_Projectz\\Node-Launcher\\gcp_key.json"
  2. litellm --config litellm_config.yaml

