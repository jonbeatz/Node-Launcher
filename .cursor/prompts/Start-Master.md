# Start-Master — VPE session & cold-start guide (v2.2.6-SOVEREIGN)

This file is the **single** “start the VPE repo / agent cold start for engine work” checklist (merged from the retired **Start-Master-Build***, **Step2–Step6**, and earlier **Start-Master** split). Deep law: **[`../docs/TRUTH.md`](../docs/TRUTH.md)** · commands: **[`../docs/Project-Bible.md`](../docs/Project-Bible.md) §7** · repairs: **[`../docs/REPAIR_PROTOCOLS.md`](../docs/REPAIR_PROTOCOLS.md)** · rules: **[`../../.cursorrules`](../../.cursorrules)**.

For **`google-api` / LiteLLM / ngrok**, use **[`Start-Project.md`](./Start-Project.md)** — **default = mandatory doc reads + `npm run start-project:smoke` + Agent auto-starts API bridge** (`.\google-api\vpe-start-api.ps1 -StartNgrok`) and **`vpe-ping-api.ps1`** for green **200**. **Start Project** does **not** autostart **`npm run dev`**; use this file when you explicitly need the **VPE UI**.

---

## What this was originally for

The old stack was a **phased boot checklist** for agents and for you:

1. **Ground** the repo (README, PRD, UI spec, rules).
2. **Stand up** Electron main + Next renderer + preload + repair stubs.
3. **Enforce** Vader Protocol tokens and footer signature.
4. **Wire** IPC (`vpeAPI`), PM2, telemetry, repair script, nuke flows.
5. **Harden** Shield, hardware I/O habits, tray, smoke checks.
6. **Run** dev/build and verify UI + console.

Some paths said **`Node-Launcher`** / **`pnpm`** / **`projects.json`** / **`cache/thumbnails`** — this repo is **`Node-Launcher-v3`**, **npm-first** in **`package.json`**, **SQLite** catalog, and **vault + `vpe-vault:`** for thumbs. This file reflects **current** layout.

---

## Phase A — Read before you touch code

| Priority | File / area |
|----------|-------------|
| 1 | **[`../../README.md`](../../README.md)** — product + stack summary |
| 2 | **[`../../.cursorrules`](../../.cursorrules)** — Shield, palette, schema, nuke command |
| 3 | **[`../docs/TRUTH.md`](../docs/TRUTH.md)** — constitution |
| 4 | **[`../docs/Project-Bible.md`](../docs/Project-Bible.md)** — architecture + **§7 Command Lexicon** |
| 5 | **[`../docs/REPAIR_PROTOCOLS.md`](../docs/REPAIR_PROTOCOLS.md)** — nuke / vault reconcile |

Optional: **`Goalz.md`**, **`VADER_STATION_LOG.md`**. Legacy paths like **`.cursor/docs/core/VPE_ENGINE_CAPABILITIES.md`** or **`Vader-Project-Engine.md`** may be absent on this branch—do **not** block on them.

---

## Phase B — Architecture you should assume (already exists)

- **`src/main/`** — Electron, PM2, IPC registration, persistence, tray.
- **`src/renderer/`** — Next.js app (dashboard, cards, log UI).
- **`src/preload/preload.js`** — **`contextBridge`** → **`window.vpeAPI`** (and any legacy surface documented in preload).
- **`src/main/ipc/*.js`** — Domain handlers; boot wiring in **`vpe-ipc.js`**.
- **`scripts/repair/`** — AST / repair utilities (e.g. Suspense-related tooling).

Do not recreate this tree from scratch unless you are explicitly scaffolding a **new** repo.

---

## Phase C — Vader Protocol (quick token set)

- **Background `#121212`** · **Surface `#1c1c1c`** · **Accent `#e02b20`** · **Border `#333333`**
- **HUD framing** — subtle top/bottom accent lines where the live layout uses them.
- **Footer / chrome** — **Powered by the MSC Media Engine** + version from **`package.json`** / **`msc_mscEngineFooterLine()`**.
- **Cards** — **9700x Tuned** (or equivalent) only if the live component still ships it; do not add dead badges.
- **Staging / Idle (amber)** — official relaxed state for unlinked or non-HTTP-runnable projects; not a default error.

---

## Phase D — IPC, PM2, registry (conceptual checklist)

- Preload exposes **`vpeAPI`** (invoke-based); main registers matching **`ipcMain.handle`** channels.
- Catalog is **SQLite**, not a hand-edited **`projects.json`**.
- PM2 connects from main; logs stream to UI via existing log pipeline (**`log-drawer`** / project views)—file names in old prompts (`LogDrawer.tsx`, `ProjectCard.tsx`) were placeholders; follow **`src/renderer`** as-is.

---

## Phase E — Repair, nuke, thumbnails (updated)

- **Repair / AST:** **`scripts/repair/`**; backups **beside source** — **not** in **`media/vault`** (see **`vader-repair-ast.mdc`**).
- **Environment nuke:** **`npm run vpe:nuke-install`** (see **Project-Bible §7** / **REPAIR_PROTOCOLS**). Prefer **`taskkill /F /IM node.exe /T`** before heavy vault work on Windows if processes are stuck.
- **Thumbnails / vault:** **`npm run vault:reconcile-msc`**; deep pass **`npm run vault:reconcile-msc -- --deep`**. Internal card file: **`_vpe_thumb.png`**. Serving: **`vpe-vault:`** — **not** raw `file://`. Thumbnail recovery is **independent** of HTTP 200 (see **TRUTH** / **REPAIR**).

---

## Phase F — Hardening & smoke (still useful)

- **Renderer:** no `fs` / `child_process`; no `nodeIntegration` in renderer windows.
- **Tray:** **`tray-manager.js`** — confirm behavior matches product (quick actions, version branding if any).
- **Smoke:** App launches; **`http://localhost:3000`** for the **Next dev shell** when running **`npm run dev`** / **`npm run vader:dev`**; managed projects use **other** ports. PM2-backed dev survives closing the window until **Stop**.

---

## Phase G — Run commands (this repo)

From repo root (**`D:\Cursor_Projectz\Node-Launcher-v3`** or your clone):

```powershell
cd D:\Cursor_Projectz\Node-Launcher-v3
npm install
npm run vader:dev
```

Other common scripts: **`npm run dev`**, **`npm run build:win`**, **`npm run vader:deploy`** — full table: **Project-Bible §7**.

**Packaged EXE:** after **`build:win`**, run output under **`dist/`** (name per electron-builder config). Confirm tray if applicable.

---

## Phase H — UI prop / DOM hygiene (from Build-Fix1)

When extending **`Msc_ProjectCard`** (or any component that spreads props onto a DOM node):

- **Destructure** domain-specific props (`projectId`, `port`, custom flags) so they are **not** forwarded in **`...rest`** to **`<div>`** / **`<motion.div>`** (avoids React “unknown prop” warnings and DOM pollution).
- Prefer the **existing** component API in the repo over pasting old interface snippets from archived prompts.

---

## Final status checks

- [ ] Footer signature + version visible on main dashboard (and settings if applicable).
- [ ] No unhandled IPC errors in the terminal on first **`vader:dev`** load.
- [ ] Start/Stop on a sample project behaves; log drawer or logs view usable.
- [ ] After UI edits: **`npm run typecheck`** when touching **`src/renderer`**.

---

**Signature:** Powered by the MSC Media Engine · v2.2.6-SOVEREIGN
