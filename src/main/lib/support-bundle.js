'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { msc_redactUserPaths } = require('./logger');

/**
 * Deep-copy values, redacting every string leaf with `msc_redactUserPaths`.
 * @param {unknown} v
 * @returns {unknown}
 */
function msc_redactDeep(v) {
  if (v == null) return v;
  if (typeof v === 'string') return msc_redactUserPaths(v);
  if (Array.isArray(v)) return v.map(msc_redactDeep);
  if (typeof v === 'object') {
    const o = {};
    for (const [k, val] of Object.entries(v)) {
      o[k] = msc_redactDeep(val);
    }
    return o;
  }
  return v;
}

/**
 * @param {{ app: import('electron').App; store: unknown; pm2Manager?: import('../pm2-manager') | null }} opts
 * @returns {Promise<{ ok: boolean; path?: string; error?: string }>}
 */
async function msc_generateSupportBundle(opts) {
  const { app, store, pm2Manager } = opts;
  if (!app || typeof app.getPath !== 'function') {
    return { ok: false, error: 'VPE: Invalid app instance.' };
  }

  let pkgVersion = 'unknown';
  try {
    const pkgPath = path.join(__dirname, '..', '..', '..', 'package.json');
    const raw = fs.readFileSync(pkgPath, 'utf8');
    const j = JSON.parse(raw);
    if (j && typeof j.version === 'string') pkgVersion = j.version;
  } catch (_) {
    /* */
  }

  let unifiedLogs = [];
  try {
    if (store && typeof store.logsRecentAll === 'function') {
      unifiedLogs = store.logsRecentAll(100);
    }
  } catch (_) {
    unifiedLogs = [];
  }

  let pm2Snapshot = { ok: false, note: 'pm2_manager_unavailable' };
  try {
    if (
      pm2Manager &&
      typeof pm2Manager.msc_listProcessesForSupport === 'function'
    ) {
      pm2Snapshot = await pm2Manager.msc_listProcessesForSupport();
    }
  } catch (e) {
    pm2Snapshot = {
      ok: false,
      error: e && typeof e === 'object' && 'message' in e ? String(e.message) : String(e),
    };
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    vpeVersion: pkgVersion,
    system: {
      platform: process.platform,
      osRelease: os.release(),
      osArch: os.arch(),
      hostname: os.hostname(),
    },
    runtime: {
      node: process.version,
      electron: process.versions.electron || null,
      chrome: process.versions.chrome || null,
    },
    appPaths: {
      userData: app.getPath('userData'),
      logs: typeof app.getPath === 'function' ? app.getPath('logs') : '',
    },
    unifiedLogsLast100: unifiedLogs,
    pm2: pm2Snapshot,
  };

  const safe = msc_redactDeep(payload);
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const desktop = app.getPath('desktop');
  const fileName = `VPE-Support-Bundle-${ts}.json`;
  const outPath = path.join(desktop, fileName);

  try {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(safe, null, 2), 'utf8');
    return { ok: true, path: outPath };
  } catch (err) {
    const m =
      err && typeof err === 'object' && 'message' in err ? String(err.message) : String(err);
    return { ok: false, error: msc_redactUserPaths(m) };
  }
}

module.exports = {
  msc_generateSupportBundle,
  msc_redactDeep,
};
