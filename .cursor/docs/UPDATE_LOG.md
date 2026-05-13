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
- **Project-Level MCP Configuration**: Extracted the `novamira-*` MCPs from the global `C:\Users\JONBEATZ\.cursor\mcp.json` and placed them into the project-local `D:\Cursor_Projectz\Node-Launcher-v2\.cursor\mcp.json`. This keeps project-specific tools sandboxed and prevents main file clutter.
- **New MCP Documentation**: Created `.cursor/docs/MCPs.md` detailing every active MCP, what it does, example usage, and its current health/status.
- **Tavily Search Integration**: Successfully integrated the Tavily MCP for live web search and security queries.

### 💡 Helpful Info & Notes
- When an MCP tool running via Python/`uvx` on Windows gives silent timeouts or decoding errors, always verify if `PYTHONIOENCODING=utf-8` is required in the environment variables.
- Project-level MCPs automatically override or add to global MCPs when you are in that specific Cursor workspace. They live in `.cursor/mcp.json`.

---

*(Add new entries above this line following the same format)*