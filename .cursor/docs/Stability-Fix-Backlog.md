# Stability & fix backlog (resolved)

Living notes for **problems we hit and how we fixed them**—mostly Windows packaging, Electron, and Next static export. For day-to-day commands, see [Custom-Commands](Custom-Commands.md). For **deterministic build sequencing** ( **`vader:sync`** with **`--success last`**, **`vader:dev-to-forge`**, **`vader:post-dev-forge`**, **`asar`** / natives, **`dist/` hygiene**), see [VPE-BUILD-PROTOCOL](VPE-BUILD-PROTOCOL.md) (**v1.1.7**).

---

## Dev: Electron window blank (#121212) while `http://localhost:3000` works in Chrome

**Symptom:** `npm run dev` opens the shell, but the **Electron** window stays empty (Studio Dark background only). Browser at **3000** shows the dashboard. Main log may show `Failed to load URL: http://localhost:3000/ … ERR_CONNECTION_REFUSED`.

**Cause:** `concurrently` starts **Electron** and **Next** together; **`BrowserWindow.loadURL`** ran before the Next dev server accepted connections, and the failed navigation was not retried.

**Fix in repo:** [`src/main/main.js`](../../src/main/main.js) waits for TCP/HTTP readiness via [`src/main/wait-dev-server.js`](../../src/main/wait-dev-server.js) before `loadURL`, and uses **`did-fail-load`** retries (skipping benign **`ERR_ABORTED`**). Log should show **`Vader Shield: UI load URL`** after **`GET / 200`** from Next.

---

## Dev: Card shows red **Offline (no TCP/HTTP)** then green after **Start**

**Symptom:** Project status **RUNNING** but card line flashes **Offline (no TCP/HTTP)** while Next/compilers warm up.

**Cause:** [`project-runner.js`](../../src/main/project-runner.js) persisted **`health_reachable: false`** on the first failed HTTP probe (~3s), which sets **`health_checked_at`** and triggers the card’s red branch in [`Msc_ProjectCard.tsx`](../../src/renderer/components/Msc_ProjectCard.tsx) even though the dev server is still starting.

**Fix in repo:** Do **not** persist TCP/connect failures to SQLite until **`MSC_STARTUP_GRACE_MS`** (20s after spawn). Any **`reachedServer: true`** (HTTP received, incl. redirects) still updates immediately. First probe fires at **`MSC_HEALTH_FIRST_MS`** (1800ms) per [`health-scheduler.js`](../../src/main/health-scheduler.js).

---

## Windows: `winCodeSign` / 7-Zip symlink failure during pack

**Symptom:** `electron-builder` fails while extracting `winCodeSign-2.6.0.7z`: *Cannot create symbolic link : A required privilege is not held by the client* (darwin `libcrypto.dylib` / `libssl.dylib` inside the archive). Retries do not help.

**Cause:** `app-builder` invokes **rcedit** for the main `.exe`, which pulls the **winCodeSign** tool bundle; extraction uses **`7za … -snld`** (preserve symlinks). Creating those symlinks on Windows without **Administrator** or **Developer Mode** fails.

**Fix in repo:** Keep `package.json` → `build.win.signAndEditExecutable: false` so electron-builder does **not** extract **winCodeSign** (and that symlink path) during pack.

**Follow-up (2026-05-06, verified):** Embed the **Explorer file icon** on the main app `.exe` without winCodeSign by wiring **`build.afterPack`** → [`scripts/msc-after-pack-embed-icon.cjs`](../../scripts/msc-after-pack-embed-icon.cjs), which runs the **`rcedit`** npm package against **`dist/win-unpacked/Vader Project Engine.exe`** using staged **`build/icon.ico`**. **`npm run build:main`** succeeds on a normal user session; installed and portable builds show the **custom icon**, and **NSIS uninstall works correctly** with the interactive installer settings below.

**If you want electron-builder’s built-in rcedit path only:** Enable **Windows Developer Mode** (or build from an elevated shell) and set **`signAndEditExecutable: true`**, then remove or no-op the **`afterPack`** hook to avoid double-patching the same binary.

**Related env (runner):** `scripts/msc-run-electron-builder.cjs` sets `CSC_IDENTITY_AUTO_DISCOVERY=false` and clears stray `CSC_LINK` / `WIN_CSC_LINK` so signing does not pull unexpected cert/tool paths.

---

## Pack step: `node-gyp` / Visual Studio not found (`better-sqlite3`)

**Symptom:** `electron-builder` fails during “rebuilding native dependencies” with *Could not find any Visual Studio installation* when rebuilding `better-sqlite3`.

