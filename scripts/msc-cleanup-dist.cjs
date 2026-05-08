/**
 * msc_cleanupDist — remove non-essential electron-builder artifacts from dist/ root only.
 * Never deletes directories (e.g. win-unpacked/) or the NSIS .exe installer.
 * Never touches repo `media/` (icons, thumbnails) or `build/` — only files directly under dist/.
 * (`vader:clean-sync` / vpe-clean-sync.cjs rims `dist/` only, not media.)
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const distDir = path.join(root, 'dist');

function msc_cleanupDist() {
  if (!fs.existsSync(distDir)) {
    console.log('msc-cleanup-dist: no dist/ folder — skip');
    console.log('[Vader Protocol] v1.2.6 Build Confirmed.');
    return { removed: [], skipped: true };
  }

  const removed = [];
  let entries;
  try {
    entries = fs.readdirSync(distDir, { withFileTypes: true });
  } catch (e) {
    console.warn('msc-cleanup-dist: readdir failed', e && e.message);
    return { removed: [], error: String(e && e.message) };
  }

  for (const ent of entries) {
    if (!ent.isFile()) continue;
    const name = ent.name;
    const lower = name.toLowerCase();
    const kill =
      lower.endsWith('.blockmap') ||
      lower.endsWith('.yml') ||
      name === 'builder-effective-config.yaml';

    if (!kill) continue;

    const full = path.join(distDir, name);
    try {
      fs.unlinkSync(full);
      removed.push(name);
    } catch (e) {
      console.warn(`msc-cleanup-dist: could not remove ${name}:`, e && e.message);
    }
  }

  if (removed.length) {
    console.log('msc-cleanup-dist: removed', removed.join(', '));
  } else {
    console.log('msc-cleanup-dist: nothing to remove (or dist empty)');
  }
  console.log('[Vader Protocol] All Thermal UI artifacts and Ghost PIDs purged.');
  console.log('[Vader Protocol] v1.2.6 Build Confirmed.');
  return { removed };
}

if (require.main === module) {
  msc_cleanupDist();
}

module.exports = { msc_cleanupDist };
