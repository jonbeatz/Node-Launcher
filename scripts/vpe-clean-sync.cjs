'use strict';

/**
 * Pre-dev clean — optional PM2 sweep, remove `dist/`, hard settle delay.
 * Invoked by `npm run vader:clean-sync` **before** `npm run vader:dev` (see `package.json`).
 *
 * Does **not** spawn Electron or run `vader:post-dev-forge`. For gated snapshot + syntax
 * + pack after dev, use `vader:sync` or `vader:dev-to-forge`. For deploy after manual
 * verification, use `vader:deploy` (clean + dev, then `build:win` when dev exits).
 *
 * Only `dist/` is removed. Never deletes `media/` or repo `build/`.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { setTimeout: delay } = require('timers/promises');

const root = path.join(__dirname, '..');
const distDir = path.join(root, 'dist');
const pm2Kill = path.join(__dirname, 'vpe-pm2-kill-optional.cjs');

/** After rimraf / PM2 kill — let Windows release handles and ports. */
const HARD_DELAY_MS = 15_000;

function msc_spawnEnv() {
  return {
    ...process.env,
    npm_config_loglevel: 'silent',
    NO_UPDATE_NOTIFIER: '1',
  };
}

function msc_rimrafDist() {
  if (!fs.existsSync(distDir)) return;
  fs.rmSync(distDir, { recursive: true, force: true });
}

(async () => {
  spawnSync(process.execPath, [pm2Kill], {
    cwd: root,
    stdio: 'inherit',
    env: msc_spawnEnv(),
    windowsHide: true,
  });

  msc_rimrafDist();

  await delay(HARD_DELAY_MS);

  console.log('[VPE CLEAN-SYNC] dist cleared; next: vader:dev (close app to continue deploy chain).')
  process.exit(0);
})().catch(() => process.exit(1));
