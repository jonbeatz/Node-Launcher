# Cursor IDE ↔ VPE LiteLLM (Vertex) — setup & failures

This repo exposes **OpenAI-compatible** routes on LiteLLM (**port 4000**). Model aliases **`vader-3-flash`** and **`vader-31-pro`** map to Vertex **Gemini 3 preview** models with **`vertex_location: global`** — see **`google-api/litellm_config.yaml`**.

---

## Sovereign fix summary (what was wrong & how we fixed it)

| Problem | Cause | Fix |
|--------|--------|-----|
| **Cursor `ERROR_PROVIDER_ERROR` / “resource”** | Often **stale ngrok** (**ERR_NGROK_3200**), **wrong base URL** (missing **`/v1`**, or **`/cursor`** with Gemini 3 on LiteLLM **1.83.x**), or **Cursor Agent** path vs **Ask**. | Use **`https://<live-host>/v1`** from **`[VPE CRITICAL]`**; **`vpe-verify-public-url.ps1`**; test with **Ctrl+L** + **`vader-3-flash`**. See **§ #1 cause** below. |
| **Uvicorn on 16027 but ngrok → 4000** | Second LiteLLM or stray **`PORT`** env so proxy bound off **4000** while ngrok still forwarded to **4000**. | **`vpe-start-api.ps1`** now **refuses** start if **4000** is busy and **clears `PORT`** before launch; **one** bridge only; log must show **`0.0.0.0:4000`**. |
| **“Port 4000 already in use”** next session | Previous **LiteLLM** never stopped. | **End Project:** **`vpe-end-api-bridge.ps1`**. **Start Project:** run same script if start fails, then **`vpe-start-api.ps1 -StartNgrok`**. |

**Scripts:** **`vpe-start-api.ps1 -StartNgrok`** (start) · **`vpe-end-api-bridge.ps1`** (stop) · **`vpe-ping-api.ps1`** / **`vpe-verify-public-url.ps1`** (verify) · **`vpe-print-cursor-settings.ps1`** (Cursor paste block).

---

## Step-by-step — terminal vs Cursor Settings

Repo root example: **`D:\Cursor_Projectz\Node-Launcher-v3`**. **Do not** type only a bare `https://…` URL in PowerShell — it is not a command (use **Part B** for the URL, or **`vpe-verify-public-url.ps1`** in **Part A**).

### Part A — Terminal (keep the API window open)

1. **Open folder in terminal**

```powershell
Set-Location "D:\Cursor_Projectz\Node-Launcher-v3"
```

2. **Start LiteLLM + ngrok** (one line; leave this terminal **running**)

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File ".\google-api\vpe-start-api.ps1" -StartNgrok
```

3. **Wait** for **`[VPE CRITICAL] Cursor 'Override OpenAI Base URL' must be:`** … and **`Uvicorn running on http://0.0.0.0:4000`**.  
   - **Critical:** ngrok forwards to **4000**. If Uvicorn shows **another port** (e.g. **16027**), ngrok still talks to **4000** → wrong process or stale listener → Cursor **provider / resource** errors. **Fix:** stop every **`vpe-start-api.ps1`** / LiteLLM window, free **4000**, remove stray **`PORT`** env if you set it globally, re-run until you see **`0.0.0.0:4000`**. **`vpe-start-api.ps1`** now **exits** if **4000** is already in use before starting ngrok/LiteLLM.

4. **Print API key + reminders** (second terminal is fine)

```powershell
.\google-api\vpe-print-cursor-settings.ps1
```

5. **Test the ngrok URL** (paste your real URL inside the quotes — full command)

```powershell
.\google-api\vpe-verify-public-url.ps1 -BaseUrl "https://YOUR-SUBDOMAIN.ngrok-free.dev/v1"
```

Expect **`[VPE OK]`**.

6. **Optional local smoke**

```powershell
.\google-api\vpe-ping-api.ps1
```

### Part B — Cursor Settings (UI only)

1. **Cursor** → **Settings** → **Cursor Settings** → **Models**.
2. **Override OpenAI Base URL** → **ON** → paste the **`https://…/v1`** line from **`[VPE CRITICAL]`** (or **`http://127.0.0.1:4000/v1`** for local-only).
3. **OpenAI API Key** → **ON** → paste the **`sk-…`** from **`vpe-print-cursor-settings.ps1`**.
4. **Add custom models** (exact names): **`vader-3-flash`**, **`vader-31-pro`** — toggles **ON**.

### Part C — Test

**Ctrl+L** → choose **`vader-3-flash`** → *Say the word pong and nothing else.*

### Common mistake

