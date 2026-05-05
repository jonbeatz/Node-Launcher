# Stability + Improvement Backlog

Updated: 2026-05-05

## P0 (Fix Immediately)

1. Project registry contains reserved renderer port (`3001`) for managed app (`MSC_PROJECTZ v1`).
   - Impact: project cannot ever start from VPE.
   - Fix: move project port to a non-reserved value (e.g. `3010`) and save settings.

2. `MSC_REDESIGN` code error blocks runtime (`duplicate default export` in `app/page.tsx`).
   - Impact: process starts but serves 500 error page.
   - Fix: keep only one `export default` and place Suspense wrapper in a valid component structure.

3. Some managed projects hardcode dev port in script (ex: `next dev -p 3000`) while VPE project port differs.
   - Impact: collisions and misleading status/URL in launcher.
   - Fix: align script + VPE configured port OR remove hardcoded `-p` and let VPE env set port.

## P1 (High Value)

4. Add one-click "Auto-fix port" action in Preflight toast/modal.
   - If reserved or in-use, suggest/apply next free port and persist.

5. Add first-run project audit panel.
   - Validate per project: path, `package.json`, script exists, lockfile package manager, explicit script port mismatch.

6. Add active health checks per running project.
   - Probe configured URL and show healthy/degraded badge instead of status only.

## P2 (Quality / UX)

7. Add richer add-project detection details to UI.
   - Show detected package manager, start/build script, reserved port warning before submit.

8. Persist and expose last successful launch URL + timestamp.
   - Helps debugging when process is "running" but URL mismatches.

9. Add optional startup profiles (single project vs multi-project boot sets).
   - Reduces accidental port/script conflicts across many projects.
