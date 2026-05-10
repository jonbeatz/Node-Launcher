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

/** Sanitized single path segment for vault folder name (registry `name`). */
function msc_safeVaultFolderName(name) {
  const raw = String(name || 'project')
    .replace(/[<>:"/\\|?*\x00-\x1f]+/g, '_')
    .trim();
  const s = raw.replace(/^\.+/, '').replace(/\.+$/, '') || 'project';
  return s.slice(0, 120);
}

/** Default: `d:\\Cursor_Projectz\\Node-Launcher\\media\\vault` (Windows); else `cwd/media/vault`. */
function msc_projectVaultRootDir() {
  const env = process.env.VPE_VAULT_ROOT;
  if (env && String(env).trim()) {
    return path.resolve(String(env).trim());
  }
  if (process.platform === 'win32') {
    return path.join('d:', 'Cursor_Projectz', 'Node-Launcher', 'media', 'vault');
  }
  return path.join(process.cwd(), 'media', 'vault');
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

/** Absolute per-project vault directory (creates parent root only when migrating). */
function msc_projectVaultProjectDir(projectName) {
  msc_tryMigrateVaultFromLegacy(projectName);
  return path.join(msc_projectVaultRootDir(), msc_safeVaultFolderName(projectName));
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
      fs.rmSync(newDir, { recursive: true, force: true });
    } catch (e) {
      console.warn('[VPE]', 'vault rename could not clear empty target', e?.message ?? e);
      return;
    }
  }
  fs.renameSync(oldDir, newDir);
}

module.exports = {
  VPE_VAULT_INTERNAL_THUMB,
  VPE_VAULT_KEEP_FILE,
  msc_isVaultKeepFile,
  msc_isVaultInternalThumbBase,
  msc_safeVaultFolderName,
  msc_projectVaultRootDir,
  msc_projectVaultProjectDir,
  msc_vaultRenameProjectFolder,
};
