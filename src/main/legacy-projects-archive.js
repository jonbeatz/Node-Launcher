const fs = require('fs');
const path = require('path');
const {
  MSC_LEGACY_PROJECTS_JSON_PATH,
} = require('./db/persistent-store');

/**
 * Moves root `projects.json` into media/_vpe_archive after the persistent store has run migration.
 * Prevents stray reads from the deprecated registry path.
 */
function msc_archiveLegacyProjectsJson() {
  const src = MSC_LEGACY_PROJECTS_JSON_PATH;
  try {
    if (!fs.existsSync(src)) return;
    const destDir = path.join(process.cwd(), 'media', '_vpe_archive');
    fs.mkdirSync(destDir, { recursive: true });
    const dest = path.join(
      destDir,
      `projects.json.${Date.now()}.deprecated`,
    );
    fs.renameSync(src, dest);
    console.log(`VPE: Deprecated projects.json moved to ${dest}`);
  } catch (e) {
    console.warn(
      'VPE: Could not archive legacy projects.json:',
      e?.message ?? e,
    );
  }
}

module.exports = { msc_archiveLegacyProjectsJson };
