\# 🛠️ PHASE 3: TACTICAL REPAIR \& TERMINAL REFINEMENT



\*\*Objective:\*\* Implement the AST-based Suspense patcher and finalize the xterm.js Log Drawer for real-time process monitoring.



\---



\## 🏗️ 1. THE AST SURGEON (Vader Repair)

\- \*\*File\*\*: `scripts/repair/vader-fix-suspense.mjs`

\- \*\*Task\*\*: Implement the core transformation logic using `recast` or `babel/parser`.

\- \*\*Logic\*\*: 

&#x20; - \*\*Identify\*\*: Find components utilizing `useSearchParams` or `useParams`.

&#x20; - \*\*Transform\*\*: Wrap these components (or their parent exports) in `<Suspense fallback={<p>Loading...</p>}>`.

&#x20; - \*\*Validation\*\*: Ensure the `.vader-backup` is created successfully \*before\* the write operation.

&#x20; - \*\*Diff Generation\*\*: Prepare a JSON object representing the `before` and `after` code for the UI Diff Viewer.



\---



\## 🖥️ 2. HIGH-CONTRAST LOG DRAWER

\- \*\*File\*\*: `src/renderer/components/LogDrawer.tsx`

\- \*\*Task\*\*: Finalize the xterm.js integration.

\- \*\*Visuals\*\*: 

&#x20; - Apply the \*\*JetBrains Mono\*\* font and \*\*#0a0a0a\*\* background.

&#x20; - Implement the 1px horizontal scanline overlay at 2% opacity for the CRT aesthetic.

&#x20; - \*\*Features\*\*: Add "Clear Logs" and "Copy to Clipboard" pill buttons in the drawer header.



\---



\## 🧪 3. THE "NUKE" WORKFLOW

\- \*\*File\*\*: `src/main/pm2-manager.js`

\- \*\*Task\*\*: Flesh out the catastrophic reset sequence.

\- \*\*Sequence\*\*:

&#x20; 1. `pm2.stop()` and `tree-kill` current PID.

&#x20; 2. Recursive deletion of `node\_modules` and `.next`.

&#x20; 3. Spawn a child process to run `pnpm install` (or detected manager).

&#x20; 4. Auto-restart the project once install completes.



\---



\## 📸 4. AUTO-THUMBNAIL PROTOCOL

\- \*\*File\*\*: `src/main/thumbnailer.js`

\- \*\*Task\*\*: Use `puppeteer-core` to capture a screenshot of the project once the dev server returns HTTP 200.

\- \*\*Storage\*\*: Save to `cache/thumbnails/` as 4:3 WebP.



\---



> \*\*Status Check\*\*: Ensure the "9700x Tuned" badge remains high-contrast white against the surface area.

