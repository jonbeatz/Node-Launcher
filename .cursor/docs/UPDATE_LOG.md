# Project Update & Fix Log

This document serves as a check-in and reference tracker. Whenever we do an "Update Docs" sweep or complete a significant set of fixes, we will log the changes here. This provides a running historical record of what was fixed, how it was fixed, the root issues that were resolved, and any helpful notes for future reference.

---

## [2026-05-12] - CI Fixes, MCP Overhaul, and Documentation

### 🛠 Fixes & Root Issues Resolved
- **CI Native Module Mismatch (`ERR_DLOPEN_FAILED`)**: 
  - **Root Issue:** The `better-sqlite3` native module in GitHub Actions was failing to load because it was compiled against a different Node.js/Electron version than what the CI runner expected (Node `v115` vs `v119`).
  - **Fix:** Added `npx electron-rebuild` directly after `npm ci` in the `.github/workflows/ci.yml` pipeline to recompile native modules for the correct environment before tests/builds run.
- **CI Deprecation Warnings**: 
  - **Root Issue:** GitHub Actions runners were warning about outdated Node versions and deprecated Action versions.
  - **Fix:** Opted-in to Node.js 24 via the `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` env var, and bumped `actions/checkout` to `v4.2.2` and `actions/setup-node` to `v4.4.0`.
- **Fetch MCP Crashing on Windows**:
  - **Root Issue:** `mcp-server-fetch` via `uvx` crashes or timeouts on Windows without explicit encoding.
  - **Fix:** Added `"env": {"PYTHONIOENCODING": "utf-8"}` to the global `mcp.json` configuration for the fetch tool.
- **Payload MCP Not Found**:
  - **Root Issue:** The npx command for the payload MCP was looking for a non-existent or renamed package.
  - **Fix:** Updated the command to point to the correct NPM package: `@govcraft/payload-cms-mcp`.

### 📝 Updates & Improvements
- **Project-Level MCP Configuration**: Extracted the `novamira-*` MCPs from the global `C:\Users\JONBEATZ\.cursor\mcp.json` and placed them into the project-local `D:\Cursor_Projectz\Node-Launcher-v3\.cursor\mcp.json`. This keeps project-specific tools sandboxed and prevents main file clutter.
- **New MCP Documentation**: Created `.cursor/docs/MCPs.md` detailing every active MCP, what it does, example usage, and its current health/status.
- **Tavily Search Integration**: Successfully integrated the Tavily MCP for live web search and security queries.

### 💡 Helpful Info & Notes
- When an MCP tool running via Python/`uvx` on Windows gives silent timeouts or decoding errors, always verify if `PYTHONIOENCODING=utf-8` is required in the environment variables.
- Project-level MCPs automatically override or add to global MCPs when you are in that specific Cursor workspace. They live in `.cursor/mcp.json`.

## [2026-05-15] - MCP Infrastructure Overhaul & Design Standards

### 🛠 Fixes & Root Issues Resolved
- **Redundant OS Tools**: 
    - **Root Issue:** `windows-mcp` was erroring and conflicting with other desktop automation tools.
    - **Fix:** Documented removal of `windows-mcp` in favor of more stable `desktop-automation` and `desktop-commander`.
- **`untitledui` Connectivity**:
    - **Root Issue:** False-positive error indicator in Cursor UI.
    - **Fix:** Verified live tool functionality; documented that a settings refresh clears the transient error.

### 📝 Updates & Improvements
- **New MCP Servers (project `.cursor/mcp.json`)**: Added **`firecrawl`**, **`docker`**, and **`google-workspace`** alongside existing NovaMira WordPress MCPs.
- **Design-to-Code workflow:** **`figma`**, **Magic UI**, and **Prisma** MCPs are typically wired in **Cursor global MCP** or vendor docs; **`AGENTS.md`** describes how to combine them with **`untitledui`** / **`fetch`** in prompts.
- **Agent Instruction Layers**:
    - Created **`DESIGN.md`** for 2026 UI/UX standards (Tailwind v4, OKLCH).
    - Created **`AGENTS.md`** for multi-agent workflow orchestration.
    - Created **`.cursor/skills/`** with `git-commit.md` and `ui-generator.md` for specialized agent behaviors.

### 💡 Helpful Info & Notes
- **Pending configuration** (keys / paths — see also **`VADER_STATION_LOG.md`** top entry):
    - **`firecrawl`**: `FIRECRAWL_API_KEY` in project **`.cursor/mcp.json`**
    - **`figma`**: Remote MCP + OAuth per Figma docs (not necessarily in repo **`mcp.json`**)
    - **`google-workspace`**: `GOOGLE_CREDENTIALS_PATH` + `GOOGLE_TOKEN_PATH` in project **`.cursor/mcp.json`**
    - **`postman`**: `POSTMAN_API_KEY` in Cursor MCP settings
    - **`resend`**: `RESEND_API_KEY` in Cursor MCP settings
    - **`vercel` / `mcp-vercel`**: `VERCEL_API_TOKEN` in Cursor MCP settings
    - **Local `postgres` MCP**: valid DB connection string in env if you use it
    - **UntitledUI PRO**: optional license / OAuth per vendor if you want full PRO catalog

