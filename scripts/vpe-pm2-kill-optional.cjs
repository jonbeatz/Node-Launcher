'use strict';

/**
 * Runs `npx pm2 kill` but never fails the npm script chain (PM2 may be absent).
 * Keeps `vader:clean-sync` aggressive without breaking on `&&` after a missing PM2.
 */

const { execSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');

try {
  execSync('npx pm2 kill', {
    cwd: root,
    stdio: 'ignore',
    shell: true,
    env: process.env,
  });
} catch {
  /* ignore */
}
