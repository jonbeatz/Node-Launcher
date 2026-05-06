\# Vader Protocol — REBUILD EXE Command



Whenever the command "rebuild exe" (or aliases like "production build", 

"full exe rebuild", "run the release pipeline") is triggered in Cursor:



1\. Staging Sync      | Copy '\_design\_references/VPE.ico' ➡️ 'build/icon.ico'

2\. Next.js Export    | Run 'npm run build:renderer' (verify 'src/renderer/out/index.html')

3\. Native Compiling  | Run 'npm run rebuild:natives' (-o better-sqlite3 for Node 24)

4\. Syntax Audit      | Run 'npm run lint'

5\. Dynamic Security  | Run 'npm run test:e2e' (CI=true)

6\. Prep Staging      | Wipe existing 'dist/' directory

7\. Packager Run      | Run 'npm run build:main' (generates 'dist/Vader Project Engine.exe'; `build.afterPack` runs `msc-after-pack-embed-icon.cjs` + `rcedit` so the app `.exe` shows the staged `build/icon.ico` without winCodeSign symlink issues)

8\. Prune Dist        | Delete '.blockmap', 'builder-debug.yml', and 'latest.yml'



Deliverable Output:

&#x20; - 📁 'dist/win-unpacked/' (unpacked portable build)

&#x20; - 🚀 'dist/Vader Project Engine.exe' (standalone setup installer)

Notes (2026-05-06):

- If `electron-builder` fails with `Access is denied` in `dist/win-unpacked/*`, close any running `Vader Project Engine.exe` / Electron / Node processes, remove `dist/win-unpacked`, and rerun `npm run build:main`.
- Current emergency packaging mode sets `build.asar = false` in `package.json` to avoid a production main-process parse crash seen with ASAR on this environment.

