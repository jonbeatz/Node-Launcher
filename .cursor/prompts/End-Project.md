# End Project — VPE session closeout

When the operator says **End Project**, **closeout**, or **end session**, execute this wrap-up ritual so the next **Start Project** is clean (especially **LiteLLM on :4000** and **ngrok**).

## Agent procedure (canonical order)

1. **Stop Google API bridge (LiteLLM + ngrok):** From repo root run **`pwsh -NoProfile -ExecutionPolicy Bypass -File ".\google-api\vpe-end-api-bridge.ps1"`**. This frees **TCP 4000** (stale LiteLLM) and stops **ngrok** processes whose CLI forwards to **4000**, avoiding **“port 4000 already in use”** and **ngrok ↔ Uvicorn port mismatch** on the next session. See **`google-api/README.md`** and **[`.cursor/docs/Cursor-LiteLLM-Bridge.md`](../docs/Cursor-LiteLLM-Bridge.md)**.

2. **Verify state (code):**
   - Run **`npm run typecheck`** and **`npm run lint`** to ensure no lingering TS/lint errors in the tree.
   - Report failures to the operator before proceeding.

3. **Log the work:**
   - Update **`VADER_STATION_LOG.md`** at the repo root.
   - Add a brief bulleted summary under a new **`## [Date] — …`** heading (achievements, decisions, bugs, **next session** pointer).

4. **Status check:** Run **`git status`** and summarize modified files.

5. **Commit and push:** Only if the operator **explicitly** asked to commit this session (per repo rules). Otherwise skip commit/push and say so in the handoff.

6. **Handoff:**
   - Confirm **API bridge stopped** (or note if operator asked to leave LiteLLM running).
   - One-sentence **next session** pointer: follow **`Start-Project.md`** — mandatory reads, **`npm run start-project:smoke`**, then **`vpe-start-api.ps1 -StartNgrok`** + **`vpe-ping-api.ps1`** unless **verify-only**; paste **new** ngrok **`…/v1`** into Cursor if the tunnel was restarted.

---

## Operator paste block (human)

> **End Project.** Follow **`.cursor/prompts/End-Project.md`**. Run **`.\google-api\vpe-end-api-bridge.ps1`** from repo root. Then **`npm run typecheck`** and **`npm run lint`**, log **`VADER_STATION_LOG.md`**, **`git status`**. **Do not** commit unless I explicitly ask. Confirm bridge stopped and hand off.