**Cause:** Builder’s default **npm rebuild** for native modules runs **node-gyp** in a context that may not see VS Build Tools the same way as a manual `electron-rebuild`.

**Fix in repo:** `package.json` → `build.npmRebuild: false`. Always run **`npm run rebuild:natives`** (`electron-rebuild -f -o better-sqlite3`) **before** `npm run build:main` so only **better-sqlite3** is aligned to Electron’s ABI (and **node-pty** is not dragged into a Spectre‑mitigated MSVC rebuild on Windows).

---

## Packaged app: blank window + generic UI

**Symptom:** Installer runs but the window is blank; dev mode works.

**Causes (stacked):**

1. **No real static export** — `next build` without `output: 'export'` does not produce a loadable `index.html` tree under `src/renderer/out/`.
2. **Wrong load API** — `loadURL('file://…')` on Windows is fragile vs **`loadFile()`** for paths with spaces and ASAR layout.
3. **`assetPrefix` + `next/font/google`** — Static export for **Electron `file://`** needs **relative** asset URLs (`./_next/...`). `assetPrefix: './'` in the production build phase conflicts with **`next/font/google`** (build error: *assetPrefix must start with a leading slash or be absolute URL*).

**Fixes in repo:**

- `src/renderer/next.config.mjs` — `output: 'export'`, `images.unoptimized: true`, and `assetPrefix: './'` only in **`phase-production-build`** so `next dev` stays healthy.
- `src/main/main.js` — `msc_getRendererIndexPath()`, production **`mainWindow.loadFile(msc_indexHtml)`**, log if bundle missing.
- `src/renderer/app/layout.tsx` + `globals.css` — drop `next/font/google`; load **Montserrat** via **`@import`** + `--font-sans` so export + `./` prefix builds cleanly.

---

## Git / electron-builder: `src/renderer/out` missing from installs

**Symptom:** Pack succeeds locally but UI still blank if export never ran—or GitHub Desktop shows hundreds of `out/` files.

**Cause:** Root **`.gitignore`** had `out/`, which matches **`out`** directories in subpaths, so **`src/renderer/out/`** was ignored by git *and* cluttered the working tree when built.

**Fix in repo:**

- `.gitignore` — use **`/out/`** for repo-root only; add explicit **`src/renderer/out/`** so the static export is **not** tracked but is documented as generated.
- `package.json` **`prebuild:main`** — `msc-copy-release-icon` **and** `npm run build:renderer` so **`npm run build:main`** always refreshes the export before `electron-builder` runs.

---

## electron-builder v26: invalid `win.sign`

**Symptom:** Config validation error: *configuration.win has an unknown property 'sign'*.

**Fix:** Remove deprecated `win.sign`; rely on `CSC_IDENTITY_AUTO_DISCOVERY=false` and no cert env for unsigned local builds (see runner script above).

---

## Playwright E2E: flaky or wrong server URL

**Symptom:** `test:e2e` fails when port **3000** is in use or `localhost` resolves inconsistently.

