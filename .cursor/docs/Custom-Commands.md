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
