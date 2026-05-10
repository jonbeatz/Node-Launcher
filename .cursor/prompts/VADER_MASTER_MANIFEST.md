# VADER PROJECT ENGINE (VPE): MASTER MANIFEST

**Package:** `vader-project-engine` **2.1.0** (“Hardened” / Station Prime + vault sovereignty)

**Workstation (author):** AMD Ryzen 9700x | Windows 11 25H2

**Theme:** Studio Dark (`#121212` / `#1c1c1c` / `#e02b20`)

---

## 1. SYSTEM CORE ARCHITECTURE

The VPE splits **repo code** from **writable app data** and **on-disk media vault**.

| Layer | Role | Location |
| --- | --- | --- |
| **Engine (repo)** | Electron main, Next renderer (`src/renderer`), PM2 manager, IPC | Clone path (e.g. `D:\Cursor_Projectz\Node-Launcher`) — portable |
| **Brain (userData)** | SQLite DB, settings, caches, legacy thumbnails path | `%LocalAppData%\VaderProjectEngine\user-data\` (set in `src/main/main.js` unless `VPE_E2E_USER_DATA` is set) |
| **Database** | App catalog + state | `userData/vpe-db/database.sqlite` (`src/main/db/persistent-store.js`); legacy `vader.sqlite` is migrated into `vpe-db` when present |
| **Media vault** | Per-project reference files + `_vpe_thumb.*` | Default root: `VPE_VAULT_ROOT` or (Windows) `d:\Cursor_Projectz\Node-Launcher\media\vault`, else `cwd/media/vault` (`src/main/vpe-vault-paths.js`) |

### Vault folder resolution (dual key)

`msc_projectVaultProjectDir(name, projectId)` (`vpe-vault-paths.js`):

1. Prefer a directory under the vault root named from the **sanitized display name**.
2. If that folder does not exist, use an existing directory named exactly **`projectId`** (UUID), when safe.
3. Otherwise materialize/create the primary name path. Legacy `userData/media/vault/<name>/` is migrated when the new folder is empty.

Internal vault artifacts: `.vpe_keep`, `_vpe_thumb.png` (and related), excluded from “user attachment” counts where applicable.

---

## 2. THE VADER PROTOCOL (DEVELOPMENT LAWS)

1. **Vader Shield:** No raw `fs` / `child_process` in the renderer. Use the preload bridge: **`window.vpeAPI`** (`src/preload/preload.js`) and `getVpeApi()` in the renderer (`src/renderer/lib/vpe-bridge.ts`).
2. **Environment awareness (purges):**
   - **Footer “Purge env”** → IPC `vpe:purge-launcher-ports` → `msc_purgeLauncherPorts()` in `src/main/vpe-ipc.js`. In **dev-safe** mode (`msc_isActuallyDevEnvironment()`), this **does not** `taskkill` listeners on **3000 / 3001 / 9222** (avoids killing Next and collapsing `npm run dev`). Packaged runs full port + optional Chrome `VPE*` window sweep. Override: `VPE_FORCE_PROD_PORT_PURGE=1` forces aggressive behavior; `VPE_FORCE_DEV_PORT_PURGE_SAFE=1` forces safe.
   - **System Health → Scorched Earth** → `vpe:scorched-earth` in `src/main/ipc/system-handlers.js`. **Win32 dev:** returns immediately with `{ mode: 'soft_dev' }`, then **background**: `msc_vpeStopAllEngines()`, temp scratch cleanup (`msc_softPurgeVpeTempScratch`), `msc_emitProjectsUpdated()`. **Win32 prod:** `msc_scorchedEarthWin32Steps()` from `vpe-ipc.js`. **Non-Win32:** `{ skipped: 'non_win32' }`. Isolation noop: `VPE_SCORCHED_EARTH_DEV_NOOP=1`.

   **Note:** `vpe:scorched-earth` treats dev as unpackaged **or** `NODE_ENV === 'development'`. Footer port purge uses `msc_isActuallyDevEnvironment()` in `vpe-ipc.js` (same idea plus `VPE_FORCE_*` overrides). Keep both call sites aligned when changing dev detection.

3. **Hardware / I/O:** Prefer keeping heavy main-process work bounded; for large AST or media pipelines, follow `.cursor/rules/vader-hardware-optimization.mdc` (e.g. consider `worker_threads` where implemented).
4. **Design:** Studio Dark, HUD chrome; footer must retain **“Powered by the MSC Media Engine”** (version from `window.vpeInfo?.version`, default **2.1.0** in `footer.tsx`).

---

## 3. CORE COMPONENTS (FILE MAP)

### A. Scorched Earth & launcher port purge

- **`src/main/ipc/system-handlers.js`** — `vpe:scorched-earth`, `vpe:purge-launcher-ports`, diagnostics, snapshots, terminal helpers.
- **`src/main/vpe-ipc.js`** — `msc_purgeLauncherPorts`, `msc_isActuallyDevEnvironment`, `msc_scorchedEarthWin32Steps`, port health, dev quit companion sweep (`msc_onDevExitCompanionSweep` on `before-quit` in dev paths in `main.js`).

### B. Vault dialogs (`src/main/ipc/vault-handlers.js`)

Windows: combined **“All Files”** filter rows avoid Electron defaulting to the wrong row. Win32 super-rows:

- **Vault add:** `MSC_VAULT_ADD_FILTERS_WIN32` — single row with `*` plus archives/docs extensions (`zip`, `rar`, `7z`, … `msi`, etc.).
- **Thumbnail pick:** `MSC_THUMB_FILTERS_WIN32` — `['*', 'png', 'jpg', 'jpeg', 'webp', 'gif']`.

Non-Windows uses standard multi-row filters.

### C. Renderer cards (`src/renderer/components/Msc_ProjectCard.tsx`)

Use an **explicit** `Msc_ProjectCardProps` interface and destructure only what the card needs. Do not pass arbitrary custom fields through to DOM nodes (avoids React “unknown prop” / DOM leakage). Root uses `className` `vader-card` / `vpe-project-card`.

---

## 4. OPERATIONAL WORKFLOW

### Dev stack (`package.json`)

- **`npm run dev`** — `concurrently` runs `next dev src/renderer -p 3000` and `electron . --remote-debugging-port=9222`.
- **`npm run vader:dev`** — forge-oriented `concurrently` (`-k --success first`, `VPE_LAUNCHER_FORGE=1`).

### Managed projects

- **Package manager:** `msc_detectPackageManager` in `src/main/project-detection.js` — `pnpm-lock.yaml` → `pnpm`, `yarn.lock` → `yarn`, `package-lock.json` → `npm`, else `npm`.
- **Start script:** `msc_detectProjectScripts` — prefers `dev:launcher`, then `dev`, `start`, `serve`, `develop`; default **`dev`**.
- **Execution:** PM2 programmatic API (`src/main/pm2-manager.js`); registry stores `pkg_manager`, `start_script`, `build_script`, shield type, etc.
- **Logs UI:** xterm-based drawer (dependencies `@xterm/xterm`, `@xterm/addon-fit`).

---

## 5. MAINTENANCE & REPAIR

- **Nuke project:** IPC `vpe:nuke-project` → `pm2-manager.js` `nukeProject`: stop/kill PM2 process tree, delete `node_modules` and `.next`, then run `{pkg_manager} install` (pnpm / npm / yarn from registry).
- **AST / suspense repair:** `scripts/repair/vader-fix-suspense.mjs` (use when wrapping `useSearchParams` and similar).
- **npm script stub:** `npm run repair:ast` → `scripts/vpe-repair-stub.cjs`.
- **Soft purge temp cleanup:** `vpe-(snapshot|restore)-*` dirs and `vpe-snapshot-*.zip` under `os.tmpdir()` (`msc_softPurgeVpeTempScratch`).

---

## 6. ENVIRONMENT VARIABLES (QUICK REFERENCE)

| Variable | Effect |
| --- | --- |
| `VPE_VAULT_ROOT` | Override vault root directory |
| `VPE_FORCE_PROD_PORT_PURGE=1` | Footer port purge runs production-style kills even in dev |
| `VPE_FORCE_DEV_PORT_PURGE_SAFE=1` | Force dev-safe port purge semantics |
| `VPE_SCORCHED_EARTH_DEV_NOOP=1` | Scorched Earth in dev: instant return, no background cleanup |
| `VPE_E2E_USER_DATA` | Redirect `userData` for E2E (`main.js`) |
| `VPE_LAUNCHER_FORGE=1` | Forge dev session (`vader:dev`) |
| `NODE_ENV=development` | With `isPackaged`, participates in dev detection where checked |

---

## 7. SOURCE OF TRUTH

This manifest summarizes **current** layout and behavior; when they diverge, **the repo wins**. Keep this file pinned in Cursor and update it when IPC channels, paths, or purge semantics change.

**Signature:** Powered by the MSC Media Engine v2.1.0
