# 📜 The Project Truth (VPE Jedi-Master v3.0)

This document is the **Constitution** of the Vader Project Engine. It serves as the absolute technical source of truth. If any document conflicts with this, **this document wins**.

**Filesystem:** This file lives only at **`.cursor/docs/TRUTH.md`**. It consolidates all core technical principles.

**Agent Tooling & Context:** The project relies heavily on the **Model Context Protocol (MCP)** for advanced agent workflows (database access, filesystem, terminal control, and external APIs). Documentation for available tools is stored at **`.cursor/docs/MCPs.md`**. Custom project-level MCP overrides live in **`.cursor/mcp.json`**.

**Shipped release vs. Iron Curtain:** Root **`package.json` → `version`** is the **authoritative ship string** (**3.0.0 / VPE Jedi-Master v3.0**). The **Iron Curtain** (**v2.2.6-SOVEREIGN Baseline**) in `main.js` (`msc_ironCurtainVersionAudit`) still enforces a **minimum engine of v2.2.5** (semver core) so older binaries cannot corrupt modern sovereign SQLite / vault layouts. **v3.0.0 (Jedi-Master v3.0)** is the current product line; **v2.2.5** is the *floor*, not the marketing label. **Branch convention:** `VPE-Jedi-Master-vX.Y` mirrors app display `Powered by the VPE Jedi-Master · vX.Y`; ZIP naming `Node-Launcher-vX.Y-JEDI-MASTER.zip`. Product deltas: **[`VADER_STATION_LOG.md`](../../VADER_STATION_LOG.md)**. **npm / operator scripts:** **[`Project-Bible.md`](./Project-Bible.md) §7 — Command Lexicon**. **LiteLLM / Vertex / ngrok:** **this file §7** (Google API bridge).

## 1. Architectural Integrity
- **The Vader Shield:** The renderer layer must remain "dumb" regarding the OS. It may only communicate through **`src/preload`** (canonical gate: **`preload.js`**) via **`contextBridge`** — **`nodeIntegration`** off.
- **Process Survival:** PM2 is the daemon. Closing the Electron UI does NOT kill dev servers unless a "Stop" command is explicitly issued.

## 2. The IPC Contract (Preload & Main)
The `contextBridge` in `src/preload/preload.js` exposes two distinct APIs:
1. **`vpeAPI`**: The modern boundary wrapping calls in `msc_invoke()` to format serialized string errors.
2. **`mscLegacyAPI`**: A deprecated bridge retained for older telemetry/logging and specific start/stop/nuke paths.

## 3. Mandatory File Hierarchy
- `/src/main`: Electron main process (Hardware & PM2 logic).
- `/src/renderer`: Next.js UI (Vader Protocol styling).
- `/src/preload`: The only allowed IPC gate.
- `/scripts/repair`: AST logic and `vader-fix-suspense.mjs`.

## 4. The "Nuke" Protocol
**Environment recovery (canonical):** Use **`npm run vpe:nuke-install`** — documented in **[`Project-Bible.md`](./Project-Bible.md) §7** (Command Lexicon). It attempts **`taskkill /F /IM node.exe /T`**, removes **`node_modules`**, **`.next`**, **`dist`**, **`package-lock.json`**, and runs a clean **`npm install`**.

**Per-project stop (runtime):** The runner may **`tree-kill`** a child dev process when stopping a project; that is *not* the same as an environment nuke.

**Thumbnails vs. nuke:** Thumbnail files under the **Sovereign Vault** (see §5) are **not** tied to dependency nukes. They can be repaired, re-copied, or re-generated **independently** of HTTP health or `npm install` (see **`REPAIR_PROTOCOLS.md`** vault section).

## 5. Media Vault Protocol (Sovereign Vault)
- **Sovereign Vault root:** Internal card assets and per-project vault folders live under **`media/vault`** (Windows baseline: **`Node-Launcher-v3/media/vault`** via `msc_projectVaultRootDirSovereign()` / `VPE_VAULT_ROOT` override). This tree is **not** the npm repo root; registry **`projects.path`** must point at the **user repo**, never inside **`media/vault`** (enforced in **`path-guard.js`**).
- **Sovereign Trust (registry saves):** Settings persistence uses **`msc_normalizePersistedProjectPath`** for **`vpe:save-settings`** — vault + `vpe-local-data` guards only. The UI **trusts the persisted path string** for saves: **no requirement** that the folder already exists or contains **`package.json`** at save time (reclaimed / half-linked projects). Stricter checks apply only where spawn or tooling needs a real workspace (**`msc_validateProjectPath`**).
- **Mandatory internal thumbnail file:** **`_vpe_thumb.png`** is the standard internal card thumbnail filename inside each project vault folder (see `vpe-vault-paths.js` / vault handlers). Other raster names may exist for user attachments; the engine relies on **`_vpe_thumb.png`** for the canonical card image.
- **Privileged read path:** Thumbnails are surfaced via the **`vpe-vault:`** protocol (and related handlers), not raw **`file://`**, to satisfy Chromium security rules.

## 6. UI Constant Manifest
- **Background:** #121212 (Main Background)
- **Surface:** #1c1c1c (Cards & Modals)
- **Accent:** #e02b20 (Vader Red Actions)
- **Border:** #333333 (Framing & Hairlines)

## 7. Google API bridge (`google-api/` — LiteLLM → Vertex, ngrok)

