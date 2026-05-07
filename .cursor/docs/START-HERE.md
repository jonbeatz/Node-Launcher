# ⚡ START HERE: VPE Session Entry

**Full cold start (read order, MCP, skills, tick list):** [AGENT-BOOT-CHECKLIST.md](AGENT-BOOT-CHECKLIST.md)

**Cursor ↔ Google (Vertex AI) via LiteLLM + ngrok** (paths, ports, Cursor settings, post-restart checklist): [API-SetUp-Master.md](API-SetUp-Master.md)

**Build & terminal command sequencing** (`vader:dev`, **`VPE_LAUNCHER_FORGE`** [reserved flag; no thermal polling in main as of **v1.1.6**], **`vader:dev-to-forge`**, **`vader:post-dev-forge`**, **`vader:force-forge`**, **`vader:sync`**, **`vader:clean-sync`**, `&&` gates, **`vpe-forge-pause`**, snapshot, syntax guard, **`dist/`** artifacts): [VPE-BUILD-PROTOCOL.md](VPE-BUILD-PROTOCOL.md) (v1.1.8)

**Shipped app version:** root **`package.json` → `"version"`** (currently **1.1.8**) drives preload / footer / metadata — see [Custom-Commands.md — Update Docs](Custom-Commands.md#update-docs) after each release.

## 1. Project Mission
Vader Project Engine (VPE) is a high-performance command center for Node.js management, optimized for **Vader** hardware (Ryzen 9700x) and the **Vader Protocol** aesthetic.

## 2. Session Activation
When starting a new session, verify the local environment:
1. **Check Hardware:** Ensure system identifies as Ryzen 9700x / Windows 11 25H2.
2. **Verify Registry:** Check `projects.json` for data integrity.
3. **Runtime / packaging:** Prefer launcher owning **3000** during **`npm run dev`** / Vader dev; use **`npm run vader:sync`** when you need **dev → snapshot → syntax guard → Windows pack** (see [VPE-BUILD-PROTOCOL.md](VPE-BUILD-PROTOCOL.md)).

## 3. Communication Protocol
- **Strict Prefixing:** All functions `msc_`, all classes `msc-`.
- **Security First:** No direct Node imports in renderer; use the `vader` IPC bridge.
- **Aesthetic:** Background #121212, Surface #1c1c1c, Accent #e02b20.

## 4. Current Objectives
- [ ] Initialize Electron/Next.js foundation.
- [ ] Implement PM2 programmatic API.
- [ ] Build the "Nuke" and "Repair" suites.