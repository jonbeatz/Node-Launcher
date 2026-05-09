/**
 * v1.6.0 — PM2 programmatic client must load from `app.asar.unpacked` when packaged;
 * `require('pm2')` from code inside `app.asar` does not resolve to unpacked `node_modules`.
 */
const path = require('path');
const fs = require('fs');

/** Cached PM2 API object (connect / stop / start / …). */
let msc_pm2Singleton = null;

/** @returns {object} pm2 module exports */
function msc_getPm2() {
  if (msc_pm2Singleton) return msc_pm2Singleton;

  let app;
  try {
    app = require('electron').app;
  } catch (_) {
    app = null;
  }

  if (app && app.isPackaged === true) {
    const root = path.join(
      process.resourcesPath,
      'app.asar.unpacked',
      'node_modules',
      'pm2',
    );
    const indexJs = path.join(root, 'index.js');
    try {
      if (fs.existsSync(indexJs)) {
        msc_pm2Singleton = require(indexJs);
        return msc_pm2Singleton;
      }
    } catch (e) {
      console.warn('[VPE] PM2 packaged load (index.js) failed:', e?.message ?? e);
    }
    try {
      if (fs.existsSync(path.join(root, 'package.json'))) {
        msc_pm2Singleton = require(root);
        return msc_pm2Singleton;
      }
    } catch (e) {
      console.warn('[VPE] PM2 packaged load (package root) failed:', e?.message ?? e);
    }
    console.error('[VPE] Packaged PM2 not found under', root);
  }

  msc_pm2Singleton = require('pm2');
  return msc_pm2Singleton;
}

module.exports = { msc_getPm2 };
