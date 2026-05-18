'use strict'

/**
 * v1.6.0 — Project reference vault on disk (per-project folder under repo `media/vault`).
 * Override root with `VPE_VAULT_ROOT`. Migrates legacy `userData/media/vault/<name>/` when new folder is empty.
 */

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

/** Internal card thumbnail stored inside each project vault (never mixed with Omni attachments UI). */
const VPE_VAULT_INTERNAL_THUMB = '_vpe_thumb.png';

/** Placeholder so empty project vault dirs stay materialized (hidden on Windows via `attrib +h`). */
const VPE_VAULT_KEEP_FILE = '.vpe_keep';

function msc_isVaultKeepFile(fileName) {
  return String(fileName || '') === VPE_VAULT_KEEP_FILE;
}

function msc_isVaultInternalThumbBase(fileName) {
  const b = String(fileName || '').toLowerCase();
  return (
    b === '_vpe_thumb.png' ||
    b === '_vpe_thumb.jpg' ||
    b === '_vpe_thumb.jpeg'
  );
}

/** OS / Explorer sidecars — never count as user “attachments” (paperclip). */
function msc_isVaultNonUserNoiseFile(fileName) {
  const lower = String(fileName || '').toLowerCase();
  return (
    lower === 'desktop.ini' ||
    lower === 'thumbs.db' ||
    lower === '.ds_store'
  );
}

