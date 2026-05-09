# ⚡ START HERE: VPE Session Entry

**Start Project (new chat / reboot / cold session):** Canonical ritual + operator paste block → **[`Start-Project.md`](../prompts/Start-Project.md)**. Agents: follow that file’s **Agent procedure** after skimming this page.

**Full cold start (read order, MCP, skills, tick list):** [AGENT-BOOT-CHECKLIST.md](AGENT-BOOT-CHECKLIST.md)

**Agents — new session / setting up this project:** After loading the boot checklist, **run start API** from repo root: **`.\vpe-start-api.ps1`** (LiteLLM **4000** + ngrok; **`.\google-api\gcp_key.json`** required). After **`[VPE STANDBY]`**, confirm **Uvicorn** on **4000** and report **“API is Live”**. Full steps: [API-SetUp-Master.md](API-SetUp-Master.md) · checklist block: [AGENT-BOOT-CHECKLIST.md §4 — First actions](AGENT-BOOT-CHECKLIST.md#4-session-verification-tick-each-start) · project log: [VADER_STATION_LOG.md](../../VADER_STATION_LOG.md).

**Cursor ↔ Google (Vertex AI) via LiteLLM + ngrok** (paths, ports, Cursor settings, post-restart checklist): [API-SetUp-Master.md](API-SetUp-Master.md)

**Dev branch naming:** **`VPE-v1.{minor}.x-Dev`** — increment **`{minor}`** by **1** for each new development line (current: **`VPE-v1.6.x-Dev`**; next example: **`VPE-v1.7.x-Dev`**). Bump root **`package.json` `version`** to match that minor when you cut the line (e.g. **`1.6.0`** on **`VPE-v1.6.x-Dev`**). Full rule: [Checkpoint.md — Build v1.6.0](Checkpoint.md).

**Build & terminal command sequencing** (`vader:dev`, **`VPE_LAUNCHER_FORGE`** [reserved flag; no thermal polling in main as of **v1.1.6**], **`vader:dev-to-forge`**, **`vader:post-dev-forge`**, **`vader:force-forge`**, **`vader:sync`**, **`vader:clean-sync`**, `&&` gates, **`vpe-forge-pause`**, snapshot, syntax guard, **`dist/`** artifacts): [VPE-BUILD-PROTOCOL.md](VPE-BUILD-PROTOCOL.md) (includes **v1.2.3** managed-project bootstrap; forge hardening still **v1.1.8**). **Product / UX:** **Build v1.6.0** (current) + **Build v1.5.0** + **Build v1.4.0** + **Build v1.3.7** + **Build v1.3.6** + **Build v1.3.5** + **Build v1.3.4** + **Build v1.3.3** + **Build v1.3.2** + **Build v1.3.1** + **Build v1.3.0** + **Build v1.2.9** + **Build v1.2.6** archive/jump baseline in [Checkpoint.md](Checkpoint.md).

**Shipped app version:** root **`package.json` → `"version"`** (align with preload / footer / **`layout.tsx`**) drives shipped labels — see [Custom-Commands.md — Update Docs](Custom-Commands.md#update-docs) after each release.

**v1.6.0 product notes:** Branch **`VPE-v1.6.x-Dev`** (renamed from **`VPE-v1.5.x-Dev`**), shipped **`1.6.0`**, catalog **vault** under **`media/vault`** ([`vpe-vault-paths.js`](../../src/main/vpe-vault-paths.js)), **journal** in **`notes`**, **`vpe:vault-delete-file`**. **v1.5.0 hygiene (carried):** **`knip.json`**; orphans removed; **`prism-react-renderer`**; **`vpe-ipc`** log prefixes + register note. **v1.3.7:** **`asarUnpack`** for **`better-sqlite3`**, **`node-pty`**, **`pm2`**; **`pm2-client.js`** (**`msc_getPm2`**) so packaged **`require('pm2')`** resolves to **`app.asar.unpacked`** (fixes **Stop All** *Module not found*). **v1.3.6:** **Settings** — main-process persistence for **launch at login**, **minimize to tray**, **auto-start projects**, **default view**; **Settings saved** toast in **App Settings**. **v1.3.5:** **Top bar** — **+ Add New Project**, single catalog badge (no filter-row duplicate). **Sidebar** — flat **Dashboard**; **Engineering** / **Vault** (incl. **VPE Sandbox**) / **Favorites** accordions. **Maintenance** — **Prompt Vault** tab first. **Sandbox** — **Engineer** = **accordion** steps. **v1.3.4:** Strategist accordion; **v1.3.3:** Vault **`type`** + badges. **CI** — **`npm run lint -- --fix || true`**. **[Checkpoint.md](Checkpoint.md)** — **Build v1.6.0** at top.

**Windows app icon:** staged at **`media/icon.ico`** (from **`_design_references/VPE.ico`** via **`msc-copy-release-icon`**); [`package.json`](../../package.json) **`build`** block references that path — see [Checkpoint.md](Checkpoint.md) (v1.2.2 UI / icon bullets) and [Custom-Commands.md — rebuild exe](Custom-Commands.md#rebuild-exe).

**Managed projects (v1.2.3+):** Starting a catalog project with **`package.json`** but **no `node_modules`** runs **`install` then `npm|yarn|pnpm run <start_script>`** from [`project-runner.js`](../../src/main/project-runner.js). v0-style trees (**`components/ui`** present, no **`node_modules`**) get the **`v0-prototype`** log line and **`projectKind`** on **`vpe:toggle-status`**. Details: [Custom-Commands — Managed project dev](Custom-Commands.md#managed-project-dev-v123) · [Checkpoint — v1.2.3](Checkpoint.md).

## 1. Project Mission
Vader Project Engine (VPE) is a high-performance command center for Node.js management, optimized for **Vader** hardware (Ryzen 9700x) and the **Vader Protocol** aesthetic.

## 2. Session Activation
When starting a new session, verify the local environment:

1. **Start API (agents & operators using Vertex/LiteLLM):** From **repo root**, run **`.\vpe-start-api.ps1`** PowerShell (**[API-SetUp-Master.md](API-SetUp-Master.md)**). Do this early when setting up or resuming work so model routing matches the bridged endpoint; skip only if LiteLLM is already confirmed listening on **4000**.
2. **Check Hardware:** Ensure system identifies as Ryzen 9700x / Windows 11 25H2.
3. **Verify Persistence:** Confirm project state in `app.getPath('userData')/vpe-db` (SQLite/JSON fallback); use `.cursorrules` `projects.json` shape as the logical schema contract.
4. **Runtime / packaging:** Prefer launcher owning **3000** during **`npm run dev`** / Vader dev; use **`npm run vader:sync`** when you need **dev → snapshot → syntax guard → Windows pack** (see [VPE-BUILD-PROTOCOL.md](VPE-BUILD-PROTOCOL.md)).

## 3. Communication Protocol
- **Strict Prefixing:** All functions `msc_`, all classes `msc-`.
- **Security First:** No direct Node imports in renderer; use the `vader` IPC bridge.
- **Aesthetic:** Background **#121212**, surface **#1c1c1c**; Vader accent **#e02b20** for brand/CTAs outside nav. **Navigation selection** (sidebar + maintenance tabs, dashboard pills where applicable): **#2a2a2a** — see [VPE-BUILD-PROTOCOL — Standards](VPE-BUILD-PROTOCOL.md) (v1.3.0+).

## 4. Current Objectives
- [ ] Initialize Electron/Next.js foundation.
- [ ] Implement PM2 programmatic API.
- [ ] Build the "Nuke" and "Repair" suites.