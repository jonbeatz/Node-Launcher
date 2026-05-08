# 🏛 The Project Truth (VPE v2.0)

This document is the **Constitution** of the Vader Project Engine. It serves as the absolute technical source of truth. If any document conflicts with this, **this document wins**.

## 1. Architectural Integrity
- **The Vader Shield:** The renderer layer must remain "dumb" regarding the OS. It may only communicate through **`src/preload`** (canonical gate: **`preload.js`**) via **`contextBridge`** — **`nodeIntegration`** off.
- **Process Survival:** PM2 is the daemon. Closing the Electron UI does NOT kill dev servers unless a "Stop" command is explicitly issued.

## 2. Mandatory File Hierarchy
- `/src/main`: Electron main process (Hardware & PM2 logic).
- `/src/renderer`: Next.js UI (Vader Protocol styling).
- `/src/preload`: The only allowed IPC gate.
- `/scripts/repair`: AST logic and `vader-fix-suspense.mjs`.

## 3. The "Nuke" Protocol
A "Nuke" action must follow this strict sequence:
1. `tree-kill` the existing process.
2. Delete `node_modules` and `.next`.
3. Execute a clean `<detectedPackageManager> install`.
4. Re-capture thumbnail via Puppeteer only after an HTTP 200 health check is verified.

## 4. UI Constant Manifest
- **Background:** #121212 (Main Background)
- **Surface:** #1c1c1c (Cards & Modals)
- **Accent:** #e02b20 (Vader Red Actions)
- **Border:** #333333 (Framing & Hairlines)

---
*Authorized by Jon Beatz | My Studio Channel (MSC)*