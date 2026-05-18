# REPAIR PROTOCOLS (v2.2.6-SOVEREIGN)

This document contains runbooks for **Nuke**, **Forge**, and **Vault** maintenance in the Vader Project Engine. **Canonical command tables:** **[`Project-Bible.md`](./Project-Bible.md) §7 — Command Lexicon**.

## 1. The Nuke Protocol (environment)

When the Node tree, lockfile, or build output is corrupted, use the **official environment nuke** — do **not** rely on ad-hoc “scorched earth” scripts.

1. **Stop Node (Windows):**  
   `taskkill /F /IM node.exe /T`  
   Clears ghost dev servers and reduces SQLite / file locks before heavy steps. (This is also attempted automatically at the start of **`npm run vpe:nuke-install`**.)

2. **Run the packaged nuke:**  
   **`npm run vpe:nuke-install`**  
   Removes **`node_modules`**, **`.next`**, **`dist`**, **`package-lock.json`**, then **`npm install`**. See **`Project-Bible.md` §7** for the full description.

3. **Relaunch dev:**  
   **`npm run vader:dev`** (Forge dev) or **`npm run dev`** (plain).

**Thumbnails:** Vault thumbnails and **`_vpe_thumb.png`** are **independent** of this protocol. Do **not** wait for HTTP 200 or any health probe to repair or replace card art — use **§3** below.

## 2. Forge & Build Sequences

- **`npm run vader:sync`**: Dev session, then post-dev forge (stall watchdog, snapshot, readiness, **`build:win`**, cleanup).
- **`npm run vader:deploy`**: **`vader:clean-sync`** then **`build:win`** — maximum hygiene before shipping an installer.
- **`npm run vader:force-forge`**: Same post-dev forge pipeline **without** starting dev first — use when the tree is already clean and you only need the Windows build.
- **`npm run vader:clean-sync`**: Force-kills the packaged EXE if running, wipes dist/AppData/cache per `package.json`, then **`build:win`**.

## 3. Vault Maintenance

The **`media/vault`** tree is write-protected by **`vpe-vault-rm-guard.js`**. Only sanctioned flows mutate it.

- **`npm run vpe:delete-project`:** Sets **`global.__vpeVaultHardDeleteActive = true`** for the duration of a controlled vault purge.
- **Forge bypass:** Files prefixed with **`_FORGE_TEMP_`** bypass the guard for diagnostics.

### Thumbnail not appearing on card after project creation

If a newly registered project shows a broken placeholder instead of the custom thumbnail:

1. **Check if the source path was a raw file path** — `vpe:add-project` and `vpe:save-settings` both stage `file://` URLs and raw Windows/POSIX paths to the vault automatically (Branch B). If the thumbnail was a `data:image/` base64 blob from the UI picker, Branch A handles it.
2. **Verify the `thumbAlreadyVaulted` sentinel is working** — if you see `CRITICAL FAIL: copyfile '...vault/...' → '...vault/...'` (source equals destination), this is the Branch A → Branch B self-copy ENOENT bug. It means `thumbAlreadyVaulted` was not set. This was permanently fixed in the 2026-05-18 patch; if it reappears, check `project-handlers.js` for the sentinel flag.
3. **Re-save via Project Settings** as an immediate workaround: open Settings for the project → UPLOAD CUSTOM (picks a new image through the native dialog) → SAVE CHANGES. The vault staging path from `vpe:save-settings` will write `_vpe_thumb.png` correctly.
4. **Deep vault reconcile** if multiple cards are affected: `npm run vault:reconcile-msc -- --deep`.

### Missing thumbnails / stale vault (primary recovery)

1. Prefer stopping stray **`node.exe`** (see **§1**) so the catalog and vault are not locked by a ghost process.
2. Run **`npm run vault:reconcile-msc -- --deep`**  
   **`--deep`** is equivalent to **`--debug`** in **`scripts/vault-reconcile-msc-media-pro.cjs`**: verbose logging, full vault scan, marker / path repair emphasis — **primary recovery** when card thumbnails are missing or vault folders drift from SQLite.
3. Standard realign (less verbose): **`npm run vault:reconcile-msc`**.

**Protocol note:** Thumbnails (**including `_vpe_thumb.png`**) may be **reclaimed, copied, or re-materialized** independently of project HTTP health or dev-server readiness. Do not block vault repair on an HTTP 200 check.

## 4. Severe local breakage (“scorched earth” retired)

Legacy docs referred to a **`vpe:scorched-earth`** style flow. The **supported** recovery is:

1. **`taskkill /F /IM node.exe /T`** (and close **Vader Project Engine** if it holds locks).
2. **`npm run vpe:nuke-install`** for the dependency tree.
3. If the installer / dist tree is still bad: **`npm run vader:clean-sync`** or **`npm run vader:deploy`** per **`Project-Bible.md` §7**.

For **vault-only** issues without reinstalling Node modules, use **§3** instead of a full nuke.

## 5. SQLite WAL (`vader.sqlite-wal`)

The catalog uses **WAL journal mode** (`persistent-store.js`). On a **normal quit**, the main process runs **`PRAGMA wal_checkpoint(FULL)`** so recent writes merge into `vader.sqlite` when SQLite is active.

**Operator rule:** Before **copying** `vader.sqlite` / `vader.sqlite-wal` / `vader.sqlite-shm` by hand (backup, sync, cloud upload), **quit Vader Project Engine** so files are not mid-write and the WAL is checkpointed. Copying a live DB can strand WAL pages or produce inconsistent snapshots.

**Signature:** Powered by the MSC Media Engine · v2.2.6-SOVEREIGN
