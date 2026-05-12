# 📜 The Project Truth (VPE v2.2.6-SOVEREIGN)

This document is the **Constitution** of the Vader Project Engine. It serves as the absolute technical source of truth. If any document conflicts with this, **this document wins**.

**Filesystem:** This file lives only at **`.cursor/docs/TRUTH.md`**. It consolidates all core technical principles.

**Shipped release vs. Iron Curtain:** Root **`package.json` → `version`** is the **authoritative ship string** (**v2.2.6-SOVEREIGN**). The **Iron Curtain** (**v2.2.6-SOVEREIGN Baseline**) in `main.js` (`msc_ironCurtainVersionAudit`) still enforces a **minimum engine of v2.2.5** (semver core) so older binaries cannot corrupt modern sovereign SQLite / vault layouts. **v2.2.6-SOVEREIGN** is the current product line; **v2.2.5** is the *floor*, not the marketing label. Product deltas: **[`VADER_STATION_LOG.md`](../../VADER_STATION_LOG.md)**. Operator command tables: **[`Project-Bible.md`](./Project-Bible.md) §7 — Command Lexicon**.

## 1. Architectural Integrity
- **The Vader Shield:** The renderer layer must remain "dumb" regarding the OS. It may only communicate through **`src/preload`** (canonical gate: **`preload.js`**) via **`contextBridge`** — **`nodeIntegration`** off.
- **Process Survival:** PM2 is the daemon. Closing the Electron UI does NOT kill dev servers unless a "Stop" command is explicitly issued.

## 2. The IPC Contract (Preload & Main)
The `contextBridge` in `src/preload/preload.js` exposes two distinct APIs:
1. **`vpeAPI`**: The modern boundary wrapping calls in `msc_invoke()` to format serialized string errors.
2. **`mscLegacyAPI`**: A deprecated bridge retained for older telemetry/logging and specific start/stop/nuke paths.

## 3. Mandatory File Hierarchy
- `/src/main`: Electron main process (Hardware & PM2 logic).
- `/src/renderer`: Next.js UI (Vader Protocol styling).
- `/src/preload`: The only allowed IPC gate.
- `/scripts/repair`: AST logic and `vader-fix-suspense.mjs`.

## 4. The "Nuke" Protocol
**Environment recovery (canonical):** Use **`npm run vpe:nuke-install`** — documented in **[`Project-Bible.md`](./Project-Bible.md) §7** (Command Lexicon). It attempts **`taskkill /F /IM node.exe /T`**, removes **`node_modules`**, **`.next`**, **`dist`**, **`package-lock.json`**, and runs a clean **`npm install`**.

**Per-project stop (runtime):** The runner may **`tree-kill`** a child dev process when stopping a project; that is *not* the same as an environment nuke.

**Thumbnails vs. nuke:** Thumbnail files under the **Sovereign Vault** (see §5) are **not** tied to dependency nukes. They can be repaired, re-copied, or re-generated **independently** of HTTP health or `npm install` (see **`REPAIR_PROTOCOLS.md`** vault section).

## 5. Media Vault Protocol (Sovereign Vault)
- **Sovereign Vault root:** Internal card assets and per-project vault folders live under **`media/vault`** (Windows baseline: **`Node-Launcher-v2/media/vault`** via `msc_projectVaultRootDirSovereign()` / `VPE_VAULT_ROOT` override). This tree is **not** the npm repo root; registry **`projects.path`** must point at the **user repo**, never inside **`media/vault`** (enforced in **`path-guard.js`**).
- **Sovereign Trust (registry saves):** Settings persistence uses **`msc_normalizePersistedProjectPath`** for **`vpe:save-settings`** — vault + `vpe-local-data` guards only. The UI **trusts the persisted path string** for saves: **no requirement** that the folder already exists or contains **`package.json`** at save time (reclaimed / half-linked projects). Stricter checks apply only where spawn or tooling needs a real workspace (**`msc_validateProjectPath`**).
- **Mandatory internal thumbnail file:** **`_vpe_thumb.png`** is the standard internal card thumbnail filename inside each project vault folder (see `vpe-vault-paths.js` / vault handlers). Other raster names may exist for user attachments; the engine relies on **`_vpe_thumb.png`** for the canonical card image.
- **Privileged read path:** Thumbnails are surfaced via the **`vpe-vault:`** protocol (and related handlers), not raw **`file://`**, to satisfy Chromium security rules.

## 6. UI Constant Manifest
- **Background:** #121212 (Main Background)
- **Surface:** #1c1c1c (Cards & Modals)
- **Accent:** #e02b20 (Vader Red Actions)
- **Border:** #333333 (Framing & Hairlines)

**Signature:** Powered by the MSC Media Engine · v2.2.6-SOVEREIGN

---
*Authorized by Jon Beatz | My Studio Channel (MSC)*
