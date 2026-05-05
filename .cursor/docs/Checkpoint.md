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
- Added reserved-port guard: managed projects cannot use the launcher renderer port (`3000` by default via `VPE_RENDERER_PORT` / `PORT`).
- Updated runner to honor configured project ports by injecting `PORT`/`NEXT_PORT`/`DEV_PORT` env.
- After dev start, main process probes `GET http://127.0.0.1:{projectPort}/` and stores HTTP status on the project row; grid card and list view show the result.
- One-time DB migration bumps any SQLite project rows still using the launcher port to the next free port; JSON store runs the same rule on load.

## Important Behavior Notes
- **`http://localhost:3000`** is the Node-Launcher UI (shell), not a managed app URL.
- Managed projects must bind to **`3001+`** (anything strictly above the launcher port).
- Project path must point to folder containing `package.json`.

## Current Known Issues / Risks
- `npm run lint` is wired for non-interactive use when `CI=true` (see GitHub Actions). Local runs use existing [`src/renderer/.eslintrc.json`](../../src/renderer/.eslintrc.json).
- Some legacy design/reference files are tracked and large; likely should be split into future cleanup commit.
- If a managed project appears "running" but URL does not load, verify:
  - port is not reserved for the launcher (`3000` by default)
  - project path has correct root `package.json`
  - no port conflict from external dev server.

## First Things To Fix Tomorrow
1. ~~**Finalize project card launch UX**~~ — Done: [`Msc_ProjectCard.tsx`](../../src/renderer/components/Msc_ProjectCard.tsx) shows "Started on" + Open; [`page.tsx`](../../src/renderer/app/page.tsx) toast on start/stop.
2. ~~**Harden managed project diagnostics**~~ — Done: [`project-runner.js`](../../src/main/project-runner.js) `_runDevPreflight` (reserved port, port-in-use, script port mismatch); [`path-guard.js`](../../src/main/path-guard.js) validates `package.json`.
3. **Improve thumbnail pipeline** — Optional follow-up beyond current IPC thumbnail optimization.
4. ~~**CI/Lint stabilization**~~ — Done: ESLint present; CI runs `npm run lint` with `CI=true`.
5. **Repository cleanup pass** — Decide whether `_design_references/` stays in main repo or moves to archive branch.

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
   - confirm launcher UI at `http://localhost:3000` (see `dev:renderer` port; overridable via launcher port env).
   - confirm each managed project uses a port **above** the launcher port and opens correctly.
5. Validate persistence mode in logs:
   - prefer `VPE persistence: SQLite (better-sqlite3)`.

## Milestone — Boot reconcile, system stats, native CPU (completed)

- **Boot reconcile** ([`boot-running-reconcile.js`](../../src/main/boot-running-reconcile.js) + [`main.js`](../../src/main/main.js)): On engine start, rows with `status === 'running'` get a one-shot HTTP health probe ([`health-probe.js`](../../src/main/health-probe.js)); unreachable within probe timeout → stopped + health cleared; `_emitProjectsRefresh` updates UI.
- **System Health IPC** ([`vpe-ipc.js`](../../src/main/vpe-ipc.js), [`preload.js`](../../src/preload/preload.js), [`vpe-bridge.ts`](../../src/renderer/lib/vpe-bridge.ts), [`system-health-panel.tsx`](../../src/renderer/components/system-health-panel.tsx), [`use-vpe-system-stats.ts`](../../src/renderer/hooks/use-vpe-system-stats.ts)): `vpe:get-system-stats` exposes uptime, memory, PM2 reachability, project counts; panel polls ~3s while open.
- **Task D — Native CPU**: [`host-cpu-ticks.js`](../../src/main/host-cpu-ticks.js) replaces Windows PowerShell WMI polling; tick-delta `%` with first-call baseline (`—` until second sample). Handler wrapped in **try/catch** with `VpeSystemStats`-shaped fallback on failure.
- **CI**: [`ci.yml`](../../.github/workflows/ci.yml) runs **`npm run lint`** (with `CI=true`) before **`npm run build:renderer`**.

See also: [`health-scheduler.js`](../../src/main/health-scheduler.js), [`launcher-port.js`](../../src/main/launcher-port.js), [`package-json-script-patch.js`](../../src/main/package-json-script-patch.js) for related runner/IPC behavior.

## Quick Command Snippets
- Clean restart:
  - `Get-Process -Name node,electron -ErrorAction SilentlyContinue | Stop-Process -Force`
  - `npm run dev`
- Verify launcher:
  - `Invoke-WebRequest http://localhost:3000 -UseBasicParsing`

