import { defineConfig } from '@playwright/test'

/**
 * Packaged `dist/win-unpacked` smoke — CDP attaches to the built
 * `Vader Project Engine.exe` (not the dev `electron` CLI).
 */
export default defineConfig({
  testDir: 'e2e/electron',
  testMatch: 'packaged-dist-smoke.spec.ts',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',
  timeout: 240_000,
})
