# VPE Checkpoint (2026-05-05)

## What Was Set Up
- Initialized git and connected GitHub remote: `https://github.com/jonbeatz/Node-Launcher`.
- Added repo hygiene:
  - `.gitignore`
  - `.github/workflows/ci.yml`
- Created and pushed initial commit to `main`.

## Major Fixes Completed
- Unified PM2/Tray with persistent store (moved away from direct `projects.json` usage).
- Added archive flow for legacy `projects.json` into `media/_vpe_archive/`.
- Wired PM2 logs into `vpe:log-update` stream for renderer log drawer.
- Fixed renderer hydration mismatch path by client-side initialization gating.
- Wired settings/save/add/delete/nuke flows to persistent-store IPC.
- Added folder picker via Electron dialog for project path selection.
- Added thumbnail picker/upload flow:
  - image copy to `media/thumbnails/`
  - saved in project `thumbnail_url`
  - preview now works in project settings/card.
- Rebuilt `better-sqlite3` for Electron runtime and restored SQLite mode in app startup.
- Fixed Electron cache path/permissions by forcing writable paths in LocalAppData.
- Added project URL auto-open after successful run (`openProjectUrl` IPC).
- Added reserved-port guard:
  - Port `3001` is blocked for managed projects (reserved for Node-Launcher renderer).
- Updated runner to honor configured project ports by injecting `PORT`/`NEXT_PORT` env.

## Important Behavior Notes
- `http://localhost:3001` is Node-Launcher UI, not a managed target project.
- Managed projects must run on a non-`3001` port (`3000`, `3010`, etc.).
- Project path must point to folder containing `package.json`.

## Current Known Issues / Risks
- `npm run lint` in this repo can still trigger interactive Next ESLint setup.
- Some legacy design/reference files are tracked and large; likely should be split into future cleanup commit.
- If a managed project appears "running" but URL does not load, verify:
  - port is not `3001`
  - project path has correct root `package.json`
  - no port conflict from external dev server.

## First Things To Fix Tomorrow
1. **Finalize project card launch UX**
   - Make start flow explicit: "Started on `<url>`" + button to open in browser.
2. **Harden managed project diagnostics**
   - Add preflight checks for reserved port, port-in-use detection, and missing `package.json`.
3. **Improve thumbnail pipeline**
   - Optional compression/resizing to avoid large DB payloads.
4. **CI/Lint stabilization**
   - Make lint non-interactive in CI by adding proper ESLint config.
5. **Repository cleanup pass**
   - Decide whether `_design_references/` stays in main repo or moves to archive branch.

## Regain Context (Read This First Next Session)
1. Read this file: `.cursor/docs/Checkpoint.md`.
2. Read architecture + constraints:
   - `.cursorrules`
   - `Node-Launcher-PRD.md`
   - `SKILL.md`
3. Review latest runtime-critical files:
   - `src/main/main.js`
   - `src/main/vpe-ipc.js`
   - `src/main/project-runner.js`
   - `src/main/pm2-manager.js`
   - `src/renderer/app/page.tsx`
   - `src/renderer/components/project-settings-modal.tsx`
4. Run startup sanity checks:
   - `npm run dev`
   - confirm launcher at `http://localhost:3001`
   - confirm managed project uses non-`3001` port and opens correctly.
5. Validate persistence mode in logs:
   - prefer `VPE persistence: SQLite (better-sqlite3)`.

## Quick Command Snippets
- Clean restart:
  - `Get-Process -Name node,electron -ErrorAction SilentlyContinue | Stop-Process -Force`
  - `npm run dev`
- Verify launcher:
  - `Invoke-WebRequest http://localhost:3001 -UseBasicParsing`

