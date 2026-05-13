/**
 * Vader Protocol — stage release icon for electron-builder / dev (Forge-safe path).
 * Source: _design_references/VPE.ico (unchanged). Target: media/icon.ico
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const msc_from = path.join(root, '_design_references', 'VPE.ico');
const msc_mediaDir = path.join(root, 'media');
const msc_to = path.join(msc_mediaDir, 'icon.ico');

if (!fs.existsSync(msc_from)) {
  console.error(
    'msc-copy-release-icon: missing source _design_references/VPE.ico:',
    msc_from,
  );
  process.exit(1);
}

fs.mkdirSync(msc_mediaDir, { recursive: true });
fs.copyFileSync(msc_from, msc_to);
console.log('msc-copy-release-icon: ok', msc_to);
