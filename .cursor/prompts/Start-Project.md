# Start Project — VPE session ritual

When the operator says **Start Project**, **start project**, **cold session**, **full bootstrap**, or opens a **new chat** expecting the **full VPE + Google API** station context — run this ritual **in order**. Prefer concise reporting: what you read, smoke result, API status, log summary, handoff.

## Hard defaults (non-negotiable)

1. **Full context refresh:** Use the **Read** tool on **every** file in [§ Mandatory document reads](#mandatory-document-reads-full-context) below **before** running shells (unless a file is missing — then say so). Do not rely on memory from an earlier turn.
2. **No dev server by default:** **Do not** run **`npm run dev`**, **`npm run vader:dev`**, or any long-running Electron + Next combo unless the operator **explicitly** asks for the **VPE UI**, **dashboard**, **renderer dev**, **Electron dev**, or **Forge dev**.
3. **Smoke instead:** After reads, run **`npm run start-project:smoke`** (renderer **`typecheck`** + **`test:migrations`**) from repo root and report pass/fail.
4. **API bridge:** Unless **verify-only**, start LiteLLM + ngrok and ping per [§ The Bridge](#the-bridge-litellm--ngrok).

**VPE engine / Electron / dashboard work** without the `google-api` bridge: still do **§ Mandatory reads** + **smoke**; for deep engine-only workflow after that, follow **[`Start-Master.md`](./Start-Master.md)**. Only start **`npm run dev`** / **`npm run vader:dev`** when the operator asks for the UI.

---

## Mandatory document reads (full context)

Read these **in order** (repo root = `Node-Launcher-v3`):

| # | Path | Why |
|---|------|-----|
| 1 | **`README.md`** (repo root) | Product, stack, master command pointers |
| 2 | **`.cursorrules`** | Shield, hierarchy, terminal discipline, Start Project law |
| 3 | **`.cursor/docs/TRUTH.md`** | Constitution (read fully; **§7** is the bridge) |
| 4 | **`.cursor/docs/Project-Bible.md`** | Architecture + **§7 Command Lexicon** + **§8** (bridge / solved problems) |
| 5 | **`.cursor/docs/REPAIR_PROTOCOLS.md`** | Nuke / vault — skim unless the session is repair-focused, then read in depth |
| 6 | **`VADER_STATION_LOG.md`** | Station narrative + recent infra decisions |
| 7 | **`google-api/README.md`** | LiteLLM, ngrok, keys, ping behavior |
| 8 | **[`.cursor/docs/Cursor-LiteLLM-Bridge.md`](../docs/Cursor-LiteLLM-Bridge.md)** | Cursor **`…/v1`** override, stale ngrok, port **4000** vs Uvicorn, Agent vs Ask |
| 9 | **`.cursor/prompts/Start-Master.md`** | Engine cold start / phased checklist when UI work follows |

**Optional pulse:** **`.cursor/docs/UPDATE_LOG.md`** and **`.cursor/docs/MCPs.md`** if present — quick scan for recent doc or MCP changes.

---

## Smoke test (default — not the dev server)

From **repo root**:

```bash
npm run start-project:smoke
```

This runs **`npm run typecheck`** then **`npm run test:migrations`** (Electron-as-Node migration verifier). It **does not** start Next or Electron dev. If it fails, report the error output and stop short of claiming “all green” until fixed or the operator overrides.

---

## The Bridge (LiteLLM + ngrok)

Use when you need **Vertex via LiteLLM** + a **public tunnel** (default on **Start Project** unless **verify-only**). Canonical Cursor + port behavior: **[`Cursor-LiteLLM-Bridge.md`](../docs/Cursor-LiteLLM-Bridge.md)**.

1. Confirm **`google-api/gcp_key.json`**, **`litellm_config.yaml`**, **`vpe-start-api.ps1`** exist.
2. If **`vpe-start-api.ps1`** errors with **port 4000 already in use**, run **`pwsh -NoProfile -ExecutionPolicy Bypass -File ".\google-api\vpe-end-api-bridge.ps1"`** (same as **End Project** step 1), then retry the start below.
3. If **`GET http://127.0.0.1:4000/v1/models`** with the LiteLLM **`Authorization: Bearer <master_key>`** (from **`litellm_config.yaml`**) already returns **200**, **skip** starting a duplicate listener; still run **`vpe-ping-api.ps1`** if you need fresh access-log lines.
4. Otherwise **background shell (cwd = repo root):** **`pwsh -NoProfile -ExecutionPolicy Bypass -File ".\google-api\vpe-start-api.ps1" -StartNgrok`**
5. Wait for **`[VPE STANDBY]`** and **`Uvicorn running on http://0.0.0.0:4000`** (must be **4000** — same port ngrok forwards to; if you see another port, run **`vpe-end-api-bridge.ps1`** and start again).
6. Confirm **API is Live** (probe **`/v1/models`** or health as documented in **`google-api/README.md`**).
7. **Green `200` access log:** **second** background shell (cwd = repo root): **`pwsh -NoProfile -ExecutionPolicy Bypass -File ".\google-api\vpe-ping-api.ps1"`**

---

## Operator paste blocks (human)

### Default — full ritual

> **Start Project (default).** Follow **`.cursor/prompts/Start-Project.md`**. **Read** (in order): **`README.md`**, **`.cursorrules`**, **`.cursor/docs/TRUTH.md`**, **`.cursor/docs/Project-Bible.md`**, **`REPAIR_PROTOCOLS.md`** (skim), **`VADER_STATION_LOG.md`**, **`google-api/README.md`**, **`Cursor-LiteLLM-Bridge.md`**, **`Start-Master.md`** (skim). Run **`npm run start-project:smoke`**. **Do not** start **`npm run dev`** unless I ask for the UI. If **`vpe-start-api.ps1`** fails **port 4000 in use**, run **`.\google-api\vpe-end-api-bridge.ps1`** then retry. Start **`.\google-api\vpe-start-api.ps1 -StartNgrok`** in the background, then **`vpe-ping-api.ps1`**; confirm **API is Live**. Summarize **`VADER_STATION_LOG.md`**. Hand off: *Ready for VPE-Dev — standing by.*

### Verify-only (bridge may already run)

> **Start Project (verify-only).** Follow **`.cursor/prompts/Start-Project.md`** — **mandatory reads** + **`npm run start-project:smoke`**. **Do not** run **`vpe-start-api.ps1`**. Probe **`http://127.0.0.1:4000/v1/models`** (and **`/health`** if useful) and report up/down.

---

## Agent procedure (canonical order)

1. **Read everything** in [Mandatory document reads](#mandatory-document-reads-full-context) using the **Read** tool (and optional pulse files if present).

2. **Smoke:** Run **`npm run start-project:smoke`** from repo root; report exit code and any failures.

3. **Verify & Execute (API):** If the prompt is **not** **verify-only**: if **:4000** already serves **`/v1/models`** with **200**, skip spawning a second LiteLLM; otherwise start **`pwsh -NoProfile -ExecutionPolicy Bypass -File ".\google-api\vpe-start-api.ps1" -StartNgrok`** in a **background** shell (**workspace cwd = repo root**). If start fails **port 4000 in use**, run **`.\google-api\vpe-end-api-bridge.ps1`** once, then retry the background start.

4. **Confirm bridge:** After a fresh start, wait for **`[VPE STANDBY]`** and **`Uvicorn running on http://0.0.0.0:4000`**; run **`pwsh -NoProfile -ExecutionPolicy Bypass -File ".\google-api\vpe-ping-api.ps1"`** when you need green **`200`** lines. Report **API is Live**. If **verify-only**, probe only and report.

5. **Project state:** Summarize **`VADER_STATION_LOG.md`** (top sections + anything mission-relevant).

6. **Handoff:** *I am ready for the VPE-Dev mission. Standing by.* (Include **smoke:** pass/fail, **API:** live/skipped/down, **Cursor:** paste **`[VPE CRITICAL]` …/v1** if ngrok restarted.)

---

## Session hook note

If **Cursor Hooks** **`sessionStart`** is enabled ([`.cursor/hooks.json`](../hooks.json)), **`start-api.ps1`** prints a **banner only** (the hook does **not** spawn LiteLLM). **Start Project** in chat instructs the agent to run this file’s steps. If **:4000** is already serving **`/v1/models`**, **skip** starting a duplicate listener.

---

## Update docs (operators — after bridge / Start Project fixes)

When **Start API**, **Vertex**, **ngrok**, **smoke**, or **Start Project** behavior changes, update **all** of these so paste-blocks and agents stay aligned:

- **`.cursor/prompts/Start-Project.md`** (this file)
- **`.cursor/rules/start-project-ritual.mdc`**
- **`.cursorrules`** (§2 Start Project + §2.5 Terminal Discipline + smoke / dev defaults)
- **`.cursor/docs/TRUTH.md`** §7 (constitution for the bridge + ritual)
- **`.cursor/docs/Project-Bible.md`** §7–§8 (commands + bridge)
- **`package.json`** script **`start-project:smoke`**
- **`README.md`**, **`VADER_STATION_LOG.md`**
- **`google-api/README.md`**, **`.cursor/hooks/start-api.ps1`**, **`Start-Master.md`**, **`End-Project.md`**, **`.cursor/docs/Cursor-LiteLLM-Bridge.md`**, **`google-api/vpe-ping-api.ps1`**, **`google-api/vpe-print-cursor-settings.ps1`**, **`google-api/vpe-verify-public-url.ps1`**, **`google-api/vpe-end-api-bridge.ps1`**

Secrets: **`.\google-api\gcp_key.json`** holds the GCP keys required for LiteLLM.
