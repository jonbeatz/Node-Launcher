# Vader API Setup: Master Blueprint (v2.1)

This master guide consolidates every technical configuration, fix, and daily routine required to use Google Cloud Vertex AI with Cursor via LiteLLM and Ngrok.

---

## 🏗️ 1. System Architecture
VPE uses a local **LiteLLM Proxy** and **Ngrok Tunnel** to bridge Cursor's OpenAI-style requests to Google Cloud's Vertex AI API.
- **Client:** Cursor IDE (Settings -> Models -> Override Base URL)
- **Proxy:** LiteLLM (running locally on port **28401**)
- **Tunnel:** Ngrok (Forwarding port **28401** to a public HTTPS URL)
- **Backend:** Google Cloud Vertex AI (Model: Gemini/Vader aliases)

---

## 🛰️ 2. VADER PROTOCOL: CONNECTION GUIDE

Follow these revised steps to re-establish the bridge between Cursor, LiteLLM, and your Google Cloud credits.

### Step 1: Initialize the LiteLLM Bridge
This sets your credentials and starts the local server. Run these in your first terminal.

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS="D:\Cursor_Projectz\Node-Launcher\gcp_key.json"
litellm --config litellm_config.yaml
```

**Note:** Observe the terminal output. If it says "Uvicorn running on http://0.0.0.0:28401", then **28401** is your active port.

### Step 2: Launch the Ngrok Tunnel
Open a second terminal. This creates the public HTTPS link Cursor needs to reach your machine.

```powershell
.\ngrok http 28401
```

**Verify the Forwarding URL** in the terminal matches:
`https://pushy-water-reformer.ngrok-free.dev`

### Step 3: Update Cursor Settings
1. **Override OpenAI Base URL:** `https://pushy-water-reformer.ngrok-free.dev/v1`
2. **API Key:** `sk-vader-protocol-1234`

*Press Enter after typing in each field to ensure Cursor saves the changes.*

---

## 🔑 3. The Google Service Account Key (`gcp_key.json`)
The `gcp_key.json` file is your identity on Google Cloud.

- **Active File Path:** `D:\Cursor_Projectz\Node-Launcher\gcp_key.json`
- **Verification:** `client_email` must be `cursor-access@wordpress-map-1492461083797.iam.gserviceaccount.com`.

---

## 💡 Quick Tips for Next Time

- **Port Match:** If you ever see a connection error, ensure the port in LiteLLM (e.g., **28401**) matches the port in ngrok.
- **401 Unauthorized:** This means the API Key field in Cursor is empty or incorrect. Re-enter `sk-vader-protocol-1234`.
- **Session Expiry:** If you restart ngrok and the URL changes, update the "Override URL" in Cursor.

---

## 🛠️ 4. Historical Troubleshooting Ledger

### ⚠️ Issue #1: Service Account Mismatch (403 Forbidden)
- **Resolution:** Matched the local key to the authorized `cursor-access` account.

### ⚠️ Issue #2: Disabled Google APIs (404/Method Not Found)
- **Resolution:** Enabled **Vertex AI API** in the GCP Project Console.

### ⚠️ Issue #3: Regional Route Restrictions
- **Resolution:** Set `vertex_location: "global"` in `litellm_config.yaml`.

---

## 🚀 5. Workspace Automation
To automate this, the following rule is already active in your `.cursorrules`:

- **Keyword:** "start API"
- **Action:** Open PowerShell terminal and run the environment setup + `litellm` command.

---
*Powered by the MSC Media Engine*
