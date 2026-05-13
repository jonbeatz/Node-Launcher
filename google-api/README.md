# Google API workspace (VPE)

- **`gcp_key.json`** — service account (local only; gitignored).
- **`litellm_config.yaml`** — tracked LiteLLM / Vertex routing.
- **`vpe-start-api.ps1`** — start LiteLLM on **port 4000** (run from repo root: **`.\google-api\vpe-start-api.ps1`**).
- **`ngrok.exe`** — optional; exposed via **User PATH** when **`scripts/vpe-add-node-launcher-user-path.ps1`** has been run.

Optional third-party env files (**Brevo**, **Spaceship**, etc.): keep as **`.env.production`** or similar **under this folder**; they remain gitignored by **`google-api/*`** unless explicitly allowlisted.
