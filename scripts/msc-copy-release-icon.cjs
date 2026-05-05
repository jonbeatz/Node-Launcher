/**
 * Vader Protocol — copy packaged window/installer icon into electron-builder buildResources.
 * Source: _design_references/VPE.ico (unchanged). Target: build/icon.ico
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const msc_from = path.join(root, '_design_references', 'VPE.ico');
const msc_buildDir = path.join(root, 'build');
const msc_to = path.join(msc_buildDir, 'icon.ico');

if (!fs.existsSync(msc_from)) {
  console.error(
    'msc-copy-release-icon: missing source _design_references/VPE.ico:',
    msc_from,
  );
  process.exit(1);
}

fs.mkdirSync(msc_buildDir, { recursive: true });
fs.copyFileSync(msc_from, msc_to);
console.log('msc-copy-release-icon: ok', msc_to);
