# Vader API Setup: Master Blueprint (v2.0)

This master guide consolidates every technical configuration, fix, and daily routine required to use Google Cloud Vertex AI with Cursor via LiteLLM.

---

## 🏗️ 1. System Architecture
VPE uses a local **LiteLLM Proxy** to bridge Cursor's OpenAI-style requests to Google Cloud's Vertex AI API.
- **Client:** Cursor IDE (Settings -> Models -> Override Base URL)
- **Proxy:** LiteLLM (running locally on port 4000)
- **Backend:** Google Cloud Vertex AI (Model: Gemini/Vader aliases)

---

## 🔑 2. The Google Service Account Key (`gcp_key.json`)
The `gcp_key.json` file is your identity on Google Cloud. It must be valid and correctly authorized.

- **Active File Path:** `D:\Cursor_Projectz\Node-Launcher\gcp_key.json`
- **Verification Requirements:**
  - `type`: Must be `"service_account"`.
  - `client_email`: Must be `cursor-access@wordpress-map-1492461083797.iam.gserviceaccount.com`.
  - **Note:** This account must have the **Vertex AI User** role assigned in the GCP Console.

---

## ⚡ 3. Daily Start-Up Checklist
To activate the connection after a reboot or Cursor restart:

1. **Open Terminal:** `Ctrl + ~` in Cursor.
2. **Set Environment Variable:**
   ```powershell
   $env:GOOGLE_APPLICATION_CREDENTIALS="D:\Cursor_Projectz\Node-Launcher\gcp_key.json"
   ```
3. **Start Proxy:**
   ```powershell
   litellm --config litellm_config.yaml
   ```
4. **Minimize (Don't Close):** Keep the terminal running. Do not use the trash can icon.

---

## ⚙️ 4. Cursor Integration Settings
Map Cursor to your local pipeline via **Settings (Ctrl + ,) -> Models**:

- **Override OpenAI Base URL:** `http://localhost:4000/v1`
- **API Key:** `sk-vader-protocol-1234`
- **Models to Add:**
  - `vader-31-pro`
  - `vader-3-flash`
- **Important:** Toggle off all default public models to ensure your local Vertex aliases are used.

---

## 🛠️ 5. Critical Troubleshooting Ledger (Historical Fixes)

### ⚠️ Issue #1: Service Account Mismatch (403 Forbidden)
- **Symptom:** Authentication failures despite having a key.
- **Root Cause:** The `gcp_key.json` file originally belonged to an unauthorized `litellm-proxy` account.
- **Resolution:** We matched the local key to the authorized `cursor-access` account (formerly `gcp_key2.json`) and renamed it to the standard `gcp_key.json`.
- **Diagnostic:** Check `client_email` in `gcp_key.json`.

### ⚠️ Issue #2: Disabled Google APIs (404/Method Not Found)
- **Symptom:** Correct credentials but structural HTTP errors.
- **Root Cause:** Vertex AI API was disabled in the GCP Project Console.
- **Resolution:** Enabled **Vertex AI API** in the [GCP API Library](https://console.cloud.google.com/apis/library/aiplatform.googleapis.com).

### ⚠️ Issue #3: Regional Route Restrictions
- **Symptom:** Connections fail when targeting specific regions (e.g., `us-central1`).
- **Root Cause:** Experimental/preview models are often hosted on global edge infrastructure.
- **Resolution:** Set `vertex_location: "global"` in `litellm_config.yaml`.

### ⚠️ Issue #4: Startup Rate Limit Warnings
- **Symptom:** `INFO: LiteLLM Router: None of the configured models are within their rate limits...`
- **Root Cause:** Standard behavior for LiteLLM's initialization on low-quota tiers.
- **Resolution:** **Ignore.** As long as the server prints `200 OK` on requests, the connection is working.

---

## 🚀 6. Workspace Automation
To automate this, the following rule is already active in your `.cursorrules`:

- **Keyword:** "start API"
- **Action:** Open PowerShell terminal and run the environment setup + `litellm` command.

---
*Powered by the MSC Media Engine*
