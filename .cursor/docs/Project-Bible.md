# 🛸 THE VADER PROJECT BIBLE (v2.2.6-SOVEREIGN)

## 1. CORE ARCHITECTURE & HANDSHAKE
- **The Bridge:** The app uses a "Dual-Bridge" IPC strategy via `preload.js`.
    - `vpeAPI`: Modern, sanitized invokes using `msc_invoke()` for error handling.
    - `mscLegacyAPI`: Reserved for core telemetry and PM2 start/stop/nuke paths.
- **Process Identity:** PM2 processes are named using the pattern: `row.name ? msc_safeVaultFolderName(row.name) : String(row.id)`.
- **Telemetry Pulse:** A centralized heartbeat emits `msc_telemetryUpdate` every 2s in the shape `[{id, cpu, memory, status}]`.

## 2. DATA SOVEREIGNTY & DATABASES
- **SQLite Engine:** The primary catalog is SQLite under the **sovereign** project `data/` tree (see `persistent-store.js` / `LOGIC_MOD_01`); dev also uses `vpe-local-data` where configured.
- **The Iron Curtain:** A version-gate in `main.js` (`msc_ironCurtainVersionAudit`) blocks any engine **older than v2.2.5** from mounting legacy-incompatible layouts—prevents registry/vault corruption when a stale EXE opens new data.
- **Persistence:** Settings and project states are managed via `persistent-store.js`.

## 3. MEDIA VAULT & PROTOCOLS
- **Root Path:** The engine uses `msc_projectVaultRootDir()` / **`msc_projectVaultRootDirSovereign()`** (Windows v2 baseline: `Node-Launcher-v2/media/vault`), overridable via `VPE_VAULT_ROOT`.
- **Custom Protocol:** Thumbnails are served via the privileged **`vpe-vault:`** / related handlers (see `vpe-vault-protocol.js`) to bypass Chromium `file://` limits.
- **The Guard:** `vpe-vault-rm-guard.js` intercepts dangerous deletes; exemptions exist for controlled forge/diagnostic paths.

## 4. NAMING CONVENTIONS & CODING SKILLS
- **Function Prefix:** All core engine functions must be prefixed with `msc_`.
- **File Naming:** Strictly use `kebab-case` for files (e.g., `system-handlers.js`).
- **Hardware Tuning:** The engine is optimized for the **AMD Ryzen 9700x**. Telemetry uses delta-calculations where applicable.
- **Safety First:** Electron IPC handlers return serialized errors; avoid throwing across the bridge without a catch at the preload boundary.

## 5. THE "GREAT LIBRARY" (DOCS)
- **`Project-Bible.md`** (this file): Architecture, workflow, and **what we fixed** (see §8).
- **`TRUTH.md`**: IPC map and technical specifications (when present in `.cursor/docs/`).
- **`VADER_STATION_LOG.md`**: Version history and milestone narratives (repo root).
- **`REPAIR_PROTOCOLS.md`**: SOPs for nuke, forge, and vault recovery.

## 6. MASTER WORKFLOW RULES
1. **Never merge bridges:** Keep `vpeAPI` and `mscLegacyAPI` separate to avoid UI breakage.
2. **Path Integrity:** Always use `path.join()` and `path.resolve()`. Never hardcode slashes.
3. **Ghost Prevention:** No `msc_invoke` call in preload without a matching `ipcMain.handle` in main.
4. **Signature Requirement:** Major UI/logic updates ship with: **Powered by the MSC Media Engine · v2.2.6-SOVEREIGN** (from `package.json` / `window.vpeInfo.version`).

## 7. THE FORGE: VADER COMMAND PROTOCOLS

These commands are tuned for the **Sovereign Baseline** and the **Iron Curtain**.

### 1. DEVELOPMENT & SYNC (Daily Workflow)
* **`npm run vader:dev`** — Next.js renderer + Electron main.
* **`npm run vader:sync`** — Dev then post-dev forge checks.
* **`npm run vader:clean-sync`** — Deep clean + rebuild path when the tree is suspect.

### 2. PRODUCTION & DISTRIBUTION
* **`npm run vader:deploy`** — Clean-sync then Windows packaging.
* **`npm run build:win`** — Package when the tree is already verified clean.

### 3. MAINTENANCE & REPAIR
* **`npm run vault:reconcile-msc`** — Rescan `media/vault` vs registry when thumbnails/links drift.

### 4. EMERGENCY RESET
* **`npm run vpe:force-clear`** (see `package.json`) — Clears running EXE / temp artifacts as defined in scripts.

### 5. HARD RESET (dependencies + cache)
`rm -rf node_modules .next dist && npm install && npm run vader:dev` (Unix-style; on Windows use PowerShell equivalents or provided scripts).

---

## 8. SOLVED PROBLEMS & WHAT FIXED THEM (2026-05-12)

### Reclaimed projects / incomplete repo paths (JEDI_MOD_132–135, 136)
- **Symptom:** Registry rows with missing folders or no `package.json` caused hard failures, red **Environment** toasts (“Project folder does not exist”), cards flipping to **Offline (no TCP/HTTP)** and **VIEW ERROR CONSOLE**, and aggressive health shutdowns while the UI still showed “running.”
- **Fixes:**
  - **`path-guard.js`:** `msc_normalizePersistedProjectPath` + `msc_registryProjectRootExists` — persist and enrich paths **without** requiring a full Node tree on disk; **`@file`** header documents **repo root vs `media/vault`** (never register the vault as the npm cwd).
  - **`project-handlers.js`:** `msc_resolveProjectDotEnvAbs` — missing disk root returns **harmonized** resolve for reads (empty `.env`); writes return `suppressToast` so the renderer does not spam errors.
  - **`project-runner.js`:** `msc_shouldHarmonizeHttpProbe` — skips persisting unreachable HTTP / safety-kill when there is no runnable `package.json` (or no folder).
  - **`project-detection.js`:** `vpe_repo_runnable_for_http` on enriched rows.
  - **`Msc_ProjectCard.tsx` / `project-list-view.tsx`:** Staging / idle copy instead of red offline when the repo is not HTTP-runnable yet.

### Terminal noise & production polish (JEDI_MOD_138)
- **Symptom:** Boot logged large migration objects (`[VPE BOOT MEDIA ALIGN]`, vault sync dumps, sovereign SQLite path) and the renderer logged layout sync noise—fine for debugging, noisy for daily ops.
- **Fixes:** Removed or trimmed those `console.log` paths in **`vpe-ipc.js`**, **`system-handlers.js`**, **`persistent-store.js`**, **`vpe-ui-layout-context.tsx`**; kept warnings on real failures and a single **`[VPE SUCCESS]`** IPC registration line.

### Version & branding
- **Ship:** **`package.json`** version **`2.2.6-SOVEREIGN`** · preload **`vpeInfo.version`** · footer uses **`msc_mscEngineFooterLine()`** (same string across dashboard, settings, terminal chrome).

---

**Standard Operating Procedure:** Run diagnostics / path repair from the UI before packaging when the catalog or vault was hand-edited.

**Baseline Established:** May 12, 2026  
**Sovereign Status:** ACTIVE  
**Signature:** Powered by the MSC Media Engine · v2.2.6-SOVEREIGN
