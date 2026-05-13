'use strict';

const path = require('path');

/** Mirrors `msc_configureWritablePaths` in src/main/main.js (Windows). */
function msc_getVpeUserDataDir() {
  const localAppData =
    process.env.LOCALAPPDATA ||
    path.join(process.env.USERPROFILE || process.cwd(), 'AppData', 'Local');
  return path.join(localAppData, 'VaderProjectEngine', 'user-data');
}

module.exports = { msc_getVpeUserDataDir };
