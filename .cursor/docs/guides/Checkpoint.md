# CHECKPOINT (v2.2.6-SOVEREIGN)

This document serves as the authoritative build and branch history for the Vader Project Engine.

## 📦 Active Branch: VPE-JediBuild-v1.3

### Build History & Milestones

#### [2026-05-18] - Zero-Hardcoding Path Refactor & Ghost Vault Fix (v2.2.6-SOVEREIGN Patch)

- **Status:** PATCHED & VERIFIED (no version bump; architectural hardening on sovereign baseline).
- **Branch:** `VPE-JediBuild-v1.3` (working tree changes, not committed)
- **Files Changed:**
  - `src/main/vpe-vault-paths.js` — removed hardcoded `Node-Launcher` / `Node-Launcher-v3` Windows paths; introduced `msc_resolveVaultAppRoot()` using `app.getAppPath()` priority chain
  - `src/main/db/persistent-store.js` — added `msc_runLegacyPathHealingMigration(db)` boot-time SQLite path self-healer; cleared dead `SEED_PROJECTS` placeholder; exported new function
  - `src/main/main.js` — added `msc_vpeCleanupLegacyWorkspaceFolders()` to delete ghost `Node-Launcher` / `Node-Launcher-v3` folders on first boot
  - `src/main/ipc/vault-handlers.js` — fixed `vpe:pick-thumbnail` draft-mode path: skip vault write, return `data:` URL directly; vault folder only created at final `vpe:add-project` submit
  - `VADER_STATION_LOG.md` — session entries added
- **Bugs Fixed:**
  1. **Ghost vault folders** (`Node-Launcher/` and `Node-Launcher-v3/`) created on every boot due to hardcoded paths in `vpe-vault-paths.js`
  2. **Stale SQLite rows** with old absolute paths after workspace rename; self-healing migration fixes on boot
  3. **Double vault folder** on Add Project (e.g., `PUBLIC/` + `TSL-v2/`): caused by `vpe:pick-thumbnail` writing vault in draft mode before final name confirmed
- **Validation:** `npm run start-project:smoke` → exit 0 after each change

#### [2026-05-17] - WordPress-Local Bug Sprint (v2.2.6-SOVEREIGN Patch)
- **Status:** PATCHED & VERIFIED (no version bump; all changes are runtime/UI hardening on the existing sovereign baseline).
- **Branch:** `VPE-JediBuild-v1.3` (uncommitted — working tree changes, operator did not request commit)
- **Files Changed:**
  - `src/main/project-runner.js` — Three-gate LocalWP GraphQL defense, `stopAllWordPressSites()`, IWWI_v3 project addition
  - `src/renderer/components/add-project-modal.tsx` — Thumbnail preview state fix (camera icon default), `msc_modalThumbnailPreviewSrc` scheme guard
  - `src/renderer/app/page.tsx` — `key={selectedProjectId}` on `<ProjectSettingsModal>` for state isolation
  - `src/main/vpe-ipc.js` — `msc_vpeStopAllEngines` calls `stopAllWordPressSites(true)` before PM2/PTY sweep
- **Bugs Fixed:**
  1. **Port-4000 conflict** — LiteLLM on :4000 caused false-positive LocalWP detection; three-gate defense resolves this
  2. **Purple "D" / broken thumbnail** in Add New Project modal; camera icon now default
  3. **STOP ALL did not stop LocalWP sites**; `stopAllWordPressSites` + Local.exe minimize
  4. **Project settings state bleed** between cards; fixed with React `key` prop
- **New Project:** IWWI_v3 (`F:\Websitez\IndieWorldWideInc\Local_WP\IWWI_v3\app\public`, type `wordpress-local`) added via CDP fallback
- **Validation:** Full end-to-end WordPress start → browser verify → STOP ALL verified via `playwright-electron` MCP + PowerShell CDP fallback
- **MCP Notes:** `playwright-electron` runs on CDP port **9225** (set via `VPE_REMOTE_DEBUG_PORT=9225`; configured in `.cursor/mcp.json`)

#### [2026-05-16] - WordPress-Local HTTP Redirect Fix
- **Status:** SHIPPED (working tree, not committed).
- **Highlights:** Added `msc_writeWpVpeMuPlugin()` / `msc_removeWpVpeMuPlugin()` to force `WP_HOME`/`WP_SITEURL` to `http://` via mu-plugin, preventing WordPress 301 → HTTPS redirect loops. Added `msc_findLocalExePath()` multi-path discovery for `Local.exe`.

#### [2026-05-15] - v2.2.6-SOVEREIGN (Current Baseline)
- **Status:** READY FOR DUTY.
- **Commit:** `0ef167b` (docs(mcp): integrate agent-browser and design validation workflows).
- **Major Features:**
  - Integrated `agent-browser`, `firecrawl`, and `animate-ui` MCPs.
  - Added `@google/design.md` CLI for automated design system validation.
  - Retired Figma from the Sovereign workflow in favor of Registry-First UI patterns.
  - Consolidated documentation into `.cursor/docs/`.
- **Validation:** `npm run start-project:smoke` PASSED.

#### [2026-05-14] - v2.2.5 (Iron Curtain Baseline)
- **Commit:** `d7e129b` (docs: LiteLLM bridge runbook and End Project API teardown).
- **Highlights:** Established the "Iron Curtain" version gate (v2.2.5+) to protect sovereign data layouts.

#### [2026-05-13] - EOD Checkpoint
- **Commit:** `4fb5fa2` (docs: End Project — MCP audit and GitHub MCP smoke test).
- **Highlights:** Verified GitHub MCP and performed initial plugin audit.

### 🚀 Release Strategy
- **Installer:** Generated via `npm run build:win`.
- **Archive:** Portable `.zip` bundles stored in `dist/`.
- **Upload:** Automation handled by `scripts/upload_build.ps1` (JediBuild release prefix).

---
*Last Updated: 2026-05-18 09:59 (Vader Station Time)*