**Wrong:** typing `https://….ngrok-free.dev` alone in the terminal.  
**Right:** paste that URL into **Cursor Models** (Part B), or run **`.\google-api\vpe-verify-public-url.ps1 -BaseUrl "https://….ngrok-free.dev/v1"`**.

---

## #1 cause when “it worked yesterday” — ngrok URL is **offline**

**Free ngrok hostnames stop working** as soon as the **ngrok process** (or the machine) stops. Cursor keeps the **old** `https://….ngrok-free.dev/v1` in **Models → Override OpenAI Base URL**, so every request hits ngrok’s **HTML error page** (**ERR_NGROK_3200** *endpoint is offline*), not LiteLLM. Cursor surfaces that as **`ERROR_PROVIDER_ERROR`** / “trouble finding the resource”.

**Fix (every time you restart ngrok or reboot):**

1. Start LiteLLM + ngrok: **`.\google-api\vpe-start-api.ps1 -StartNgrok`** (leave running).
2. Copy the **new** `https://…/v1` URL from the terminal (or `http://127.0.0.1:4040` → Tunnels).
3. Paste into **Cursor → Settings → Models → Override OpenAI Base URL** (replace the old ngrok host entirely).
4. Optional check before opening Cursor:  
   **`.\google-api\vpe-verify-public-url.ps1 -BaseUrl "https://YOUR-HOST.ngrok-free.dev/v1"`**  
   → must print **`[VPE OK]`**. If **`[VPE FAIL]`** / HTML, the tunnel is dead or the URL is wrong.

**Stable options:** ngrok **reserved domain** / paid static URL, or **localhost** (`http://127.0.0.1:4000/v1`) when only local Chat/Composer needs the bridge (no cloud Agent).

---

## Does it work now?

| Layer | Status | How to confirm |
|--------|--------|----------------|
| **LiteLLM + Vertex** (this repo) | **Working** when `vpe-start-api.ps1` is running and **`google-api/gcp_key.json`** exists | From repo: **`.\google-api\vpe-ping-api.ps1`** → expect **`GET /v1/models` → 200** and **`POST /v1/chat/completions` → 200**. |
| **Cursor IDE** (your machine) | **Works after one-time UI setup** — the repo **cannot** write Cursor’s global Models settings | Apply **§ Cursor UI (one-time)** below, then open **Chat → Ask (Ctrl+L)** and pick **`vader-3-flash`**. |

If the bridge script passes but Cursor still errors, the problem is **Cursor configuration** (base URL, key, model name, or **Agent** vs **Ask**), not Vertex routing in **`litellm_config.yaml`**.

---

## Full setup (save this flow in your runbook)

### A. Google / Vertex (once per machine)

1. Place the service account JSON at **`google-api/gcp_key.json`** (path enforced by **`vpe-start-api.ps1`** — not repo root).
2. In **Google Cloud Console**: enable **Vertex AI API**; service account needs **Vertex AI User** (or equivalent); billing as required for Generative AI.
3. Confirm **`vertex_project`** in **`google-api/litellm_config.yaml`** matches the JSON **`project_id`** (this repo uses the same project for both models).

### B. LiteLLM (Python)

1. Install LiteLLM: **`pip install -U litellm`** (upgrade occasionally; Cursor adapter bugs fix over time).
2. From **repo root**, start the proxy:  
   **`pwsh -NoProfile -ExecutionPolicy Bypass -File ".\google-api\vpe-start-api.ps1"`**  
   Or with ngrok: add **`-StartNgrok`**.
3. Leave that terminal **running**. Wait for **`Uvicorn running on http://0.0.0.0:4000`**.

### C. Verify bridge (terminal)

```powershell
.\google-api\vpe-ping-api.ps1
```

Expect **`HTTP 200`** on both lines. If this fails, **do not** touch Cursor yet — fix LiteLLM / GCP first.

### D. Cursor UI (one-time — not stored in git)

Cursor stores API overrides in the **application** settings, not in this repository (by design — keys and URLs are environment-specific).

1. Open **Cursor** → **Settings** → **Cursor Settings** → **Models** (or **Chat** → **Models** depending on Cursor version).
2. Enable **Override OpenAI Base URL**.
3. Set base URL to **`http://127.0.0.1:4000/v1`** for local Chat/Composer.  
   - For **Background Agent** or any **cloud** path to your proxy, use your **public** URL, e.g. **`https://<subdomain>.ngrok-free.app/v1`** (must be **HTTPS** and end with **`/v1`**).  
   - **Do not** use a base ending in **`/cursor`** for Gemini 3 on LiteLLM **1.83.x** — see **§ Symptom** below.
