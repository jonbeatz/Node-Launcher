\# Vader Protocol — REBUILD EXE Command

**Canonical build sequencing + `vader:*` commands:** [VPE-BUILD-PROTOCOL.md](VPE-BUILD-PROTOCOL.md) · **Maintained steps:** [Custom-Commands.md — rebuild exe](Custom-Commands.md#rebuild-exe)


Whenever the command "rebuild exe" (or aliases like "production build", 

"full exe rebuild", "run the release pipeline") is triggered in Cursor:



1\. Staging Sync      | Copy '\_design\_references/VPE.ico' ➡️ 'media/icon.ico'

2\. Next.js Export    | Run 'npm run build:renderer' (verify 'src/renderer/out/index.html')

3\. Native Compiling  | Run 'npm run rebuild:natives' (-o better-sqlite3 for Node 24)

4\. Syntax Audit      | Run 'npm run lint'

5\. Dynamic Security  | Run 'npm run test:e2e' (CI=true)

6\. Prep Staging      | Wipe existing 'dist/' directory

7\. Packager Run      | Run 'npm run build:main' (generates 'dist/Vader Project Engine.exe'; `build.afterPack` runs `msc-after-pack-embed-icon.cjs` + `rcedit` so the app `.exe` shows the staged `media/icon.ico` without winCodeSign symlink issues)

8\. Prune Dist        | Run **`npm run vpe:cleanup-dist`** (same as **`vader:post-dev-forge`** tail): removes **top-level** **`dist/`** **`*.blockmap`**, **`*.yml`**, **`builder-effective-config.yaml`** only — never **`win-unpacked/`** or **`*.exe`**. Logs **`[Vader Protocol] All Thermal UI artifacts and Ghost PIDs purged.`**



Deliverable Output:

&#x20; - 📁 'dist/win-unpacked/' (unpacked portable build)

&#x20; - 🚀 'dist/Vader Project Engine.exe' (standalone setup installer)

Notes (2026-05-07, **v1.1.8**):

- If `electron-builder` fails with `Access is denied` in `dist/win-unpacked/*`, close any running `Vader Project Engine.exe` / Electron / Node processes, remove `dist/win-unpacked`, and rerun `npm run build:main`.
- **Packaging:** `build.asar` is **`true`** in root **`package.json`** for normal releases. If you ever need a one-off unpacked payload for diagnosis, change **`asar`** only with team sign-off and revert after debugging (see [Stability-Fix-Backlog](Stability-Fix-Backlog.md)).
- **Gated forge:** full dev → pack flow and script truth live in [VPE-BUILD-PROTOCOL.md](VPE-BUILD-PROTOCOL.md) (**`vader:sync`**, **`vader:dev-to-forge`**, **`vpe:cleanup-dist`**).

