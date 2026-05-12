# REPAIR PROTOCOLS (v2.2.5)

This document contains runbooks and instructions for Forge, Nuke, and Vault maintenance operations in the Vader Project Engine.

## 1. The Nuke Protocol

A "Nuke" action must follow this strict sequence:
1. `tree-kill` the existing PM2 process.
2. Delete `node_modules` and `.next`.
3. Execute a clean `<detectedPackageManager> install`.
4. Re-capture thumbnail via Puppeteer only after an HTTP 200 health check is verified.

## 2. Forge & Build Sequences

- **vader:sync**: Development sync. Runs dev server, captures state, and checks readiness.
- **vader:deploy**: Production deployment. Runs `vader:clean-sync` followed by `build:win` to generate the final `.exe`.
- **vader:clean-sync**: Clean sync. Purges app data, dist, and cache before running the build process.

## 3. Vault Maintenance

The `media/vault` directory is write-protected by `vpe-vault-rm-guard.js`. Only specific actions can modify it:
- **vpe:delete-project**: Officially sanctioned deletion sets `global.__vpeVaultHardDeleteActive = true`.
- **Forge Bypass**: Files prefixed with `_FORGE_TEMP_` bypass the guard for diagnostic and testing purposes.

## 4. Scorched Earth Recovery

If the local environment breaks severely, run the **Scorched Earth** procedure:
1. Trigger `vpe:scorched-earth` IPC or use the UI option.
2. This drops PM2 tasks, purges caches, and restarts the environment safely.