4. Set **OpenAI API Key** to the same value as **`general_settings.master_key`** in **`google-api/litellm_config.yaml`**.
5. **Add custom model** (two entries), names **exactly**: **`vader-3-flash`**, **`vader-31-pro`**. Enable both toggles.
6. Test in **Ask** mode first (**Ctrl+L**): choose **`vader-3-flash`**, send “ping”.  
7. If **Agent** still fails with a generic provider error while **Ask** works, use **Ask/Plan** for custom models or a stock Cursor model for Agent-heavy sessions (LiteLLM’s Cursor doc historically emphasized Ask/Plan for custom routing).

### E. Helper — print exact strings for Cursor

From repo root:

```powershell
.\google-api\vpe-print-cursor-settings.ps1
```

With ngrok HTTPS base (optional):

```powershell
.\google-api\vpe-print-cursor-settings.ps1 -PublicBaseUrl "https://YOUR-ID.ngrok-free.app"
```

This reads **`master_key`** from **`litellm_config.yaml`** and prints copy-paste blocks for **§ D**.

---

## Symptom: `ERROR_PROVIDER_ERROR` — “trouble finding the resource”

That message is **Cursor’s generic wrapper** when the configured provider URL, auth, or response shape fails. It is **not** a Vertex string verbatim. Common causes:

| Cause | What to do |
|--------|------------|
| **Wrong OpenAI base URL** | Use **`http://127.0.0.1:4000/v1`** (local) or **`https://<your-tunnel-host>/v1`** (remote). Must end with **`/v1`** so paths become **`…/v1/chat/completions`** or **`…/v1/responses`**. |
| **Using `/cursor` as base (LiteLLM “Cursor integration”)** | Official LiteLLM docs mention a **`/cursor`** adapter. On **LiteLLM 1.83.x** with **Gemini 3** via Vertex, **`POST /cursor/chat/completions`** can return **500** (`Unknown items in responses API response`). **Prefer base URL ending in `/v1`** for this stack until you verify a newer LiteLLM fixes the adapter. |
| **LiteLLM not running** | Start **`.\google-api\vpe-start-api.ps1`** (`-StartNgrok` if you need a public URL). |
| **Cloud Agent + localhost** | Cursor **cloud** agents cannot reach **`127.0.0.1`** on your PC. Use **ngrok** (or similar) and put the **HTTPS** URL + **`/v1`** in settings. |
| **ngrok Free interstitial** | Requests without **`ngrok-skip-browser-warning: true`** may get HTML instead of JSON → opaque provider errors. Prefer **reserved ngrok domain / paid**, or confirm with **`curl -i`** that you receive JSON. Cursor may not let you add arbitrary default headers. |
| **Wrong API key** | Use **`Authorization: Bearer <master_key>`** where **`master_key`** is in **`google-api/litellm_config.yaml`** → **`general_settings.master_key`**. Same value goes in Cursor’s **OpenAI API Key** override field. |
| **Wrong model id** | In Cursor, the custom model name must match LiteLLM exactly: **`vader-3-flash`** or **`vader-31-pro`** (see **`GET …/v1/models`**). |
| **Cursor Agent vs custom API** | LiteLLM’s Cursor tutorial states **Ask** and **Plan** modes for custom routing; **Agent** historically has weaker / inconsistent custom OpenAI support. If **only Agent** fails, try **Chat → Ask (Ctrl+L)** with the same model, or use a built-in model for Agent-heavy work. |

---

## Credentials path (Vertex)

Service account JSON must live at **`google-api/gcp_key.json`** (not repo root). **`vpe-start-api.ps1`** sets **`GOOGLE_APPLICATION_CREDENTIALS`** to that path.

---

## Quick manual checks (curl)

Replace **`BASE`** and **`KEY`**:

```text
curl.exe -s -H "Authorization: Bearer KEY" "BASE/v1/models"
curl.exe -s -X POST "BASE/v1/chat/completions" -H "Authorization: Bearer KEY" -H "Content-Type: application/json" -d "{\"model\":\"vader-3-flash\",\"messages\":[{\"role\":\"user\",\"content\":\"pong?\"}],\"max_tokens\":128}"
```

Expect **HTTP 200** and JSON (not HTML).

---

## Authority cross-links

- **`google-api/README.md`** — bridge chain, Vertex, ngrok, **`vpe-print-cursor-settings.ps1`**.
- **`.cursor/docs/TRUTH.md` §7** — constitutional bridge notes.
- **LiteLLM Cursor tutorial:** [Cursor Integration](https://docs.litellm.ai/docs/tutorials/cursor_integration) (read alongside this file; **base URL choice follows the table above** for Gemini 3 on this repo).

**Signature:** Powered by the VPE Jedi-Master · match root **`package.json`** version.
