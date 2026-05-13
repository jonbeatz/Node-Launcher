# Start Project — VPE session ritual

When the operator says **Start Project**, **start project**, **cold session**, or opens a **new chat** expecting full bootstrap — run this ritual. Prefer **concise** context: authority + checklist + execution, **not** a full pass of PRD/UI spec unless the task needs it.

**VPE engine / Electron / dashboard work only** (no LiteLLM bridge): follow **[`Start-Master.md`](./Start-Master.md)** — phased read order, **`npm run vader:dev`**, Bible §7 commands, vault/nuke runbooks.

---

## Operator paste block (human)

Paste into a new Agent chat (`@`-attach optional):

> **Start Project.** Initialize per **TRUTH.md** and **Project-Bible.md**. §4 **First actions:** in **Cursor integrated terminal split panes**, run **`.\google-api\vpe-start-api.ps1`** from repo root (*Golden Ticket*) and global **`ngrok http 4000`** in another pane (**v1.7.7** = *API-setup* milestone: integrated terminals only, no external windows — **not** the Electron **`package.json`** semver). Confirm **`[VPE STANDBY]`** and **Uvicorn** on **`http://0.0.0.0:4000`** (Vertex bridge **port 4000**); report **API is Live** when true. Summarize **`VADER_STATION_LOG.md`**. Ready for **VPE-Dev** mission — standing by.

---

## Agent procedure (canonical order)

**Full stack context (LiteLLM + ngrok + Cursor):** Re-read in this order so nothing is skipped — **`.cursorrules`** (terminal panes + enforcement) → **`Project-Bible.md`** §7 (commands) → **`TRUTH.md`** (architecture) → **steps 2–3 below** → **`VADER_STATION_LOG.md`**. **`package.json`** is authoritative only for **`npm run …`** script names.

1. **Load context:** Skim [.cursor/docs/TRUTH.md](../docs/TRUTH.md); read [.cursor/docs/Project-Bible.md](../docs/Project-Bible.md). Ensure **`.cursorrules`** constraints are respected if in scope.

2. **§4 First actions — API:** From **repo root**, in **split integrated terminals**, run **`.\google-api\vpe-start-api.ps1`** and global **`ngrok http 4000`** unless LiteLLM is **already** listening on **4000** (and ngrok forwarding **4000**) — then report **skipped (already live)**.

3. **Confirm bridge:** After **`[VPE STANDBY]`** script output, verify **LiteLLM** shows **Uvicorn** on **4000**. closing phrase: **API is Live** once confirmed.

4. **Project state:** Read repo-root **[`VADER_STATION_LOG.md`](../../VADER_STATION_LOG.md)** and give a brief summary. If absent, skim **Project-Bible.md**.

5. **Handoff:** *I am ready for the VPE-Dev mission. Standing by.*

---

## Session hook note

If **Cursor Hooks** **`sessionStart`** is enabled ([`.cursor/hooks.json`](../hooks.json)), a **non-blocking** reminder runs **`start-api.ps1`** (prints split-pane instructions only — **v1.7.5**, no new windows). Avoid duplicate binds: if port **4000** is in use, report status instead of stacking failures.

Secrets: **`.\google-api\gcp_key.json`** holds the GCP keys required for LiteLLM.
