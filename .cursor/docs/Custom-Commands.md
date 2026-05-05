# Custom Commands

This file tracks shorthand commands you want me to execute in this repo.

## start app

Intent: run a clean app startup.

Steps I will run when you say **"start app"**:

1. `Get-Process -Name node,electron -ErrorAction SilentlyContinue | Stop-Process -Force`
2. `npm run dev`

Notes:
- Run from repo root: `d:\Cursor_Projectz\Node-Launcher`.
- This is a destructive stop for currently running Node/Electron processes on your machine session.
- Launcher UI dev server defaults to `http://localhost:3000`; managed projects should use `3001+`.

## hardened setup (lint, natives, e2e)

Intent: reproduce a clean local pipeline after dependency or Node upgrades (especially **Node 24+**).

Run from repo root, in order:

1. Stop processes (same as **start app**):  
   `Get-Process -Name node,electron -ErrorAction SilentlyContinue | Stop-Process -Force`
2. Optional — clear Next dev output:  
   `Remove-Item -Recurse -Force src/renderer/.next -ErrorAction SilentlyContinue`
3. Install (peer deps are already controlled by **`.npmrc`** `legacy-peer-deps=true`):  
   `npm install`  
   Do **not** append `--legacy-peer-deps` to **`npx @electron/rebuild`** — that flag is for **npm** only; passing it to the rebuild CLI causes **`ERR_PARSE_ARGS_UNKNOWN_OPTION`** on Node 24.
4. Rebuild **better-sqlite3** for the installed Electron:  
   `npm run rebuild:natives`  
   (runs `electron-rebuild -f -o better-sqlite3` — **`--only`** so **node-pty** is not rebuilt; full-tree rebuild can require **Spectre-mitigated** MSVC libs on Windows.)
5. Optional — Playwright browser + OS deps (Windows):  
   `npx playwright install chromium --with-deps`
6. Sanity scripts:  
   `npm run repair:ast` → `npm run test:e2e` → `npm run lint`

## new git branch

Intent: finish current iteration and start a clean next branch.

When you say **"new git branch"**, I will:

1. Check changes and commit with an appropriate message.
2. Push the current branch to remote.
3. Create/switch to the next versioned branch using this pattern:
   - `Node-Launcher-v2`
   - `Node-Launcher-v3`
   - `Node-Launcher-v4`
   - ...and so on (always increment the last number by 1).
4. Confirm branch is clean and ready as a new starting point.
