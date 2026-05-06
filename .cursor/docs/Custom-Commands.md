# Custom Commands

This file tracks shorthand commands you want me to execute in this repo.

**Active branch:** `Node-Launcher-v4` (see [Checkpoint](Checkpoint.md) for full status).

**Solved problems (symptoms → fixes):** [Stability-Fix-Backlog](Stability-Fix-Backlog.md).

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

1. **Icon staging** — Ensure `build/` exists; copy **`_design_references/VPE.ico`** → **`build/icon.ico`** (source file untouched):  
   `node scripts/msc-copy-release-icon.cjs`
2. **Static Next.js export** — Compile and export the renderer to **`src/renderer/out/`** (required for packaged `loadFile` UI):  
   `npm run build:renderer`  
   Confirm **`src/renderer/out/index.html`** exists after this step.
3. **Native SQL alignment** — Rebuild **better-sqlite3** for Electron only (avoids Spectre MSVC / full-tree native rebuild traps on Windows):  
   `npm run rebuild:natives`
4. **Lint** —  
   `npm run lint`
5. **Playwright E2E** — Use **`CI=true`** so the dev server binds **`127.0.0.1`** and the suite is deterministic:  
   `CI=true npm run test:e2e` (PowerShell: `$env:CI="true"; npm run test:e2e`)
6. **Clean `dist/`** (recommended) — Remove the existing **`dist/`** folder so the next step does not leave stale installers next to the new one:  
   `Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue`
7. **Package** — NSIS + unpacked app (**`prebuild:main`** will re-run icon copy + **`build:renderer`**; that is redundant but safe):  
   `npm run build:main`
8. **Trim `dist/` junk** — Delete updater/metadata clutter so only the deliverables remain:
   - `dist/*.blockmap` (e.g. `Vader Project Engine.exe.blockmap`)
   - `dist/builder-debug.yml`
   - `dist/latest.yml`  
   **Keep:** **`dist/Vader Project Engine.exe`** (installer) and **`dist/win-unpacked/`** (portable test tree).

### Outputs

| Artifact | Path |
|----------|------|
| Installer | `dist/Vader Project Engine.exe` |
| Portable | `dist/win-unpacked/` (includes `Vader Project Engine.exe`) |

**Installed application location (NSIS multi-step wizard, per-user default):** after running the installer, the **default** directory is **`%LocalAppData%\Programs\Vader Project Engine\`** (same as `C:\Users\<you>\AppData\Local\Programs\Vader Project Engine\`). The user may change the destination in the wizard (**`allowToChangeInstallationDirectory: true`**). **`perMachine: false`** avoids requiring Administrator for the default path.

### Notes

- **Custom `.exe` icon:** With **`build.win.signAndEditExecutable: false`** (avoids winCodeSign symlink failures on some Windows setups), **`npm run build:main`** runs **`build.afterPack`** → [`scripts/msc-after-pack-embed-icon.cjs`](../../scripts/msc-after-pack-embed-icon.cjs) + **`rcedit`** to embed **`build/icon.ico`** into the main executable. See [Stability-Fix-Backlog](Stability-Fix-Backlog.md).
- **`src/renderer/out/`** is **gitignored**; always run **`build:renderer`** (or rely on **`prebuild:main`** inside **`build:main`**) before expecting a good packaged UI.
- Do not run **`npm run build:main`** without a recent **`build:renderer`** if you disabled or skipped **`prebuild:main`**.
- For a lighter loop (no installer, no E2E), use **start app** or **hardened setup** instead.
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

1. `npm run build:renderer` (or rely on **`npm run build`** step 2).
2. `npm run build` — runs **`build:renderer`** then **`build:main`** (`electron-builder`).  
   Ensure no stray **node/electron** holds locks; release icon source: [`_design_references/VPE.ico`](../../_design_references/VPE.ico) → **`build/icon.ico`** via **`msc-copy-release-icon`** (see **[rebuild exe](#rebuild-exe)**).

## new git branch

Intent: finish current iteration and start a clean next branch.

When you say **"new git branch"**, I will:

1. Check changes and commit with an appropriate message.
2. Push the current branch to remote.
3. Create/switch to the next versioned branch using this pattern:
   - `Node-Launcher-v2` (shipped major integration + CI/repair/userData work)
   - `Node-Launcher-v3` (security + packaging prep)
   - **`Node-Launcher-v4`** ← *current* (renderer `out/` gitignore + prebuild export)
   - `Node-Launcher-v5` ← *next increment*
   - …always bump the trailing version number by **1**.
4. Confirm branch is clean and ready as a new starting point.