---

## [2026-05-15] - End Project bridge teardown + Start Project port recovery

### 📝 Docs & scripts
- **`google-api/vpe-end-api-bridge.ps1`**: free **:4000**, stop matching **ngrok**; **`.gitignore`** allowlist; **`.cursorrules`** Command Authority.
- **`End-Project.md`**: step 1 = teardown; **commit/push only if operator asked** (align repo rules); **operator paste block**.
- **`Start-Project.md`** + **`start-project-ritual.mdc`**: **`Cursor-LiteLLM-Bridge.md`** in mandatory reads; bridge steps renumbered; **`vpe-end-api-bridge`** before retry on port conflict; default **operator paste** includes **`Cursor-LiteLLM-Bridge.md`** + port recovery.
- **`Cursor-LiteLLM-Bridge.md`**: **Sovereign fix summary** table.
- **`TRUTH.md`** §7, **`Project-Bible.md`** §8, **`README.md`** §1: aligned with mandatory reads, **`vpe-end-api-bridge`**, and **`vpe-start-api`** preflight (**`PORT`**, **:4000** lock).

---

## [2026-05-14] - Cursor ↔ LiteLLM: `ERROR_PROVIDER_ERROR` runbook

### 📝 Docs
- Added **[`.cursor/docs/Cursor-LiteLLM-Bridge.md`](./Cursor-LiteLLM-Bridge.md)** — OpenAI override must use **`…/v1`** (not **`…/cursor`**) for Gemini 3 on LiteLLM **1.83.x**; **`POST /cursor/chat/completions`** can **500** while **`/v1/chat/completions`** and **`/v1/responses`** succeed; ngrok / Agent vs Ask / key path notes; **stale ngrok (ERR_NGROK_3200)** as #1 “worked yesterday” failure.
- Added **`google-api/vpe-verify-public-url.ps1`** — fails fast when Cursor’s ngrok **`/v1/models`** URL is offline (**ERR_NGROK_3200**). **`vpe-start-api.ps1 -StartNgrok`** now prints a **Cursor must update URL** reminder. **`vpe-print-cursor-settings.ps1`** warns that ngrok hostnames expire when the tunnel stops.

---

## [2026-05-14] - Start Project ritual: doc re-read + smoke script + no dev autostart

### 📝 Docs & tooling
- **`npm run start-project:smoke`**: **`typecheck`** + **`test:migrations`** — default agent health check on **Start Project** (no Next/Electron dev).
- **`.cursor/prompts/Start-Project.md`**: mandatory ordered **Read** list, smoke step, API bridge, **verify-only** still runs smoke + probes **:4000** only.
- **`.cursor/rules/start-project-ritual.mdc`**: **`alwaysApply: true`** reinforcement.
- **Aligned:** **`.cursorrules`**, **`TRUTH.md` §7**, **`Project-Bible.md` §7–§8**, **`README.md`**, **`VADER_STATION_LOG.md`**, **`Start-Master.md`**, **`Goalz.md`**, **`google-api/README.md`**, **`End-Project.md`**, **`.cursor/hooks/start-api.ps1`** banner.

---

## [2026-05-13] - Automated Build System Implemented

### 🛠 Features & Logic
- **Build Engine**: Created `scripts\upload_build.ps1` to automate packaging and deployment.
- **Versioning**: Implemented `VPE-JediBuild-$branch-v1.x` auto-incrementing logic.
- **Cursor Integration**: Added project-level rule to trigger deployment via the "Upload Build" phrase.

### ✅ Results
- **First Build**: Successfully pushed `VPE-JediBuild-main-v1.1` to GitHub.
- **Workflow**: Reduced deployment time from ~5 minutes (manual) to <10 seconds (automated).

### 📝 Docs / ritual (same day)
- **Start Project default** flipped to **agent auto-starts** the **`google-api`** bridge (**`vpe-start-api.ps1 -StartNgrok`**) + **`vpe-ping-api.ps1`** unless **verify-only**; reconciled **`.cursorrules`**, **`TRUTH.md` §7**, **`Project-Bible.md` §8**, **`VADER_STATION_LOG.md`**, **`End-Project.md`**, hook banner text, **`Workspace-Hygiene-Report.md`**, and **`Start-Project.md`** (repo-relative **`pwsh -File .\google-api\...`**). **`Command Authority`** in **`.cursorrules`** now explicitly allows those launchers.

---

*(Add new entries above this line following the same format)*