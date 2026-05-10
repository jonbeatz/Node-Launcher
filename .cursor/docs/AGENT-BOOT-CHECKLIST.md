# Agent boot checklist (VPE / Node-Launcher)

**Purpose:** Give *you* (human) and any *new agent* the same **cold-start** path: what to read, what to verify, and where answers live. Keeps context consistent after a Cursor restart.

**How to use**

- **Start of day:** Open this file, tick the **Session verification** section, then skim **Quick mental model**.
- **New agent / fresh chat:** Paste or `@`-reference this file so the model loads the index; then point at a task.
- **New session + project setup (agents):** On **Start Project** (or equivalent), follow **[Start-Project.md](../prompts/Start-Project.md)** for the canonical paste block + numbered steps—or after reading §1 here, **run start API**: from repo root in a **Cursor integrated terminal split pane**, **`.\vpe-start-api.ps1`** ([API-SetUp-Master.md](API-SetUp-Master.md)); in **another** pane run **`ngrok http 4000`** globally (**v1.7.7** *API-setup* ritual: **ngrok** on **User PATH**, split panes only — **not** VPE Electron **`package.json`** semver; **no** `.\ngrok.exe` / repo cwd required). **No** external windows. Do this **early**—before relying on overrides / model routing. Confirm **`[VPE STANDBY]`** then **Uvicorn** on **4000** (**API is Live**). Summarize **[VADER_STATION_LOG.md](../../VADER_STATION_LOG.md)**. If **`.\google-api\gcp_key.json`** is missing, note **blocked**; do not guess credentials.
- **Deep work:** This file is an **index**, not a copy of the Constitution—follow the **read order** below when anything seems ambiguous.

---

## 1. Non-negotiable read order (authority)

If sources disagree, follow this order (**highest wins first**):

| # | Document | Role |
| :---: | :--- | :--- |
| 1 | [TRUTH.md](TRUTH.md) | Constitution (architecture, Nuke, tokens) |
| 2 | [../../.cursorrules](../../.cursorrules) | Enforcement: security, UI specs, `projects.json` schema |
| 3 | [../../SKILL.md](../../SKILL.md) | Agent behavior, quality gate, persistence/MCP notes |
| 4 | [../../Node-Launcher-PRD.md](../../Node-Launcher-PRD.md) | Features and requirements |
| 5 | [../../package.json](../../package.json) | **Only** source of truth for `npm run …` scripts |

**Design-only deep cut (optional):** [../../Vader-Project-Engine.md](../../Vader-Project-Engine.md)

---

## 2. Quick mental model (one screen)

