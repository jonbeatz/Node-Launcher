const path = require('path');
const fs = require('fs');

/**
 * @file Path guard — **repo root vs vault**
 *
 * Registry `projects.path` is the **repo root** (spawn cwd, `.env`, optional `package.json`). It must not
 * live under the engine **`media/vault`** tree (per-project attachments / card art). Vault + `vpe-local-data`
 * are rejected here. **`msc_normalizePersistedProjectPath`** enforces the same boundaries on **save** without
 * requiring the folder on disk; **`msc_validateProjectPath`** is stricter for **spawn** (exists + `package.json`).
 */

/**
 * Normalize user-entered Windows paths without breaking drive letters (`D:\\...`).
 * @param {string} raw
 * @internal Exported for tests / tooling; production path guard uses {@link msc_validateProjectPath} only.
 */
function msc_normalizeRawPath(raw) {
  let p = typeof raw === 'string' ? raw.trim() : '';
  if (!p) return '';
  p = path.normalize(p);
  return p;
}

/**
 * Vader Shield: Node equivalent of ABSPATH-style guard — reject invalid / unsafe paths
 * before any spawn or file batch I/O.
 *
 * Registry **Save** (`vpe:save-settings`) uses {@link msc_normalizePersistedProjectPath} (JEDI_MOD_133) — no disk checks.
 */
function msc_validateProjectPath(projectPath) {
  if (typeof projectPath !== 'string' || !projectPath.trim()) {
    throw new Error('VPE: Invalid project path.');
  }
  const cleaned = msc_normalizeRawPath(projectPath);
  const absolutePath = path.isAbsolute(cleaned)
    ? cleaned
    : path.resolve(process.cwd(), cleaned);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(
      [
        `VPE: Folder not found.`,
        `"${absolutePath}" does not exist on disk.`,
        'Use Browse (folder icon) to pick your project root.',
      ].join(' '),
    );
  }

  // JEDI_MOD_33: Reject vault paths as project roots to prevent accidental recursion/deletion
  const { msc_projectVaultRootDir } = require('./vpe-vault-paths');
  try {
    const vaultRoot = path.resolve(msc_projectVaultRootDir());
    if (absolutePath.startsWith(vaultRoot)) {
       throw new Error('VPE: Invalid path. Projects cannot be registered inside the Vault directory.');
    }
  } catch (_) {}

  // JEDI_MOD_33: Protect system-critical paths
  const localData = path.resolve(path.join(process.cwd(), 'vpe-local-data'));
  if (absolutePath.startsWith(localData)) {
    throw new Error('VPE: Invalid path. Projects cannot be registered inside the vpe-local-data directory.');
  }

  const pkg = path.join(absolutePath, 'package.json');
  if (!fs.existsSync(pkg)) {
    throw new Error(
      [
        `VPE: Not a Node project.`,
        `"${absolutePath}" has no package.json.`,
        'Select the repo root folder that contains package.json.',
      ].join(' '),
    );
  }
  return absolutePath;
}

/**
 * JEDI_MOD_132 — Registry save / inspect: same vault and system guards as {@link msc_validateProjectPath},
 * but allow a missing folder or missing `package.json` so settings (name, port, thumbnail, etc.) can persist
 * while the user relinks. **`vpe:save-settings`** uses {@link msc_normalizePersistedProjectPath} instead (JEDI_MOD_133).
 *
 * @param {string} projectPath
 * @returns {{ path: string, hasFullNodeProject: boolean, reclaimWarnings: string[] }}
 */