- **Start Project (agents):** per **`Start-Project.md`** and **`.cursor/rules/start-project-ritual.mdc`**, agents **re-read** the mandatory docs listed there (**`README.md`**, **`.cursorrules`**, **`TRUTH.md`**, **`Project-Bible.md`**, **`REPAIR_PROTOCOLS.md`** skim, **`VADER_STATION_LOG.md`**, **`google-api/README.md`**, **`Cursor-LiteLLM-Bridge.md`**, **`Start-Master.md`** skim) using the **Read** tool, then run **`npm run start-project:smoke`** ( **`typecheck`** + **`test:migrations`** ). **Do not** start **`npm run dev`** / **`npm run vader:dev`** by default. Then **auto-start** **`.\google-api\vpe-start-api.ps1 -StartNgrok`** and **`.\google-api\vpe-ping-api.ps1`** from repo root unless the operator says **verify-only** or **:4000** already serves **`/v1/models`** with **200** (then skip duplicate LiteLLM). If start fails **port 4000 in use**, run **`.\google-api\vpe-end-api-bridge.ps1`** once, then retry **`vpe-start-api.ps1 -StartNgrok`**.
- **Canonical start (operator or agent shell, repo root):** **`.\google-api\vpe-start-api.ps1 -StartNgrok`** — LiteLLM on **port 4000** plus **ngrok** sidecar (see **`google-api/README.md`**). **cmd.exe:** **`google-api\vpe-start-api.cmd -StartNgrok`**. **PowerShell any cwd:** **`pwsh -File "<repo>\google-api\vpe-start-api.ps1" -StartNgrok`** (never use **`cd /d`** inside **PowerShell**; that is **cmd** only). **`vpe-start-api.ps1`** refuses a second listener on **4000** and clears stray **`PORT`** so Uvicorn logs **`0.0.0.0:4000`** (same port ngrok forwards to).
- **End Project / clean next session:** **`.\google-api\vpe-end-api-bridge.ps1`** — stops processes listening on **4000** and **ngrok** instances forwarding **`http … 4000`**. First step in **`.cursor/prompts/End-Project.md`** so the next **Start Project** does not hit **“port 4000 already in use”** or a **ngrok ↔ wrong process** mismatch.
- **Two-pane alternative:** **`.\google-api\vpe-start-api.ps1`** then **`ngrok http 4000`** ( **`scripts\vpe-add-node-launcher-user-path.ps1`** once if **`ngrok`** is missing from PATH).
- **Vertex routing:** **`google-api/litellm_config.yaml`** — proxy aliases **`vader-31-pro`** / **`vader-3-flash`** map to **`vertex_ai/gemini-3.1-pro-preview`** and **`vertex_ai/gemini-3-flash-preview`** with **`vertex_location: global`**. Those Gemini **3 preview** IDs require the **global** endpoint; pairing them with **`us-central1`** breaks routing.
- **Environment (launcher):** absolute **`GOOGLE_APPLICATION_CREDENTIALS`** → **`google-api/gcp_key.json`**; **`GOOGLE_CLOUD_PROJECT`** from the JSON **`project_id`**; **`GOOGLE_CLOUD_LOCATION`** and **`VERTEXAI_LOCATION`** default to **`global`** when unset; this repo’s **`google-api\ngrok.exe`** is prepended to **`PATH`** for the session when present.
- **Clients via ngrok free host:** send header **`ngrok-skip-browser-warning: true`** on **`*.ngrok-free.dev`** to avoid the browser interstitial on API calls.
- **Access log (green `200`):** with LiteLLM running in **one** integrated terminal, run **`.\google-api\vpe-ping-api.ps1`** in a **second** pane — it issues **`GET /v1/models`** and **`POST /v1/chat/completions`** so the LiteLLM/Uvicorn pane shows **`200`** access lines (ANSI green in Cursor / Windows Terminal when color is enabled). Details: **`google-api/README.md`**.
- **Cursor IDE + custom `vader-*` models:** Use OpenAI override base **`http://127.0.0.1:4000/v1`** (or **`https://<tunnel>/v1`**), **`master_key`** as the API key, and exact model names **`vader-3-flash`** / **`vader-31-pro`**. Full checklist and failure modes (**`ERROR_PROVIDER_ERROR`**, **`/cursor` vs `/v1`**, Agent vs Ask, ngrok): **[`Cursor-LiteLLM-Bridge.md`](./Cursor-LiteLLM-Bridge.md)**. Run **`.\google-api\vpe-print-cursor-settings.ps1`** for copy-paste values. **`.\google-api\vpe-verify-public-url.ps1 -BaseUrl "<Cursor URL>"`** confirms ngrok is still live (not **ERR_NGROK_3200**).

**Signature:** Powered by the VPE Jedi-Master · v3.0

## 8. Product vision (consolidated)

Personal north-star and legacy architecture notes from **`Goalz.md`** and **`VADER_MASTER_MANIFEST.md`** are folded into this file and **`Project-Bible.md`**. Archived copies: **`.cursor/prompts/_archive/Goalz.md`**, **`.cursor/prompts/_archive/VADER_MASTER_MANIFEST.md`**.

- **Vision:** Desktop command center for local Node/Next work — PM2-backed, MSC-branded, Studio Dark (`#121212` / `#1c1c1c` / `#e02b20`).
- **Layers:** Engine (repo `src/`), brain (`%LocalAppData%\VaderProjectEngine\user-data\`), sovereign vault (`media/vault` / `VPE_VAULT_ROOT`).
- **Non-negotiable:** Vader Shield (preload only), Iron Curtain floor **v2.2.5**, internal thumbs **`_vpe_thumb.png`** via **`vpe-vault:`**.

---
*Authorized by Jon Beatz | My Studio Channel (MSC)*