**Mitigation:** Run with **`CI=true`** so `playwright.config.ts` starts the dev server on **`127.0.0.1`** and uses a deterministic `baseURL` (see [Custom-Commands — rebuild exe](Custom-Commands.md#rebuild-exe)).

---

## Post-installer clutter in `dist/`

**Symptom:** Extra files next to the installer (`*.blockmap`, `builder-debug.yml`, `latest.yml`) confuse “what to ship.”

**Routine:** After a successful **`npm run build:main`**, delete those files and keep only **`dist/Vader Project Engine.exe`** and **`dist/win-unpacked/`** (automated in the **rebuild exe** pipeline in Custom-Commands).

---

## Telemetry IPC: structured clone / “object could not be cloned”

**Symptom:** DevTools shows **`Error: An object could not be cloned`** when invoking **`vpe:get-system-stats`**.

**Cause:** The main process returned a value that **Structured Clone** cannot serialize (e.g. non-plain objects attached to the payload).

**Fix in repo:** [`src/main/vpe-ipc.js`](../../src/main/vpe-ipc.js) builds **`msc_buildSanitizedSystemStatsPayload`** with **only** numbers, strings, and plain nested objects. [`use-vpe-system-stats.ts`](../../src/renderer/hooks/use-vpe-system-stats.ts) validates the shape before `setState`; [`vpe-bridge.ts`](../../src/renderer/lib/vpe-bridge.ts) documents the contract.

---

## Telemetry / production: `Cannot find module` after `pm2.list()`

**Symptom:** Unhandled promise rejection or console errors on **`vpe:get-system-stats`** in **`win-unpacked`** builds: **`Cannot find module`** for an optional PM2-related dependency.

**Cause:** **`pm2.list()`** triggers **lazy** requires inside the PM2 dependency graph; some paths break when the app is packaged under **ASAR** or optional deps are missing.

**Fix in repo:** Telemetry **does not** call **`pm2.list()`**. **Online/offline** reflects **`MSC_PM2Manager`** after successful **`pm2.connect`** ([`pm2-manager.js`](../../src/main/pm2-manager.js) **`msc_isPm2RpcConnected()`**). CPU/memory use Node’s built-in **`os`** only in the telemetry handler ([`vpe-ipc.js`](../../src/main/vpe-ipc.js)). **`build.asarUnpack`** includes **`**/node_modules/pm2/**/*`** so the rest of the PM2 integration still resolves reliably.

---

## PM2 badge stayed Online when all cards were stopped

**Symptom:** System Health `PM2 Daemon` remained **Online** even after `Stop All` and no active workspace projects.

**Cause:** Badge logic only reflected global PM2 reachability, not workspace-managed runtime state.

**Fix in repo:** [`pm2-manager.js`](../../src/main/pm2-manager.js) now returns true only when both are true:
- PM2 RPC client is connected
- At least one workspace project row is `status === 'running'`

This aligns the badge to managed projects, not just machine-wide daemon presence.

---

## Windows ghost process held project port (self-stop after ~2s)

**Symptom:** Projects (notably Next.js dev cards) exited with code 1 immediately because target port was already occupied by orphaned Node/Next processes.

**Cause:** Prior preflight only detected in-use ports and errored; it did not automatically purge stale listeners.

**Fix in repo:** [`project-runner.js`](../../src/main/project-runner.js) preflight now:
- Checks configured project port
- On Windows, runs native sweep (`netstat -ano | findstr :<port>`) and kills owning PID(s) via `taskkill /F /PID ...`
- Rechecks the port before continuing
- Uses last-resort `taskkill /F /IM node.exe` if the port still appears blocked

Additional hardening:
- Startup safety kill waits for both **15s grace** and **5 consecutive failed probes**
- Windows spawn path uses direct `npm.cmd` / `pnpm.cmd` / `yarn.cmd` with `shell: false`

---

## Packaged boot crash: main-process parse error from `app.asar` (tray path)

**Symptom:** `win-unpacked` app showed main-process syntax crash (`await is only valid...`) pointing at tray path even though source files were valid.

**Cause:** Packaging/runtime issue around ASAR-loaded main files on this environment; source `src/main/*.js` syntax checked clean.

**Fix in repo (current operational mode):**
- `package.json` → `build.asar = false`

This de-bricks startup and keeps packaging stable while preserving all runtime fixes.

---

## NSIS install path / interactive wizard + uninstall (per-user)

**Symptom:** Desire predictable install location without **`Program Files`** elevation friction, plus a **guided installer** (Next / review destination) instead of a silent one-click flow; uninstaller must behave correctly.

**Fix in repo:** **`build.nsis`**: **`perMachine: false`** (per-user, no admin by default), **`oneClick: false`**, **`allowToChangeInstallationDirectory: true`** → multi-step NSIS wizard with a visible install directory; default remains under **`%LocalAppData%\Programs\Vader Project Engine\`** unless the user changes it. **`installerIcon`** / **`uninstallerIcon`** use **`build/icon.ico`**. **`build.appId`:** `com.vader.projectengine`. **Verified 2026-05-06:** custom **.exe** icon (via **`afterPack` + `rcedit`**, see winCodeSign section) and **uninstaller** behavior confirmed in production builds.

---

## Dev dependency: `rcedit` for post-pack icon embedding

**Why:** Same as the winCodeSign section—embedding via **`signAndEditExecutable: true`** can fail on Windows when **7za** cannot create symlinks during **winCodeSign** extraction.

**In repo:** **`rcedit`** is a **devDependency**; the hook runs only at build time and is **not** shipped in the packaged app’s `node_modules` artifact (build **`files`** excludes `scripts/`). Staging for release still uses **`node scripts/msc-copy-release-icon.cjs`** so **`build/icon.ico`** matches **`_design_references/VPE.ico`**.

---

*Last updated: 2026-05-07 — align with [Checkpoint](Checkpoint.md); **build v1.1.7**; git branch: **confirm with `git status`**. Powered by the MSC Media Engine.*
