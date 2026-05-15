# Google API workspace (VPE)

**Start Project default:** Agents follow **`.cursor/prompts/Start-Project.md`** — **re-read** mandatory station docs, run **`npm run start-project:smoke`** from repo root, then launch LiteLLM/ngrok using **`-StartNgrok`** and **`vpe-ping-api.ps1`** for green **200**. **`npm run dev`** is **not** part of the default ritual.

## Cursor IDE + `vader-*` models (read this if you see `ERROR_PROVIDER_ERROR`)

**Canonical setup:** **[`.cursor/docs/Cursor-LiteLLM-Bridge.md`](../.cursor/docs/Cursor-LiteLLM-Bridge.md)** — correct **OpenAI base URL** (**must end with `/v1`**, not `/cursor`, for Gemini 3 on current LiteLLM), **API key**, **ngrok vs localhost**, and **Agent vs Ask** behavior.

**TL;DR:** In Cursor → Models → **Override OpenAI Base URL** use **`http://127.0.0.1:4000/v1`** (local) or **`https://<tunnel>/v1`** (cloud). **OpenAI API Key** = `general_settings.master_key` from **`litellm_config.yaml`**. Custom model IDs **`vader-3-flash`** / **`vader-31-pro`** exactly. Do **not** point Cursor at **`…/cursor`** unless you have verified your LiteLLM version’s Cursor adapter with Vertex Gemini 3 (older adapters can **500**).

## Chain (how it fits together)

1. **LiteLLM** listens on **`http://0.0.0.0:4000`** and routes requests to **Vertex AI** using **`google-api/gcp_key.json`** (ADC) and **`litellm_config.yaml`**.
2. **Proxy aliases:** **`vader-31-pro`** → **`vertex_ai/gemini-3.1-pro-preview`**, **`vader-3-flash`** → **`vertex_ai/gemini-3-flash-preview`** (both **`vertex_location: global`** — required for Gemini 3 preview on Vertex).
3. **`vpe-start-api.ps1`** sets **`GOOGLE_CLOUD_LOCATION`** and **`VERTEXAI_LOCATION`** to **`global`** when unset (matches Google’s global endpoint for these models).
4. **ngrok** publishes **`http://localhost:4000`** so external clients can reach the same OpenAI-compatible API.

## Start LiteLLM (Vertex backend)

- **PowerShell (any cwd):** `pwsh -NoProfile -ExecutionPolicy Bypass -File "<repo>\google-api\vpe-start-api.ps1"`
- **Repo root:** `.\google-api\vpe-start-api.ps1`
- **cmd.exe:** `google-api\vpe-start-api.cmd` (avoids mistyping `cd /d` inside PowerShell)
- **LiteLLM + ngrok in one go (optional):** add **`-StartNgrok`** (starts ngrok as a hidden sidecar, then prints the public URL from `http://127.0.0.1:4040` when ready). Prefer **two integrated terminal panes** if you want full logs for both.

The script sets **`GOOGLE_APPLICATION_CREDENTIALS`** to an **absolute** path, sets **`GOOGLE_CLOUD_PROJECT`** / **`GCLOUD_PROJECT`** from the **`project_id`** field inside **`gcp_key.json`**, and **prepends** this folder to **`PATH`** so **`google-api\ngrok.exe`** wins over another clone on User **`PATH`**.

## Start ngrok (second pane, unless you used `-StartNgrok`)

```text
ngrok http 4000
```

Use **`scripts\vpe-add-node-launcher-user-path.ps1`** once if `ngrok` is not found, then reopen the terminal. Inspect tunnels: **`http://127.0.0.1:4040`**.

## Green `200` in the LiteLLM terminal (access log)

Uvicorn prints a line per request (often with **green** for **2xx** in Cursor / Windows Terminal when ANSI is on). **`vpe-start-api.ps1`** sets **`FORCE_COLOR=1`** and clears **`NO_COLOR`** to help.

1. **Pane A:** run **`.\google-api\vpe-start-api.ps1`** (leave it running).
2. **Pane B:** run **`.\google-api\vpe-ping-api.ps1`** — it calls **`GET /v1/models`** and **`POST /v1/chat/completions`** so **Pane A** shows **`200`** access lines.

## Call the proxy

