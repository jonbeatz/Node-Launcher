'use strict';

/**
 * Aggressive clean-sync — lock-clear via `vpe-pm2-kill-optional.cjs` + `npx rimraf dist` in npm,
 * second dist wipe here, hard delay so PM2/Electron teardown can settle,
 * then detached `vader:dev` + settle window + `vader:post-dev-forge`.
 *
 * Note: `(npm run vader:dev || exit 0) && forge` cannot be inlined in package.json because
 * `vader:dev` is long-running (concurrently keeps the process alive). This script mirrors the
 * intent: never fail the pipeline if the dev spawn errors (`|| exit 0`).
 *
 * Only `dist/` is removed. Never deletes `media/` or repo `build/`.
 */

const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { setTimeout: delay } = require('timers/promises');

const root = path.join(__dirname, '..');
const distDir = path.join(root, 'dist');

const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';
/** After rimraf / PM2 kill — let Windows release handles and ports. */
const HARD_DELAY_MS = 15_000;
/** After spawning detached dev — stack warm-up before forge. */
const SETTLE_AFTER_DEV_MS = 10_000;

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
  msc_rimrafDist();

  await delay(HARD_DELAY_MS);

  try {
    const dev = spawn(NPM, ['run', '--silent', 'vader:dev'], {
      cwd: root,
      shell: process.platform === 'win32',
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      env: msc_spawnEnv(),
    });
    dev.unref();
  } catch {
    /* Treat like `|| exit 0` — still attempt forge */
  }

  await delay(SETTLE_AFTER_DEV_MS);

  const post = spawnSync(NPM, ['run', '--silent', 'vader:post-dev-forge'], {
    cwd: root,
    shell: process.platform === 'win32',
    stdio: ['ignore', process.stdout, process.stderr],
    env: msc_spawnEnv(),
    windowsHide: true,
  });

  const code = post.status === null ? 1 : post.status ?? 1;
  if (code === 0) {
    console.log('[VPE STANDBY]');
  }
  process.exit(code);
})().catch(() => process.exit(1));