function msc_validateProjectPathForSave(projectPath) {
  if (typeof projectPath !== 'string' || !projectPath.trim()) {
    throw new Error('VPE: Invalid project path.');
  }
  const cleaned = msc_normalizeRawPath(projectPath);
  const absolutePath = path.isAbsolute(cleaned)
    ? cleaned
    : path.resolve(process.cwd(), cleaned);

  const { msc_projectVaultRootDir } = require('./vpe-vault-paths');
  let vaultRootAbs = null;
  try {
    vaultRootAbs = path.resolve(msc_projectVaultRootDir());
  } catch (_) {
    vaultRootAbs = null;
  }
  if (vaultRootAbs && absolutePath.startsWith(vaultRootAbs)) {
    throw new Error('VPE: Invalid path. Projects cannot be registered inside the Vault directory.');
  }

  const localData = path.resolve(path.join(process.cwd(), 'vpe-local-data'));
  if (absolutePath.startsWith(localData)) {
    throw new Error('VPE: Invalid path. Projects cannot be registered inside the vpe-local-data directory.');
  }

  const reclaimWarnings = [];

  if (!fs.existsSync(absolutePath)) {
    reclaimWarnings.push(
      'Repo folder is not on disk yet — path saved so you can relink later. START stays blocked until this folder exists.',
    );
    return { path: absolutePath, hasFullNodeProject: false, reclaimWarnings };
  }

  let st;
  try {
    st = fs.statSync(absolutePath);
  } catch {
    reclaimWarnings.push(
      'Repo path could not be read — path saved as entered. Fix permissions or relink before START.',
    );
    return { path: absolutePath, hasFullNodeProject: false, reclaimWarnings };
  }
  if (!st.isDirectory()) {
    throw new Error(`VPE: Project path must be a folder. "${absolutePath}" is not a directory.`);
  }

  const pkg = path.join(absolutePath, 'package.json');
  if (!fs.existsSync(pkg)) {
    reclaimWarnings.push(
      'This folder has no package.json yet — settings saved; START stays blocked until package.json exists or you pick another folder.',
    );
    return { path: absolutePath, hasFullNodeProject: false, reclaimWarnings };
  }

  return { path: absolutePath, hasFullNodeProject: true, reclaimWarnings };
}

/**
 * JEDI_MOD_133 — `vpe:save-settings` only: normalize the path string; **no** existence or `package.json` checks.
 * Still blocks vault and `vpe-local-data` so the catalog cannot point into engine internals.
 *
 * @param {string} projectPathRaw
 * @returns {string}
 */
function msc_normalizePersistedProjectPath(projectPathRaw) {
  if (typeof projectPathRaw !== 'string' || !projectPathRaw.trim()) {
    throw new Error('VPE: Invalid project path.');
  }
  const cleaned = msc_normalizeRawPath(projectPathRaw);
  const absolutePath = path.isAbsolute(cleaned)
    ? path.normalize(cleaned)
    : path.normalize(path.resolve(process.cwd(), cleaned));

  const { msc_projectVaultRootDir } = require('./vpe-vault-paths');
  let vaultRootAbs = null;
  try {
    vaultRootAbs = path.resolve(msc_projectVaultRootDir());
  } catch (_) {
    vaultRootAbs = null;
  }
  if (vaultRootAbs) {
    const underVault =
      process.platform === 'win32'
        ? absolutePath.toLowerCase().startsWith(vaultRootAbs.toLowerCase())
        : absolutePath.startsWith(vaultRootAbs);
    if (underVault) {
      throw new Error('VPE: Invalid path. Projects cannot be registered inside the Vault directory.');
    }
  }

  const localData = path.resolve(path.join(process.cwd(), 'vpe-local-data'));
  const underLocal =
    process.platform === 'win32'
      ? absolutePath.toLowerCase().startsWith(localData.toLowerCase())
      : absolutePath.startsWith(localData);
  if (underLocal) {
    throw new Error('VPE: Invalid path. Projects cannot be registered inside the vpe-local-data directory.');
  }
  return absolutePath;
}

/**
 * Registry path probe (no package.json requirement). Used for repair / enrich when the folder was moved or deleted.
 * @param {unknown} projectPathRaw
 * @returns {boolean}
 */
function msc_registryProjectRootExists(projectPathRaw) {
  if (typeof projectPathRaw !== 'string' || !projectPathRaw.trim()) return false;
  const cleaned = msc_normalizeRawPath(projectPathRaw);
  if (!cleaned) return false;
  const absolutePath = path.isAbsolute(cleaned)
    ? cleaned
    : path.resolve(process.cwd(), cleaned);
  try {
    return fs.existsSync(absolutePath) && fs.statSync(absolutePath).isDirectory();
  } catch {
    return false;
  }
}

/**
 * JEDI_MOD_134: relaxed script detection (no throw when package.json is missing) lives in
 * `src/main/project-detection.js` (`msc_detectProjectScripts`) — not in this module (avoid require cycles).
 */

module.exports = {
  msc_validateProjectPath,
  msc_validateProjectPathForSave,
  msc_normalizePersistedProjectPath,
  msc_normalizeRawPath,
  msc_registryProjectRootExists,
};
