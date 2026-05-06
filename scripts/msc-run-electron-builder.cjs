/**
 * msc_run_electron_builder: spawn electron-builder with Windows-friendly env.
 * - CSC_IDENTITY_AUTO_DISCOVERY=false: do not auto-pick a signing cert.
 * - Strip CI_* so is-ci does not force signing paths.
 * - Optional: clear CSC_LINK / WIN_CSC_LINK so a stray global cert env cannot
 *   trigger unexpected signing paths.
 * - With signAndEditExecutable false, electron-builder skips winCodeSign (symlink
 *   extraction can fail without Developer Mode). The app icon is embedded in
 *   scripts/msc-after-pack-embed-icon.cjs via the rcedit npm package instead.
 */
'use strict';

const path = require('path');
const { spawnSync } = require('child_process');

process.env.CSC_IDENTITY_AUTO_DISCOVERY = 'false';
delete process.env.CSC_LINK;
delete process.env.WIN_CSC_LINK;
delete process.env.CI;
delete process.env.GITHUB_ACTIONS;
delete process.env.CONTINUOUS_INTEGRATION;

const root = path.join(__dirname, '..');
const bin =
  process.platform === 'win32'
    ? path.join(root, 'node_modules', '.bin', 'electron-builder.cmd')
    : path.join(root, 'node_modules', '.bin', 'electron-builder');

const env = { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false' };
delete env.CSC_LINK;
delete env.WIN_CSC_LINK;

const r = spawnSync(bin, process.argv.slice(2), {
  stdio: 'inherit',
  shell: true,
  cwd: root,
  env,
});

process.exit(r.status === null ? 1 : r.status);
