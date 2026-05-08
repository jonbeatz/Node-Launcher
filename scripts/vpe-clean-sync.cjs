'use strict';

/**
 * v1.2.0: Guaranteed forge preamble — clears dist, launches vader:dev in the background,
 * waits 10s (aggressive teardown window), then runs `vader:post-dev-forge`.
 * Replaces brittle `cmd`-only `(npm … & timeout /t 10)` strings under npm-script shells.
 *
 * Only `dist/` is removed (`msc_rimrafDist`). Never deletes `media/` (icons / assets) or repo `build/`.
 */

const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { setTimeout: delay } = require('timers/promises');

const root = path.join(__dirname, '..');
const distDir = path.join(root, 'dist');

const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const TEN_S_MS = 10_000;

function msc_rimrafDist() {
  if (!fs.existsSync(distDir)) return;
  fs.rmSync(distDir, { recursive: true, force: true });
}

(async () => {
  msc_rimrafDist();

  const dev = spawn(NPM, ['run', 'vader:dev'], {
    cwd: root,
    shell: process.platform === 'win32',
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
    env: { ...process.env },
  });

  dev.unref();

  await delay(TEN_S_MS);

  const post = spawnSync(NPM, ['run', 'vader:post-dev-forge'], {
    cwd: root,
    shell: process.platform === 'win32',
    stdio: 'inherit',
    env: { ...process.env },
    windowsHide: true,
  });

  process.exit(post.status === null ? 1 : post.status ?? 1);
})().catch(() => process.exit(1));
