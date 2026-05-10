'use strict';

const path = require('path');
const fs = require('fs');
const { msc_projectVaultRootDir } = require('./vpe-vault-paths');

/** @returns {Set<string>} */
function msc_vaultGuardRootAbsSet() {
  /** @type {Set<string>} */
  const roots = new Set();
  try {
    roots.add(path.resolve(msc_projectVaultRootDir()));
  } catch (_) {
    /* */
  }
  try {
    roots.add(path.resolve(path.join(process.cwd(), 'media', 'vault')));
  } catch (_) {
    /* */
  }
  if (process.platform === 'win32') {
    const alt = path.join('D:', 'MSC-Projectz', 'Vault');
    try {
      if (fs.existsSync(alt)) roots.add(path.resolve(alt));
    } catch (_) {
      /* */
    }
  }
  return roots;
}

/**
 * @param {string} absTarget
 * @param {Set<string>} roots
 */
function msc_absIsUnderAnyVaultRoot(absTarget, roots) {
  const abs = path.resolve(absTarget);
  for (const r of roots) {
    const root = path.resolve(r);
    const rel = path.relative(root, abs);
    if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) return true;
  }
  return false;
}

/**
 * Write-protect: refuse `fs.rmSync` under configured vault roots unless
 * `global.__vpeVaultHardDeleteActive` (set only around `vpe:delete-project` + vault rename maintenance).
 */
function msc_installVaultDeletionRmGuard() {
  process.env.VPE_VAULT_DELETION_LOCKED = '1';
  if (global.__vpeVaultRmGuardInstalled) return;
  global.__vpeVaultRmGuardInstalled = true;

  const orig = fs.rmSync.bind(fs);
  fs.rmSync = function vpeGuardedRmSync(p, options) {
    if (String(process.env.VPE_VAULT_DELETION_LOCKED || '').trim() !== '1') {
      return orig(p, options);
    }
    if (global.__vpeVaultHardDeleteActive === true) {
      return orig(p, options);
    }
    let target;
    try {
      target = path.resolve(p);
    } catch (_) {
      return orig(p, options);
    }
    const roots = msc_vaultGuardRootAbsSet();
    if (msc_absIsUnderAnyVaultRoot(target, roots)) {
      const err = new Error(
        'VPE: Vault tree deletion is locked — fs.rmSync under media/vault is allowed only during delete-project.',
      );
      err.code = 'VPE_VAULT_RM_LOCKED';
      throw err;
    }
    return orig(p, options);
  };
}

module.exports = { msc_installVaultDeletionRmGuard };