/** Sanitized single path segment for vault folder name (registry `name`). */
function msc_safeVaultFolderName(name) {
  const raw = String(name || 'project')
    .replace(/[<>:"/\\|?*\x00-\x1f]+/g, '_')
    .trim();
  const s = raw.replace(/^\.+/, '').replace(/\.+$/, '') || 'project';
  return s.slice(0, 120);
}

/**
 * Resolve the application root dynamically so the vault always lives
 * next to whichever directory the app is running from — no hardcoded
 * drive letters or folder names.
 *
 * Priority:
 *   1. `VPE_VAULT_ROOT` env override (explicit operator pin)
 *   2. Packaged binary   → directory that contains the `.exe`
 *   3. Dev / unpacked    → `app.getAppPath()` (repo root)
 *   4. Node / headless   → `process.cwd()` (test runner, migration scripts)
 */
function msc_resolveVaultAppRoot() {
  try {
    const { app } = require('electron');
    if (app && typeof app.isPackaged === 'boolean' && app.isPackaged) {
      return path.dirname(process.execPath);
    }
    if (app && typeof app.getAppPath === 'function') {
      return app.getAppPath();
    }
  } catch {
    /* electron not available in headless context */
  }
  return process.cwd();
}

/** Primary vault root — always relative to the live app root. Overridable via `VPE_VAULT_ROOT`. */
function msc_projectVaultRootDir() {
  const env = process.env.VPE_VAULT_ROOT;
  if (env && String(env).trim()) {
    return path.resolve(String(env).trim());
  }
  return path.join(msc_resolveVaultAppRoot(), 'media', 'vault');
}

/**
 * Sovereign (canonical) vault root — identical strategy, kept as a separate
 * export so callers that specifically want the sovereign path are explicit.
 * Both functions now resolve to the same dynamic root; the distinction is
 * preserved for API compatibility only.
 */
function msc_projectVaultRootDirSovereign() {
  const env = process.env.VPE_VAULT_ROOT;
  if (env && String(env).trim()) {
    return path.resolve(String(env).trim());
  }
  return path.join(msc_resolveVaultAppRoot(), 'media', 'vault');
}

/**
 * Absolute `_vpe_thumb.png` under sovereign root + display-name folder (same layout as atomic thumb writes).
 * @param {string} projectName Registry display name
 * @param {string | null | undefined} [_projectId] Reserved for parity with vault layout helpers
 */
function msc_projectVaultSovereignInternalThumbAbs(projectName, _projectId) {
  void _projectId;
  const leaf = msc_safeVaultFolderName(projectName);
  return path.normalize(
    path.resolve(path.join(msc_projectVaultRootDirSovereign(), leaf, VPE_VAULT_INTERNAL_THUMB)),
  );
}

function msc_legacyUserDataVaultProjectDir(projectName) {
  const leaf = msc_safeVaultFolderName(projectName);
  try {
    if (typeof app?.getPath === 'function') {
      return path.join(app.getPath('userData'), 'media', 'vault', leaf);
    }
  } catch (_) {
    /* */
  }
  return null;
}

function msc_dirHasAnyFile(absDir) {
  if (!absDir || !fs.existsSync(absDir)) return false;
  try {
    return fs.readdirSync(absDir, { withFileTypes: true }).some((e) => e.isFile());
  } catch (_) {
    return false;
  }
}

function msc_isExistingVaultDir(absPath) {
  try {
    return fs.existsSync(absPath) && fs.statSync(absPath).isDirectory();
  } catch (_) {
    return false;
  }
}

/** Reject path-like `projectId` values so `path.join(root, id)` cannot escape the vault root. */
function msc_isSafeVaultIdSegment(projectId) {
  const id = projectId != null ? String(projectId).trim() : '';
  if (!id) return false;
  if (id.includes('..')) return false;
  if (id.includes('/') || id.includes('\\')) return false;
  if (/^[a-zA-Z]:/.test(id)) return false;
  return path.basename(id) === id;
}

function msc_tryMigrateVaultFromLegacy(projectName) {
  const root = msc_projectVaultRootDir();
  const dest = path.join(root, msc_safeVaultFolderName(projectName));
  const legacy = msc_legacyUserDataVaultProjectDir(projectName);
  if (!legacy || !fs.existsSync(legacy)) return;
  if (msc_dirHasAnyFile(dest)) return;
  if (!msc_dirHasAnyFile(legacy)) return;
  fs.mkdirSync(root, { recursive: true });
  try {
    if (!fs.existsSync(dest)) {
      fs.renameSync(legacy, dest);
      return;
    }
    fs.cpSync(legacy, dest, { recursive: true });
    fs.rmSync(legacy, { recursive: true, force: true });
  } catch (e) {
    console.warn('[VPE]', 'vault migrate from userData failed', e?.message ?? e);
  }
}

/**
 * Absolute per-project vault directory (parent root created only during legacy migrate).
 * v2.0.0+: Prefer folder named after sanitized display name; if that directory does not exist,
 * fall back to a directory named exactly `projectId` (stable key when display name drifts).
 * @param {string} projectName Registry display `name`
 * @param {string | null | undefined} [projectId] Registry UUID (optional)
 */
function msc_projectVaultProjectDir(projectName, projectId) {
  msc_tryMigrateVaultFromLegacy(projectName);
  const root = msc_projectVaultRootDir();
  const primary = path.join(root, msc_safeVaultFolderName(projectName));
  if (msc_isExistingVaultDir(primary)) {
    return primary;
  }
  if (msc_isSafeVaultIdSegment(projectId)) {
    const byId = path.join(root, String(projectId).trim());
    if (msc_isExistingVaultDir(byId)) {
      return byId;
    }
  }
  return primary;
}

/**
 * After registry rename: move vault folder to match new display name.
 * @param {string} oldDisplayName
 * @param {string} newDisplayName
 */
function msc_vaultRenameProjectFolder(oldDisplayName, newDisplayName) {
  const oldLeaf = msc_safeVaultFolderName(oldDisplayName);
  const newLeaf = msc_safeVaultFolderName(newDisplayName);
  if (oldLeaf === newLeaf) return;
  const root = msc_projectVaultRootDir();
  fs.mkdirSync(root, { recursive: true });
  const oldDir = path.join(root, oldLeaf);
  const newDir = path.join(root, newLeaf);
  if (!fs.existsSync(oldDir)) return;
  if (fs.existsSync(newDir)) {
    if (msc_dirHasAnyFile(newDir)) {
      console.warn('[VPE]', 'vault rename skipped: target folder already has files', newDir);
      return;
    }
    try {
      global.__vpeVaultHardDeleteActive = true;
      fs.rmSync(newDir, { recursive: true, force: true });
    } catch (e) {
      console.warn('[VPE]', 'vault rename could not clear empty target', e?.message ?? e);
      return;
    } finally {
      global.__vpeVaultHardDeleteActive = false;
    }
  }
  fs.renameSync(oldDir, newDir);
}

module.exports = {
  VPE_VAULT_INTERNAL_THUMB,
  VPE_VAULT_KEEP_FILE,
  msc_isVaultKeepFile,
  msc_isVaultInternalThumbBase,
  msc_isVaultNonUserNoiseFile,
  msc_safeVaultFolderName,
  msc_projectVaultRootDir,
  msc_projectVaultRootDirSovereign,
  msc_projectVaultSovereignInternalThumbAbs,
  msc_isSafeVaultIdSegment,
  msc_projectVaultProjectDir,
  msc_vaultRenameProjectFolder,
};
