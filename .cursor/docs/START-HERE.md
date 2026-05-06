# ⚡ START HERE: VPE Session Entry

**Full cold start (read order, MCP, skills, tick list):** [AGENT-BOOT-CHECKLIST.md](AGENT-BOOT-CHECKLIST.md)

## 1. Project Mission
Vader Project Engine (VPE) is a high-performance command center for Node.js management, optimized for **Vader** hardware (Ryzen 9700x) and the **Vader Protocol** aesthetic.

## 2. Session Activation
When starting a new session, verify the local environment:
1. **Check Hardware:** Ensure system identifies as Ryzen 9700x / Windows 11 25H2.
2. **Verify Registry:** Check `projects.json` for data integrity.
3. **Runtime Check:** Confirm no other processes are occupying the default Next.js port (3000). VPE's auto-increment logic will handle conflicts automatically.

## 3. Communication Protocol
- **Strict Prefixing:** All functions `msc_`, all classes `msc-`.
- **Security First:** No direct Node imports in renderer; use the `vader` IPC bridge.
- **Aesthetic:** Background #121212, Surface #1c1c1c, Accent #e02b20.

## 4. Current Objectives
- [ ] Initialize Electron/Next.js foundation.
- [ ] Implement PM2 programmatic API.
- [ ] Build the "Nuke" and "Repair" suites.