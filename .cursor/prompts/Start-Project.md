# Start Project — VPE session ritual

When the operator says **Start Project**, **start project**, **cold session**, or opens a **new chat** expecting full bootstrap — run this ritual. Prefer **concise** context: authority + checklist + execution, **not** a full pass of PRD/UI spec unless the task needs it.

## Default protocol — **Agent runs API** *(canonical)*

**Change (2026-05-13):** The operator prefers the agent to **automatically start the API** (LiteLLM + ngrok) when they say "Start Project", rather than having to manually run it. 

**VPE engine / Electron / dashboard only** (no `google-api` bridge): follow **[`Start-Master.md`](./Start-Master.md)** — phased read order, **`npm run vader:dev`** when you actually need the UI, Bible §7, vault/nuke runbooks.

---

## The Bridge (LiteLLM + ngrok)

Use when you need **Vertex via LiteLLM** + a **public tunnel**.

1. **Background shell (cwd = repo root):** **`pwsh -NoProfile -ExecutionPolicy Bypass -File ".\google-api\vpe-start-api.ps1" -StartNgrok`** (LiteLLM **:4000** + ngrok sidecar).
2. Wait for **`[VPE STANDBY]`** and **Uvicorn** on **:4000**.
3. Confirm **API is Live**.
4. **Green `200` access log:** in **another** background shell (cwd = repo root): **`pwsh -NoProfile -ExecutionPolicy Bypass -File ".\google-api\vpe-ping-api.ps1"`**.

---

## Operator paste blocks (human)

### Default — Agent starts the bridge

Paste into a new Agent chat (`@`-attach optional):

> **Start Project (default).** Follow **`.cursor/prompts/Start-Project.md`**. Read **`.cursorrules`**, **`.cursor/docs/TRUTH.md`** (§7), **`.cursor/docs/Project-Bible.md`** §7. Verify **`google-api/`** assets. **Start the API bridge** by running **`.\google-api\vpe-start-api.ps1 -StartNgrok`** in the background; confirm **`[VPE STANDBY]`** and **API is Live**. Run **`vpe-ping-api.ps1`** for the green 200. Summarize **`VADER_STATION_LOG.md`**. Hand off: *Ready for VPE-Dev — standing by.*

### Optional — verify-only (if bridge is already up)

> **Start Project (verify-only).** Follow **`.cursor/prompts/Start-Project.md`**, but **do not** start `npm run dev` or `vpe-start-api.ps1`. Just verify paths and probe **:4000**.

---

## Agent procedure (canonical order)

1. **Load context:** **`.cursorrules`** → skim **[`.cursor/docs/TRUTH.md`](../docs/TRUTH.md)** (include **§7** when **`google-api`** / Vertex / ngrok is in scope) → read **[`.cursor/docs/Project-Bible.md`](../docs/Project-Bible.md)** (§7 when commands matter).

2. **Verify & Execute:** Confirm **`google-api/gcp_key.json`**, **`litellm_config.yaml`**, **`vpe-start-api.ps1`** exist. If the prompt does **not** say **verify-only**: if **`http://127.0.0.1:4000/v1/models`** already returns **200** with the LiteLLM key, **skip** starting a duplicate bridge; otherwise start **`pwsh -NoProfile -ExecutionPolicy Bypass -File ".\google-api\vpe-start-api.ps1" -StartNgrok`** in a background shell (**workspace cwd must be repo root**).

3. **Confirm bridge:** If you started the bridge, wait for **`[VPE STANDBY]`** and **Uvicorn** on **4000**; then run **`pwsh -NoProfile -ExecutionPolicy Bypass -File ".\google-api\vpe-ping-api.ps1"`** (repo root). Report **API is Live**. If **verify-only**, only probe **`http://127.0.0.1:4000/health`** or **`/v1/models`** and report up/down.

4. **Project state:** Read repo-root **[`VADER_STATION_LOG.md`](../../VADER_STATION_LOG.md)** and brief summary. If absent, skim **Project-Bible.md**.

5. **Handoff:** *I am ready for the VPE-Dev mission. Standing by.*

---

## Session hook note

If **Cursor Hooks** **`sessionStart`** is enabled ([`.cursor/hooks.json`](../hooks.json)), **`start-api.ps1`** prints a **banner only** (the hook does **not** spawn LiteLLM). **Start Project** in chat is what instructs the agent to start the bridge per this file. If **:4000** is already serving **/v1/models**, **skip** starting a duplicate listener.

---

## Update docs (operators — after bridge / Start Project fixes)

When **Start API**, **Vertex**, or **ngrok** behavior changes, update **all** of these so paste-blocks and agents stay aligned:

- **`.cursor/prompts/Start-Project.md`** (operator paste blocks + agent steps)
- **`.cursorrules`** (§2 Start Project + §2.5 Terminal Discipline)
- **`.cursor/docs/TRUTH.md`** §7 (constitution for the bridge)
- **`.cursor/docs/Project-Bible.md`** §8 (solved problems / operator commands)
- **`VADER_STATION_LOG.md`** (dated narrative + **Start Project / full context** line if it drifts)
- **`google-api/README.md`**, **`.cursor/hooks/start-api.ps1`**, **`Goalz.md`**, **`Start-Master.md`**, **`google-api/vpe-ping-api.ps1`**

Secrets: **`.\google-api\gcp_key.json`** holds the GCP keys required for LiteLLM.
