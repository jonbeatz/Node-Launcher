/** @file Re-exports unified persistence (SQLite when possible; JSON fallback in Electron/dev). */

const {
  msc_createPersistentStore,
  msc_getPersistentStore,
} = require('./persistent-store');

/** @deprecated Use msc_createPersistentStore; kept for existing main.js imports */
function msc_createDatabase() {
  return msc_createPersistentStore();
}

/** Returns SqlitePersistence or JsonPersistence (same method surface). */
function msc_getDatabase() {
  return msc_getPersistentStore();
}

module.exports = {
  msc_createDatabase,
  msc_getDatabase,
};
