\# 🛡️ PHASE 4: SYSTEM HARDENING \& GLOBAL INTEGRATION



\*\*Objective:\*\* Implement final security guardrails, hardware-level performance tuning, and the "Vader Status" tray integration.



\---



\## 🔒 1. SECURITY AUDIT (Vader Shield v2)

\- \*\*File\*\*: `src/preload/preload.js` / `src/main/main.js`

\- \*\*Task\*\*: Finalize the `contextBridge` white-list.

\- \*\*Protocol\*\*: 

&#x20; - Ensure \*\*zero\*\* raw `child\_process` or `fs` access in the renderer.

&#x20; - Implement a "Path Validator" that restricts the \*\*Nuke\*\* command to only folders containing a `vader.lock` or `package.json` to prevent accidental system deletions.



\---



\## 🏎️ 2. HARDWARE OPTIMIZATION (9700x Tuning)

\- \*\*File\*\*: `src/main/pm2-manager.js`

\- \*\*Task\*\*: Implement batched file I/O for the \*\*Nuke\*\* and \*\*Repair\*\* operations.

\- \*\*Logic\*\*: 

&#x20; - Use `worker\_threads` for Puppeteer thumbnail generation to ensure the UI thread stays at a constant 60fps.

&#x20; - Implement the \*\*Windows 11 25H2\*\* I/O whitelist protocol to reduce Defender scanning impact during `pnpm install`.



\---



\## 🛰️ 3. VADER STATUS TRAY

\- \*\*File\*\*: `src/main/tray-manager.js` (New)

\- \*\*Task\*\*: Create a system tray icon with the \*\*Vader Red\*\* logo.

\- \*\*Features\*\*: 

&#x20; - \*\*Quick-Stop\*\*: "Stop All Processes" (Aqua #3daef2 button logic).

&#x20; - \*\*Status LED\*\*: Icon glows/pulses when a build is failing or a repair is needed.

&#x20; - \*\*Global Nuke\*\*: Catastrophic reset trigger for the currently focused project.



\---



\## 🧪 4. FINAL SMOKE TEST SUITE

\- \*\*File\*\*: `scripts/smoke-test.mjs` (New)

\- \*\*Task\*\*: Automated verification of the core engine.

\- \*\*Tests\*\*:

&#x20; 1. \*\*PM2 Handshake\*\*: Confirm processes survive an Electron UI restart.

&#x20; 2. \*\*AST Accuracy\*\*: Run a dry-patch on a test file and verify the `.vader-backup` integrity.

&#x20; 3. \*\*Thumbnail Persistence\*\*: Verify WebP assets are correctly served from the `cache/`.



\---



> \*\*Status Check\*\*: Confirm the "Powered by the MSC Media Engine" signature is correctly rendered in the Tray Menu as well.

