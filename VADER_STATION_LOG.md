# Vader Station Log

**Purpose:** Single place for operators and agents running **Start Project** to grab a **short** narrative of infra + recent product notes. Prefer **[`.cursor/docs/Checkpoint.md`](.cursor/docs/Checkpoint.md)** for full branch/build history.

---

## API stack (v1.6.1)

**Self-contained & scripted:** run **`.\vpe-start-api.ps1`** from repo root. Credentials: **`.\google-api\gcp_key.json`** (gitignored). Config: **`.\google-api\litellm_config.yaml`**. **LiteLLM** and **ngrok** target **port 4000** (locked). Details: [.cursor/docs/API-SetUp-Master.md](.cursor/docs/API-SetUp-Master.md).

---

## Product snapshot

- **Ritual:** [.cursor/prompts/Start-Project.md](.cursor/prompts/Start-Project.md) · entry [.cursor/docs/START-HERE.md](.cursor/docs/START-HERE.md)
- **Shipped app version / branch:** root **`package.json`** + **[Checkpoint.md](.cursor/docs/Checkpoint.md)** (authoritative for build lines)

*Update this file when a major mission completes or API behavior changes; keep it brief.*
