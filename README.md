# 🛸 Vader Project Engine (VPE)

[![Build: CI](https://github.com/jonbeatz/Node-Launcher/actions/workflows/ci.yml/badge.svg)](https://github.com/jonbeatz/Node-Launcher/actions/workflows/ci.yml)

> **VPE Jedi-Master — `package.json` `3.0.0`** (Jedi-Master v3.0 baseline; recent narrative in [`VADER_STATION_LOG.md`](VADER_STATION_LOG.md), older entries in [`.cursor/docs/archive/VADER_STATION_LOG_ARCHIVE.md`](.cursor/docs/archive/VADER_STATION_LOG_ARCHIVE.md); operator commands in [`.cursor/docs/Project-Bible.md`](.cursor/docs/Project-Bible.md) **§7**)

The **Vader Project Engine (VPE)** is a tactical desktop command center for the **My Studio Channel (MSC)** workflow—process-aware, PM2-backed, and tuned for the **Vader** workstation (AMD Ryzen 9700x / Gigabyte B650).

---

## 🏛 1. The Constitution (Source of Truth)

**Cold start:** follow **[`.cursor/docs/TRUTH.md`](.cursor/docs/TRUTH.md)** and **[`.cursorrules`](.cursorrules)**.

- **Start Project** (in Agent chat — full station + API context): **[`.cursor/prompts/Start-Project.md`](.cursor/prompts/Start-Project.md)** — agents **re-read** the listed docs (including **`Cursor-LiteLLM-Bridge.md`**), run **`npm run start-project:smoke`** ( **`typecheck`** + **`test:migrations`** ), start **`.\google-api\vpe-start-api.ps1 -StartNgrok`** + **`vpe-ping-api.ps1`** unless **verify-only**. If **port 4000 in use**, run **`.\google-api\vpe-end-api-bridge.ps1`** then retry start. **Default:** no **`npm run dev`** until you ask for the **VPE UI**.
- **End Project** (session close — clean next Start): **[`.cursor/prompts/End-Project.md`](.cursor/prompts/End-Project.md)** — run **`.\google-api\vpe-end-api-bridge.ps1`** first to free **:4000** and matching **ngrok**.
- **Engine / UI dev** (when you want the dashboard): **[`.cursor/prompts/Start-Master.md`](.cursor/prompts/Start-Master.md)** — **`npm run dev`** or **`npm run vader:dev`**.
- **[AGENTS.md](.cursor/docs/AGENTS.md)**: Advanced workflow orchestration and multi-agent patterns.
- **[.cursor/docs/DESIGN.md](.cursor/docs/DESIGN.md)**: Sovereign Design System Specification.
- **[.cursor/docs/DESIGN_STANDARDS.md](.cursor/docs/DESIGN_STANDARDS.md)**: High-end UI/UX and Tailwind v3 standards.
- **[.cursor/docs/MCPs.md](.cursor/docs/MCPs.md)**: Full catalog of active and configured MCP servers.
- **Google API** details: **`google-api/README.md`**. **Cursor + `vader-*` models:** **[`.cursor/docs/Cursor-LiteLLM-Bridge.md`](.cursor/docs/Cursor-LiteLLM-Bridge.md)**.

Hierarchy of authority:

1. **[`.cursor/docs/TRUTH.md`](.cursor/docs/TRUTH.md)** — Constitution (non-negotiable).
2. **[`.cursorrules`](.cursorrules)** — Enforcement and UI/data rules.
3. **[`.cursor/docs/Project-Bible.md`](.cursor/docs/Project-Bible.md)** — Architecture + **§7 Command Lexicon** (npm scripts).
4. **`package.json`** — Executable script names and shipped version.

**Persistence:** SQLite catalog (see `.cursorrules` §11); sovereign `data/` layout per `persistent-store.js` (**LOGIC_MOD_01**).

---

## 🛠 2. Technical Core & Architecture

### Local development URL

**`npm run dev`** or **`npm run vader:dev`** — Electron + Next renderer; default Next dev URL **`http://localhost:3000`**. Managed projects use **other ports** (not `3000`). These are **not** started automatically on **Start Project**; use **`npm run start-project:smoke`** for a quick health check instead.

### Tech stack (summary)

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Shell** | **Electron 28+** | Filesystem, IPC, tray |
| **Processes** | **PM2 Programmatic API** | Dev servers survive UI close until Stop |
| **UI** | **Next.js 15+** | Dashboard |
| **Styling** | **Tailwind CSS** | Vader Protocol (Studio Dark) |

### Vader Shield

**`contextBridge`**, **`nodeIntegration: false`**. Renderer never imports Node core modules; all privilege crosses **`src/preload/preload.js`**.

---

## 🎨 3. The Vader Protocol (Design System)

- **Palette:** Background `#121212`, surface `#1c1c1c`, accent `#e02b20`.
- **Typography:** JetBrains Mono for terminal / monospace.
- **Running cards:** Green / amber / red per state; **Staging / Idle (amber)** = unlinked or non-HTTP-runnable repo while dev session is active (see `Msc_ProjectCard` + `vpe_repo_runnable_for_http`).

---

## ⚡ 4. Master Command Protocols

Canonical tables: **[`.cursor/docs/Project-Bible.md`](.cursor/docs/Project-Bible.md) §7 — Command Lexicon**.

### The “Nuke” suite (environment)

Aligned with **Project Bible §7**:

1. **`taskkill /F /IM node.exe /T`** (Windows) — stop ghost Node / free ports (also attempted at the start of **`npm run vpe:nuke-install`**).
2. **Purge** — **`vpe:nuke-install`** removes **`node_modules`**, **`.next`**, **`dist`**, **`package-lock.json`**.
3. **`npm install`** — clean reinstall.

Then **`npm run vader:dev`** (or **`npm run dev`**) to relaunch.

### Thumbnail / vault snapshot (independent of HTTP)

- **Do not** gate vault or card thumbnail recovery on HTTP 200 or dev-server health.
- **Primary recovery:** **`npm run vault:reconcile-msc -- --deep`** (equivalent to **`--debug`** in `scripts/vault-reconcile-msc-media-pro.cjs`) — full vault scan / repair emphasis.
- **Standard pass:** **`npm run vault:reconcile-msc`**.
- Internal card file in each vault folder: **`_vpe_thumb.png`** (see **`TRUTH.md`** §5).

### Forge & ship (short)

- **`npm run vader:sync`** — dev then post-dev forge pipeline.
- **`npm run vader:deploy`** — **`vader:clean-sync`** + **`build:win`**.
- **`npm run vader:force-forge`** — build pipeline without starting dev first.

### Final build verification (v3.0)

| Step | Command |
|------|---------|
| Smoke | **`npm run start-project:smoke`** |
| Lint | **`npm run lint`** |
| Static export | **`npm run build:renderer`** → **`src/renderer/out/index.html`** |
| Electron e2e | **`npm run test:e2e:electron`** (requires **`npx playwright install chromium`** once) |
| Windows package | **`npm run build:win`** |
| Release ZIP | **`.\scripts\upload_build.ps1`** → **`dist/Node-Launcher-v3.0-JEDI-MASTER.zip`** |

**CDP note:** Playwright Electron tests set **`VPE_REMOTE_DEBUG_PORT`**; that env var takes precedence over **`.vpe-runtime.json`** **`cdpPort`**.

---

## 🚀 5. Hardware & OS (Ryzen 9700x)

Batch I/O where possible; whitelist dev paths in Defender when needed. Prefer **`npm run vpe:nuke-install`** for broken Node trees (see **[`.cursor/rules/vader-hardware-optimization.mdc`](.cursor/rules/vader-hardware-optimization.mdc)**).

---

**Author:** Jon Beatz (MSC)  
**Status:** **v3.0.0 Jedi-Master** — Iron Curtain **v2.2.6-SOVEREIGN Baseline** still enforces minimum engine v2.2.5 (semver floor); see `main.js`.  
**Branch convention:** App version `Powered by the VPE Jedi-Master · vX.Y` → Git branch `VPE-Jedi-Master-vX.Y` → ZIP `Node-Launcher-vX.Y-JEDI-MASTER.zip`.

**Signature:** Powered by the VPE Jedi-Master · v3.0
