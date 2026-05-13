import { defineConfig } from '@playwright/test'

/**
 * Electron IPC e2e: CDP attaches to unpackaged Electron loading the **static renderer**
 * (`ELECTRON_IS_DEV=0` → `build:renderer` export). Uses isolated `userData`
 * (`VPE_E2E_USER_DATA`).
 */
export default defineConfig({
  testDir: 'e2e/electron',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',
  timeout: 120_000,
})
