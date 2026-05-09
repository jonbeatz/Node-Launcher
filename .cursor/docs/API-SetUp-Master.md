# Vader API Setup: Master Blueprint (v1.6.1)

This master guide consolidates every technical configuration, fix, and daily routine required to use Google Cloud Vertex AI with Cursor via LiteLLM and Ngrok. **v1.6.1** makes the stack **self-contained** under `.\google-api\` and scripted via **`.\vpe-start-api.ps1`** (repo root).

---

## Plug back in after a Cursor restart (copy this checklist)

Cursor does **not** store your Google service account secret. After you restart Cursor—or reboot—you only need processes and settings below. **Nothing in Cursor restores LiteLLM or ngrok for you.**

### How connection actually works

1. **Google → LiteLLM:** `.\google-api\gcp_key.json` is referenced by **`GOOGLE_APPLICATION_CREDENTIALS`**. LiteLLM uses it to call **Vertex AI** (models are listed in **`.\google-api\litellm_config.yaml`**; project id there must match your GCP project).
2. **LiteLLM:** Listens on **port `4000`** (locked for this workspace). Uvicorn prints **`http://0.0.0.0:4000`**.
3. **Ngrok:** Forwards **`http://localhost:4000`** to a **public HTTPS URL** Cursor can reach.
4. **Cursor:** Sends OpenAI-compatible requests to **Base URL + `/v1`**, with **API Key = LiteLLM `master_key`** (see `litellm_config.yaml` → `general_settings.master_key`). Cursor **never** needs the contents of `gcp_key.json`.

### Recommended: one command (self-contained)

| Step | What | Notes |
|:---:|:---|:---|
| 1 | **PowerShell at repo root** | `Node-Launcher` |
| 2 | Run script | `.\vpe-start-api.ps1` — sets `GOOGLE_APPLICATION_CREDENTIALS` to **`$PSScriptRoot\google-api\gcp_key.json`**, starts **ngrok** in a **new** window on **4000**, runs **`litellm --config ./google-api/litellm_config.yaml --port 4000`** in this window |
| 3 | **Cursor → Settings → Models** | **Override OpenAI Base URL:** `https://<your-ngrok-host>/v1` (must end with **`/v1`**) · **API Key:** `sk-vader-protocol-1234` |

**If ngrok assigns a new URL:** update Cursor’s Base URL only; **`master_key`** in `google-api/litellm_config.yaml` stays the same unless you change it deliberately.

### Manual fallback (same paths, port 4000)

| Step | What | Notes |
|:---:|:---|:---|
| 1 | Set GCP env | `$env:GOOGLE_APPLICATION_CREDENTIALS=".\google-api\gcp_key.json"` (from repo root; or use absolute path if you prefer) |
| 2 | (Optional, if console encoding errors) | `$env:PYTHONUTF8="1"; $env:PYTHONIOENCODING="utf-8"` |
| 3 | Start proxy | `litellm --config ./google-api/litellm_config.yaml --port 4000` |
| 4 | **Second terminal — ngrok** | `ngrok http 4000` |

### Quick sanity checks

- **Local (with auth):** `Invoke-WebRequest -Uri "http://127.0.0.1:4000/v1/models" -Headers @{ Authorization = "Bearer sk-vader-protocol-1234" }` — expect **200**. Empty/wrong Bearer → **401**.
- **`401` in Cursor:** Re-enter **`sk-vader-protocol-1234`** in Cursor; Base URL must be the **HTTPS** ngrok forwarding URL + **`/v1`**.

---

## 🏗️ 1. System Architecture
VPE uses a local **LiteLLM Proxy** and **Ngrok Tunnel** to bridge Cursor's OpenAI-style requests to Google Cloud's Vertex AI API.
- **Client:** Cursor IDE (Settings -> Models -> Override Base URL)
- **Proxy:** LiteLLM (running locally on port **4000**)
- **Tunnel:** Ngrok (Forwarding **http://localhost:4000** to a public HTTPS URL)
- **Backend:** Google Cloud Vertex AI (Model: Gemini/Vader aliases)

---

## 🛰️ 2. VADER PROTOCOL: CONNECTION GUIDE

Follow these revised steps to re-establish the bridge between Cursor, LiteLLM, and your Google Cloud credits.

### Step 1: Initialize the LiteLLM Bridge (scripted)

From the repo root:

```powershell
.\vpe-start-api.ps1
```

**Note:** Confirm the console shows Uvicorn on **`http://0.0.0.0:4000`**. The script also opens a second window for **ngrok http 4000**.

### Step 2: Ngrok (if not using the script)

```powershell
.\ngrok http 4000
```

(or `ngrok http 4000` if `ngrok` is on your `PATH`)

**Verify the Forwarding URL** in the ngrok window and paste it into Cursor as **`https://<host>/v1`**.

### Step 3: Update Cursor Settings
1. **Override OpenAI Base URL:** `https://<your-ngrok-host>/v1`
2. **API Key:** `sk-vader-protocol-1234`

*Press Enter after typing in each field to ensure Cursor saves the changes.*

---

## 🔑 3. The Google Service Account Key (`gcp_key.json`)
The `gcp_key.json` file is your identity on Google Cloud.

- **Active File Path (repo-relative):** `.\google-api\gcp_key.json`
- **Verification:** `client_email` must be `cursor-access@wordpress-map-1492461083797.iam.gserviceaccount.com`.

---

## 💡 Quick Tips for Next Time

- **Port Match:** LiteLLM and ngrok both use **`4000`** for this project.
- **401 Unauthorized:** This means the API Key field in Cursor is empty or incorrect. Re-enter `sk-vader-protocol-1234`.
- **Session Expiry:** If you restart ngrok and the URL changes, update the "Override URL" in Cursor.

---

## 🛠️ 4. Historical Troubleshooting Ledger

### ⚠️ Issue #1: Service Account Mismatch (403 Forbidden)
- **Resolution:** Matched the local key to the authorized `cursor-access` account.

### ⚠️ Issue #2: Disabled Google APIs (404/Method Not Found)
- **Resolution:** Enabled **Vertex AI API** in the GCP Project Console.

### ⚠️ Issue #3: Regional Route Restrictions
- **Resolution:** Set `vertex_location: "global"` in **`google-api/litellm_config.yaml`**.

---

## 🚀 5. Workspace Automation

- **Keyword:** "start API"
- **Action:** From repo root, run **`.\vpe-start-api.ps1`** (or the manual fallback above with **`.\google-api\gcp_key.json`** and **`--port 4000`**).

---

*Document revision v1.6.1 — API assets under `google-api/`; scripted start; port **4000** locked.*

*Powered by the MSC Media Engine*
