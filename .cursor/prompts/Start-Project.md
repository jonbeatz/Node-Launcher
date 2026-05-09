# Start Project — VPE session ritual

When the operator says **Start Project**, **start project**, **cold session**, or opens a **new chat** expecting full bootstrap — run this ritual. Prefer **concise** context: authority + checklist + execution, **not** a full pass of PRD/UI spec unless the task needs it.

---

## Operator paste block (human)

Paste into a new Agent chat (`@`-attach optional):

> **Start Project.** Initialize per **START-HERE.md** and **AGENT-BOOT-CHECKLIST.md**. §4 **First actions:** run **`.\vpe-start-api.ps1`** from repo root (*Golden Ticket*). Confirm **`[VPE STANDBY]`** in that window and **Uvicorn** on **`http://0.0.0.0:4000`** (Vertex bridge **port 4000**); report **API is Live** when true. Summarize **`VADER_STATION_LOG.md`**. Ready for **VPE-Dev** mission — standing by.

---

## Agent procedure (canonical order)

1. **Load context:** Skim [.cursor/docs/START-HERE.md](../docs/START-HERE.md); read [.cursor/docs/AGENT-BOOT-CHECKLIST.md](../docs/AGENT-BOOT-CHECKLIST.md) §1 (read order), §2 (mental model), §4 (**First actions**). Ensure **`.cursorrules`** / **`SKILL.md`** constraints are respected if in scope.

2. **§4 First actions — API:** From **repo root**, run **`.\vpe-start-api.ps1`** in a terminal unless LiteLLM is **already** listening on **4000** (and ngrok on **4000**) — then report **skipped (already live)**.

3. **Confirm bridge:** After **`[VPE STANDBY]`** script output, verify **LiteLLM** shows **Uvicorn** on **4000**. closing phrase: **API is Live** once confirmed.

4. **Project state:** Read repo-root **[`VADER_STATION_LOG.md`](../../VADER_STATION_LOG.md)** and give a brief summary. If absent, skim **[Checkpoint.md](../docs/Checkpoint.md)** (**Build** / branch at top).

5. **Handoff:** *I am ready for the VPE-Dev mission. Standing by.*

---

## Session hook note

If **Cursor Hooks** **`sessionStart`** is enabled ([`.cursor/hooks.json`](../hooks.json)), a **non-blocking** **`Start-Process`** may already open **`vpe-start-api.ps1`** in a new PowerShell window. Avoid duplicate binds: if port **4000** is in use, report status instead of stacking failures.

Secrets: **`.\google-api\gcp_key.json`** — [.cursor/docs/API-SetUp-Master.md](../docs/API-SetUp-Master.md).