| Topic | Fact |
| :--- | :--- |
| **What VPE is** | Electron shell + Next.js **static-export** UI: register Node/Next projects, PM2 lifecycle, logs, repair/nuke, thumbnails (see [README.md](../../README.md)). |
| **Main vs UI** | **`src/main`** (Node, PM2, FS), **`src/preload`** (IPC only), **`src/renderer`** (React/Next, **no** raw Node). **Vader Shield** always. |
| **Launcher port / forge** | Dev UI: **`http://127.0.0.1:3000`** / `localhost:3000` (renderer). **Managed apps must use a higher port**—not the launcher port. **Vader Sync:** **`npm run vader:dev -- --success last`** then **`vader:post-dev-forge`**. **`vader:clean-sync`** (**v1.9.7+**): **`vpe-clean-sync.cjs`** + **`vader:dev`** (interactive; no auto-forge). **`vader:deploy`**: **`vader:clean-sync`** then **`build:win`** after dev exits. **`vader:dev-to-forge`** = **`vader:dev && post-dev-forge`**. Footer **Net** LED: **green** = **`forgeReady`** (**3000/3001** free); **9222** never blocks green (**v1.1.8**: targeted purge + forced idle). **amber** = dev on **3000** and/or **3001**; **red** = conflict on **3000/3001**. |
| **Diagnostics / logs** | **System Health** panel **closed** by default on load (open from TopBar). **System Log** drawer **collapsed** by default (**Logs** / **Ctrl+`**). |
| **Persistence** | Canonical store under **`app.getPath('userData')/vpe-db`** (SQLite/JSON); thumbnails under **`userData` media**. Legacy `projects.json` may be migrated/archived. |
| **E2E / CI** | Playwright, Chromium; **`CI=true`** for deterministic bind—see [../../playwright.config.ts](../../playwright.config.ts) and [.github/workflows/ci.yml](../../.github/workflows/ci.yml). |
| **Electron debug** | **`npm run dev:main`** uses **`--remote-debugging-port=9222`** — for MCP attach workflows. |
| **Cursor ↔ Vertex (new session)** | **Start Project** ritual: [Start-Project.md](../prompts/Start-Project.md). **`.\vpe-start-api.ps1`** + global **`ngrok http 4000`** in **split integrated terminal panes** (**v1.7.7** = LiteLLM/ngrok runbook — [API-SetUp-Master.md](API-SetUp-Master.md); **shipped VPE** semver = root **`package.json`**). After **`[VPE STANDBY]`**, confirm Uvicorn on **4000** → **API is Live**. Log summary: **[VADER_STATION_LOG.md](../../VADER_STATION_LOG.md)**. |
| **Managed catalog dev (v1.2.3+)** | **`vpe:toggle-status`** → **`project-runner`**: if **`package.json`** exists and **`node_modules`** missing, runs **`install && dev`** in one shell; IPC may return **`installing`**, **`projectKind: 'v0-prototype'`** when **`components/ui`** is present; first HTTP health probe delay **10s** during bootstrap; UI **INSTALLING** / stop kills the compound process. |
| **Prompt Vault / Sandbox (v1.3.x)** | Maintenance **Prompt Vault**: accordion templates; **Edit** → **`vpe:update-vault-item`** (**v1.2.9+**); **v1.3.0** collapses **create** behind **+ Create New Master Directive**. **Sandbox:** **react-live** preview; **v1.3.5+** **Strategist** / **Engineer** instructional **Accordions** + **Tabs**. Sidebar/dashboard selection surfaces **`#2a2a2a`** ([VPE-BUILD-PROTOCOL](VPE-BUILD-PROTOCOL.md) Standards). **E2E:** **`npm run test:e2e:electron`**. |
| **Ghost watcher & dashboard layout (v1.3.2+)** | Main **`msc_startGhostWatcher`** ([`vpe-orchestrator.js`](../../src/main/vpe-orchestrator.js)): ~**60s** tick on **Windows** — **node.exe** **LISTENING** on a catalog port **>** launcher port, **no** row on that port with **`status`** **running** → **`vpe:ghost-detected`** ({ **`ports`**, **`at`** }); clear → **`vpe:ghost-cleared`**. Preload **`subscribeGhostPresence`** → TopBar **Activity** **amber** pulse (open **System Health** / **Scorched Earth**). **Renderer-only prefs:** **`vpe.settings.dashboard.viewMode`** + **`vpe.settings.dashboard.activeFilter`** (**ARCHIVE** included) via **`useDashboardPersistedSettings`**. See [Checkpoint.md](Checkpoint.md) (**Build v1.3.2**). |
| **Sandbox & Vault (v1.3.3+)** | **Shipped:** read **`package.json`** (doc sync **1.9.8**). **v1.6.x baseline:** Dev branch **`VPE-v1.6.x-Dev`** + catalog **vault** on disk + **journal** (**`notes`** JSON) — [Checkpoint — Build v1.6.0](Checkpoint.md). **v1.9.x dashboard:** cards/list indicators, thumbnail **paperclip**, solid **Play/Stop** — [`VADER_STATION_LOG.md`](../../VADER_STATION_LOG.md). **v1.5.0:** hygiene + docs alignment (historical). **v1.3.7:** **`asarUnpack`** + **`src/main/pm2-client.js`** (**`msc_getPm2`**) for packaged PM2 / **Stop All**. **v1.3.6:** App settings IPC + boot defaults (**`vpe-ipc.js`**, **`app-settings-modal.tsx`**, **`main.js`**). **v1.3.5:** **VPE Sandbox** nav lives under **Vault** in [`app-sidebar.tsx`](../../src/renderer/components/app-sidebar.tsx); **Strategist** + **Engineer** in [`Sandbox.tsx`](../../src/renderer/components/Sandbox.tsx) use **Radix Accordion** for steps; **+ Add New Project** in [`top-bar.tsx`](../../src/renderer/components/top-bar.tsx). **Prompt Vault** ([`PromptVault.tsx`](../../src/renderer/components/PromptVault.tsx)): optional **`type`** + **[CMD]**/**[DIR]**/**[SNP]**; **Copy** → **Prime AI Assistant**. **CI:** [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) uses **`npm run lint -- --fix || true`**. See [Checkpoint.md](Checkpoint.md) (**Build v1.5.0**). |
| **CPU temperature** | **Removed (v1.1.6+); UI scrub v1.1.7:** no WMI / PowerShell thermal in main; System Health has **no** temperature field. Do not restore without [VPE-BUILD-PROTOCOL.md](VPE-BUILD-PROTOCOL.md) sign-off. |

---

## 3. Living status & runbooks

Read when you need **“where we are today”** or **exact command sequences**:

| Doc | Use when |
| :--- | :--- |
| [Start-Project.md](../prompts/Start-Project.md) | **Cold session ritual** — Golden Ticket (**`vpe-start-api.ps1`**), **`[VPE STANDBY]`**, **API is Live**, **VADER_STATION_LOG** summary |
| [Checkpoint.md](Checkpoint.md) | Branch status, recent milestones, risky areas, files to reopen |
| [Custom-Commands.md](Custom-Commands.md) | **`rebuild exe`**, **`Update Docs`**, **`restart app`**, **`start app`**, **`Managed project dev` (v1.2.3)**, **`hardened setup`**, Playwright MCP table, MCP sanity checklist |
| [**VPE-BUILD-PROTOCOL.md**](VPE-BUILD-PROTOCOL.md) | **Canonical build sequencing** — **`vader:sync`**, **`vader:clean-sync`**, **`vader:dev-to-forge`**, **`vader:post-dev-forge`**, **`&&`**, **`concurrently`**, **`asar`** / **`npmRebuild`**; catalog **managed dev bootstrap** (**v1.2.3**) |
| [API-SetUp-Master.md](API-SetUp-Master.md) | **LiteLLM + ngrok → Vertex AI**; Cursor Base URL + `master_key`; **post–Cursor-restart reconnect** checklist |
| [Stability-Fix-Backlog.md](Stability-Fix-Backlog.md) | Packaging, ASAR, winCodeSign, native rebuild, telemetry—**resolved** symptoms |
| [**THUMBNAIL-IPC-INVESTIGATION.md**](THUMBNAIL-IPC-INVESTIGATION.md) | **RESOLVED (v1.7.6)** — **`vpe-vault:`** protocol handler; historical attempts (**v1.6.9 → v1.7.3**) retained for context |

---

## 4. Session verification (tick each start)

Copy into chat as “done / skipped / blocked” if useful.

### First actions for a new agent session (setup)

- [ ] **Start Project shortcut:** [Start-Project.md](../prompts/Start-Project.md) — operator paste block + agent steps (recommended).
- [ ] **Read** §1 **Non-negotiable read order** (at least **`.cursorrules`** + this file’s API row in §2).
- [ ] **Start API** — In a **Cursor integrated terminal pane** at repo root: **`.\vpe-start-api.ps1`**; in **another** pane: **`ngrok http 4000`** (global PATH). Unless LiteLLM is already live on **4000**, tick **skipped**. After **`[VPE STANDBY]`**, confirm **Uvicorn** on **4000** → **API is Live**. [API-SetUp-Master.md](API-SetUp-Master.md).
- [ ] **Station log** — skim **[VADER_STATION_LOG.md](../../VADER_STATION_LOG.md)** and state one-line status.
- [ ] Then continue with **Environment** and **Quick smoke** below.

### Environment

- [ ] Repo root: `d:\Cursor_Projectz\Node-Launcher` (or note actual path).
- [ ] Intended branch matches [Checkpoint.md](Checkpoint.md) (or `git status` is intentional).
- [ ] VPE Version: read root **`package.json`** (do not trust this line if it drifts). Thumbnails: **`vpe-vault:`** (**v1.7.6**); handoff doc [THUMBNAIL-IPC-INVESTIGATION.md](THUMBNAIL-IPC-INVESTIGATION.md).
- [ ] Node matches team expectation (CI uses Node **20**; local may differ—note if so).
- [ ] **`npm install`** already run after last `package.json` change (`legacy-peer-deps` via [../../.npmrc](../../.npmrc)).

### Native / Electron (when touching main process or SQLite)

- [ ] After Electron/Node bump: **`npm run rebuild:natives`** (better-sqlite3 for Electron ABI).

### Quick smoke

- [ ] **`npm run dev`** → shell loads at **3000**; no unexpected red in main/renderer consoles.
- [ ] **"start API"** / **Start Project** → **`.\vpe-start-api.ps1`** + global **`ngrok http 4000`** in **split integrated panes** (no external PowerShell windows); **`.\google-api\gcp_key.json`** + **`.\google-api\litellm_config.yaml`** · **port 4000**. **`[VPE STANDBY]`** then **Uvicorn** on **4000** → **"API is Live"**.
- [ ] Optional: **`CI=true`** + **`npm run test:e2e`** before a big merge (see Custom-Commands).

### Docs honest?

- [ ] If you changed ports, persistence paths, MCP names, or release steps: update **Checkpoint**, **Custom-Commands**, or **SKILL.md** in the same effort (low drift). For a full doc/rules sweep after a release, say **[Update Docs](Custom-Commands.md#update-docs)**.

---

## 5. MCP & Cursor tooling (orienting)

- **Global config:** `C:\Users\<you>\.cursor\mcp.json` (not in repo). **Never commit secrets**; prefer env-backed tokens and rotate leaked keys.
- **VPE-oriented browser MCP:**
  - **`playwright`** — Chrome channel, **`127.0.0.1` / `localhost`**, devtools caps; parallels **`npm run test:e2e`** / CI Chromium.
  - **`playwright-electron`** — **`--cdp-endpoint http://127.0.0.1:9222`** when full Electron **`npm run dev`** is running.
- **Smoke steps:** [Custom-Commands.md — mcp sanity check §10](Custom-Commands.md#extended-checks-added-2026-05-06-night).

**Collision note:** Anything else bound to **`127.0.0.1:3000`** (e.g. a Payload MCP URL) conflicts with the **launcher dev server**—disable or remap when working VPE.

---

## 6. Skills (what “SKILL” means here)

- **Project skill:** [../../SKILL.md](../../SKILL.md) — VPE-specific guardrails and quality gate. Agents should follow it when doing VPE work.
- **Cursor user skills:** Optional packs under your Cursor skills path (e.g. `~/.cursor/skills-cursor/…`, plugins). They apply when the **user** has enabled them; the agent does not auto-load every marketplace skill—**ask or check** if a domain needs one (Vercel, Stripe, Notion, etc.).

**Practical rule:** If the task is **only** VPE/Electron/Next/PM2, **SKILL.md + .cursorrules + TRUTH** are enough. If the task touches an external product (Vercel deploy, Notion, Jira), enable or reference the matching **Cursor skill** for that product.

---

## 7. Phrases that expand to full procedures

Defined in [Custom-Commands.md](Custom-Commands.md):

- **`rebuild exe`** — **`media/icon.ico`** staging → export → natives → lint → E2E → package → trim `dist/`
- **`restart app`** / **`start app`** — stop stray node/electron → **`npm run dev`** (prefer **restart app** when you mean kill-then-dev after changes)
- **`Managed project dev`** — catalog **`vpe:toggle-status`**: missing **`node_modules`** + **`package.json`** → **`project-runner`** shell **`install && dev`**; see [Custom-Commands.md — Managed project dev](Custom-Commands.md#managed-project-dev-v123)
- **`hardened setup`** — clean install / rebuild / optional Playwright / **`repair:ast`** + E2E + lint  
- **`Vader Sync`** — **`npm run vader:sync`**: **`vader:dev -- --success last`**, then **`vader:post-dev-forge`** (snapshot → syntax guard → **`build:win`**). **`npm run vader:clean-sync`**: **`vpe-clean-sync.cjs`** then **`vader:dev`** (close app to continue). **`npm run vader:deploy`**: **`vader:clean-sync`** then **`build:win`**. **Rules:** [VPE-BUILD-PROTOCOL.md](VPE-BUILD-PROTOCOL.md). **Examples:** [Custom-Commands.md — Vader Sync](Custom-Commands.md#vader-sync).  
- **`new git branch`** — commit/push/version bump pattern (if still current)

---

## 8. New agent paragraph (paste into first message)

Copy-paste template:

```text
You are working on Vader Project Engine (VPE) at <PATH>. Before coding:
1. Read .cursor/docs/AGENT-BOOT-CHECKLIST.md and follow authority order (TRUTH → .cursorrules → SKILL.md → PRD → package.json).
2. For current branch and recent decisions, read .cursor/docs/Checkpoint.md.
3. For build sequencing (vader:sync, vader:clean-sync, hand-off builds, ASAR + natives), read .cursor/docs/VPE-BUILD-PROTOCOL.md.
4. Obey Vader Shield: no Node APIs in renderer; IPC via preload only.
5. Scripts: only npm scripts defined in package.json.
My task: <DESCRIBE>.
```

---

## 9. Optional: session log

Use [Checkpoint.md](Checkpoint.md) for durable **project** state. For **personal** daily notes, keep a separate journal outside git or in a private doc—avoid secrets and huge logs in committed files.

---

*My Studio Channel (MSC). Footer copy in app: “Powered by the MSC Media Engine.”*
