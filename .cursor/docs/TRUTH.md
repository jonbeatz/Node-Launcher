# 📜 The Project Truth (VPE v2.2.5)

This document is the **Constitution** of the Vader Project Engine. It serves as the absolute technical source of truth. If any document conflicts with this, **this document wins**.

**Filesystem:** This file lives only at **`.cursor/docs/TRUTH.md`**. It consolidates all core technical principles.

**Shipped release vs. this title:** The **v2.2.5** label names the *architecture constitution* and matches the npm/Electron semver. **Authoritative shipped patch** is root **`package.json` → `version`** (currently **2.2.5**). Product/UI deltas: **[`VADER_STATION_LOG.md`](../../VADER_STATION_LOG.md)**.

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
A "Nuke" action must follow this strict sequence:
1. `tree-kill` the existing process.
2. Delete `node_modules` and `.next`.
3. Execute a clean `<detectedPackageManager> install`.
4. Re-capture thumbnail via Puppeteer only after an HTTP 200 health check is verified.

**Environment Nuke (`vpe:nuke-install`):**
The primary recovery tool for the VPE environment itself. Safely kills all Node processes via `taskkill /F /IM node.exe /T`, purges `node_modules`, `.next`, `dist`, and `package-lock.json`, and runs a clean `npm install`.

## 5. Media Vault Protocol
- **Vault Root:** The engine prioritizes `d:/Cursor_Projectz/Node-Launcher/media/vault` on Windows to ensure vault stability and survival across local directory wipes. It falls back to `process.cwd()/media/vault`.
- **Thumbnail Persistence:** Handled exclusively via the `vpe-vault:` privileged protocol to bypass Chromium's `file://` security blocks.

## 5. UI Constant Manifest
- **Background:** #121212 (Main Background)
- **Surface:** #1c1c1c (Cards & Modals)
- **Accent:** #e02b20 (Vader Red Actions)
- **Border:** #333333 (Framing & Hairlines)

---
*Authorized by Jon Beatz | My Studio Channel (MSC)*