- **Auth:** `Authorization: Bearer <general_settings.master_key>` from **`litellm_config.yaml`** (default alias **`vader-31-pro`** / **`vader-3-flash`** map to Vertex Gemini models listed in that file).
- **Vertex GCP:** Enable **Vertex AI API** (and billing where required). Service account needs **Vertex AI User** (or equivalent). **`vertex_project`** in **`litellm_config.yaml`** should match the GCP project you use (and typically the **`project_id`** inside **`gcp_key.json`**). **Gemini 3 preview** models use the **global** location — do not switch those entries to **`us-central1`** without changing the model to a regional one.

## Troubleshooting

- **Uvicorn on wrong port (e.g. 16027) but ngrok → 4000:** ngrok still forwards to **4000**; Cursor hits the wrong stack. Only one LiteLLM on **4000**; **`vpe-start-api.ps1`** now errors if **4000** is busy and clears stray **`PORT`** env. Re-run until the log says **`0.0.0.0:4000`**.
- **“It worked yesterday” + ngrok in Cursor:** Your **`https://….ngrok-free.dev/v1`** is almost certainly **offline** (free ngrok URLs die when the tunnel stops). Run **`.\google-api\vpe-verify-public-url.ps1 -BaseUrl "<paste Cursor URL>"`** — if it fails, restart **`.\google-api\vpe-start-api.ps1 -StartNgrok`** and put the **new** HTTPS **`/v1`** URL in Cursor. See **[`Cursor-LiteLLM-Bridge.md`](../.cursor/docs/Cursor-LiteLLM-Bridge.md)** (top section).
- **Cursor `ERROR_PROVIDER_ERROR` / “resource you requested”:** Often **dead ngrok** (above) or wrong base path / key / **Agent** vs **Ask**. Follow **[`Cursor-LiteLLM-Bridge.md`](../.cursor/docs/Cursor-LiteLLM-Bridge.md)**. Prefer base **`…/v1`**, not **`…/cursor`**, for Gemini 3 on LiteLLM **1.83.x** unless you have validated a newer proxy build.
- **`400 INVALID_ARGUMENT` / `Vertex_ai_betaException` from LiteLLM:** Usually the **upstream request shape** — OpenAI-style fields Gemini 3 on Vertex does not accept (for example **`frequency_penalty`** / **`presence_penalty`**, incompatible **`tool_choice`**, or **`parallel_tool_calls=false`** when several tools are attached). This repo sets **`litellm_settings.drop_params: true`** in **`litellm_config.yaml`** and **`LITELLM_DROP_PARAMS=true`** in **`vpe-start-api.ps1`** so LiteLLM strips unsupported params before calling Vertex. **Restart** the LiteLLM process after pulling config changes.
- **Still failing with tools / Agent mode:** Upgrade LiteLLM (`pip install -U litellm`) and retry; tool schemas can still trigger Vertex validation errors until client + library versions align.
- **Ping script errors:** **`vpe-ping-api.ps1`** uses a **non-trivial `max_tokens`** budget so Gemini 3 thinking + output is not clipped to an invalid range.

## Files

- **`gcp_key.json`** — service account (local only; gitignored).
- **`litellm_config.yaml`** — LiteLLM → Vertex routing (tracked).
- **`vpe-start-api.ps1`** / **`vpe-start-api.cmd`** — start LiteLLM (optional **`-StartNgrok`**).
- **`vpe-end-api-bridge.ps1`** — **End Project** / recovery: stop listeners on **4000** + ngrok forwarding **`http … 4000`** so the next **`vpe-start-api.ps1 -StartNgrok`** binds cleanly.
- **`vpe-print-cursor-settings.ps1`** — prints **Override OpenAI Base URL**, **API key** (from tracked **`litellm_config.yaml`**), and model names for **Cursor Settings → Models** (run after **`vpe-start-api.ps1`**).
- **`vpe-verify-public-url.ps1`** — **` -BaseUrl "https://…/v1"`** — confirms ngrok/Cursor URL still returns LiteLLM **`/v1/models`** JSON (not **ERR_NGROK_3200** HTML).
- **`vpe-ping-api.ps1`** — second-pane helper: triggers **200** lines in the LiteLLM access log (`GET /v1/models`, `POST /v1/chat/completions`).
- **`ngrok.exe`** — optional local copy; also exposable via User **`PATH`** (**`scripts\vpe-add-node-launcher-user-path.ps1`**).

Optional third-party env files (**Brevo**, **Spaceship**, etc.): keep as **`.env.production`** or similar **under this folder**; they remain gitignored by **`google-api/*`** unless explicitly allowlisted.
