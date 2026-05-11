# AGENTS.md

## Cursor Cloud specific instructions

### Project Overview

Vader Project Engine (VPE) is an Electron + Next.js 15 desktop application for managing Node.js development projects via PM2. See `README.md` and `.cursorrules` for full context.

### Services

| Service | Command | Port | Notes |
|---------|---------|------|-------|
| Next.js Renderer (dev) | `npm run dev:renderer` | 3000 | The dashboard UI |
| Electron Main | `npm run dev:main` | 9222 (CDP) | Requires a display (`DISPLAY=:99` with Xvfb on headless Linux) |
| Both together | `npm run dev` | 3000 + 9222 | Uses `concurrently` |

### Key Commands (from `package.json`)

- **Lint:** `npm run lint`
- **Typecheck:** `npm run typecheck`
- **Migration tests:** `npm run test:migrations`
- **Build renderer:** `npm run build:renderer`
- **E2E tests:** `npm run test:e2e` (Playwright, renderer only)
- **E2E Electron:** `npm run test:e2e:electron` (requires `build:renderer` first)

### Headless Linux (Cloud Agent) Caveats

- Electron needs `DISPLAY=:99` with Xvfb running: `Xvfb :99 -screen 0 1920x1080x24 &`
- D-Bus and GPU errors in Electron output are expected and non-blocking in headless environments.
- The LiteLLM API proxy (`google-api/`) is **optional** and requires Google Cloud credentials not available in CI. Skip it for standard dev/test.
- Native modules (`better-sqlite3`, `node-pty`) must be rebuilt for Electron ABI after `npm ci`: `npx electron-rebuild -f -o better-sqlite3 && npx electron-rebuild -f -o node-pty`
- `.npmrc` enforces `legacy-peer-deps=true` (required for React 19 + Next 15 peer resolution).
