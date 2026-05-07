# Agent boot checklist (VPE / Node-Launcher)

**Purpose:** Give *you* (human) and any *new agent* the same **cold-start** path: what to read, what to verify, and where answers live. Keeps context consistent after a Cursor restart.

**How to use**

- **Start of day:** Open this file, tick the **Session verification** section, then skim **Quick mental model**.
- **New agent / fresh chat:** Paste or `@`-reference this file plus `@AGENT-BOOT-CHECKLIST.md` so the model loads the index; then point at a task.
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
| **Launcher port / forge** | Dev UI: **`http://127.0.0.1:3000`** / `localhost:3000` (renderer). **Managed apps must use a higher port**—not the launcher port. **Vader Sync (v1.1.0+):** after dev, **snapshot → syntax guard → `build:win`** (see protocol). Footer **Net** LED + **Purge** + **Prompt Vault** / **Sandbox** are in-app ops—see **VPE-BUILD-PROTOCOL** §4. |
| **Persistence** | Canonical store under **`app.getPath('userData')/vpe-db`** (SQLite/JSON); thumbnails under **`userData` media**. Legacy `projects.json` may be migrated/archived. |
| **E2E / CI** | Playwright, Chromium; **`CI=true`** for deterministic bind—see [../../playwright.config.ts](../../playwright.config.ts) and [.github/workflows/ci.yml](../../.github/workflows/ci.yml). |
| **Electron debug** | **`npm run dev:main`** uses **`--remote-debugging-port=9222`** — for MCP attach workflows. |

---

## 3. Living status & runbooks

Read when you need **“where we are today”** or **exact command sequences**:

| Doc | Use when |
| :--- | :--- |
| [Checkpoint.md](Checkpoint.md) | Branch status, recent milestones, risky areas, files to reopen |
| [Custom-Commands.md](Custom-Commands.md) | **`rebuild exe`**, **`restart app`**, **`start app`**, **`hardened setup`**, Playwright MCP table, MCP sanity checklist |
| [**VPE-BUILD-PROTOCOL.md**](VPE-BUILD-PROTOCOL.md) | **Canonical build & command sequencing** (`vader:dev` + **`VPE_LAUNCHER_FORGE`**, **`vader:post-dev-forge`**, **`vpe:take-state-snapshot`**, **`vpe:check-readiness`**, **`vader:sync` / `vader:clean-sync`**, **`&&` gates**, **`concurrently -k`**, **`asar`** / **`npmRebuild`**, Windows outputs / **`prebuild:main`** single-pass) |
| [API-SetUp-Master.md](API-SetUp-Master.md) | **LiteLLM + ngrok → Vertex AI**; Cursor Base URL + `master_key`; **post–Cursor-restart reconnect** checklist |
| [Stability-Fix-Backlog.md](Stability-Fix-Backlog.md) | Packaging, ASAR, winCodeSign, native rebuild, telemetry—**resolved** symptoms |

---

## 4. Session verification (tick each start)

Copy into chat as “done / skipped / blocked” if useful.

### Environment

- [ ] Repo root: `d:\Cursor_Projectz\Node-Launcher` (or note actual path).
- [ ] Intended branch matches [Checkpoint.md](Checkpoint.md) (or `git status` is intentional).
- [ ] VPE Version: **v1.1.0** (see root `package.json` if disputed)
- [ ] Node matches team expectation (CI uses Node **20**; local may differ—note if so).
- [ ] **`npm install`** already run after last `package.json` change (`legacy-peer-deps` via [../../.npmrc](../../.npmrc)).

### Native / Electron (when touching main process or SQLite)

- [ ] After Electron/Node bump: **`npm run rebuild:natives`** (better-sqlite3 for Electron ABI).

### Quick smoke

- [ ] **`npm run dev`** → shell loads at **3000**; no unexpected red in main/renderer consoles.
- [ ] **"start API"** → LiteLLM is up with `gcp_key.json` and `litellm_config.yaml`. Confirmation: **"API is Live"**.
- [ ] Optional: **`CI=true`** + **`npm run test:e2e`** before a big merge (see Custom-Commands).

### Docs honest?

- [ ] If you changed ports, persistence paths, MCP names, or release steps: update **Checkpoint**, **Custom-Commands**, or **SKILL.md** in the same effort (low drift).

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

- **`rebuild exe`** — icon → export → natives → lint → E2E → package → trim `dist/`
- **`restart app`** / **`start app`** — stop stray node/electron → **`npm run dev`** (prefer **restart app** when you mean kill-then-dev after changes)
- **`hardened setup`** — clean install / rebuild / optional Playwright / **`repair:ast`** + E2E + lint  
- **`Vader Sync`** — **`npm run vader:sync`** (or **`npm run vader:clean-sync`**) — full dev with Electron + Next (**`concurrently -k --success first`** so closing Electron exits Next too), then **pre-forge snapshot**, **`vpe:check-readiness`**, then **`build:win`**. **Rules + table:** [VPE-BUILD-PROTOCOL.md](VPE-BUILD-PROTOCOL.md). **Phrase / examples:** [Custom-Commands.md — Vader Sync](Custom-Commands.md#vader-sync).  
- **`new git branch`** — commit/push/version bump pattern (if still current)

---

## 8. New agent paragraph (paste into first message)

Copy-paste template:

```text
You are working on Vader Project Engine (VPE) at <PATH>. Before coding:
1. Read .cursor/docs/AGENT-BOOT-CHECKLIST.md and follow authority order (TRUTH → .cursorrules → SKILL.md → PRD → package.json).
2. For current branch and recent decisions, read .cursor/docs/Checkpoint.md.
3. For build sequencing (vader:sync / hand-off builds / ASAR + natives), read .cursor/docs/VPE-BUILD-PROTOCOL.md.
4. Obey Vader Shield: no Node APIs in renderer; IPC via preload only.
5. Scripts: only npm scripts defined in package.json.
My task: <DESCRIBE>.
```

---

## 9. Optional: session log

Use [Checkpoint.md](Checkpoint.md) for durable **project** state. For **personal** daily notes, keep a separate journal outside git or in a private doc—avoid secrets and huge logs in committed files.

---

*My Studio Channel (MSC). Footer copy in app: “Powered by the MSC Media Engine.”*
