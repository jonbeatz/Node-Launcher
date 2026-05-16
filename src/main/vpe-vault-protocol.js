'use strict';

/**
 * v1.7.6 — Privileged `vpe-vault:` protocol; serves `media/vault/<project>/_vpe_thumb.png` by registry id.
 * JEDI_MOD_125 — Sovereign Windows root `Node-Launcher-v3/media/vault`, explicit `image/png` Response, legacy fallback.
 */

const { protocol, session } = require('electron');
const fs = require('fs');
const path = require('path');
const {
  VPE_VAULT_INTERNAL_THUMB,
  msc_projectVaultProjectDir,
  msc_projectVaultRootDir,
  msc_projectVaultRootDirSovereign,
  msc_projectVaultSovereignInternalThumbAbs,
} = require('./vpe-vault-paths');

/** True if `absFile` is the same as `rootDir` or a path strictly under it (no `..` escape). */
function msc_vaultProtocolAbsUnderRoot(absFile, rootDir) {
  const abs = path.resolve(absFile);
  const root = path.resolve(rootDir);
  const rel = path.relative(root, abs);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return false;
  return true;
}

function msc_registerVpeVaultPrivilegedScheme() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'vpe-vault',
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
      },
    },
  ]);
}

/** Register `vpe-vault:` handler; `getStore` must return the persistence API (`getProject`, `listProjectsAlphabetical`). */
function msc_registerVpeVaultProtocolHandler(getStore) {
  session.defaultSession.protocol.handle('vpe-vault', async (request) => {
    const fail = () =>
      new Response('', {
        status: 404,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    try {
      const u = new URL(request.url);
      if (u.protocol !== 'vpe-vault:') return fail();
      const rawHost = decodeURIComponent(u.hostname || '');
      const store = getStore();
      let row =
        typeof store.getProject === 'function' ? store.getProject(rawHost) : null;
      if (!row && rawHost) {
        const want = rawHost.toLowerCase();
        const rows =
          typeof store.listProjectsAlphabetical === 'function'
            ? store.listProjectsAlphabetical()
            : typeof store.getProjects === 'function'
              ? store.getProjects()
              : [];
        row = rows.find((p) => p && String(p.id).toLowerCase() === want) || null;
      }
      if (!row) return fail();
      // Path only — `?pulse=…` and other query params are ignored for disk lookup (cache-bust).
      const pn = u.pathname.replace(/\\/g, '/').toLowerCase();
      if (pn !== `/${VPE_VAULT_INTERNAL_THUMB}`.toLowerCase()) return fail();

      const sovereignRoot = path.resolve(msc_projectVaultRootDirSovereign());
      let abs = path.resolve(msc_projectVaultSovereignInternalThumbAbs(row.name, row.id));
      if (!msc_vaultProtocolAbsUnderRoot(abs, sovereignRoot)) return fail();

      if (!fs.existsSync(abs)) {
        const legacyRoot = path.resolve(msc_projectVaultRootDir());
        const legacyDir = path.resolve(msc_projectVaultProjectDir(row.name, row.id));
        const legacyAbs = path.resolve(path.join(legacyDir, VPE_VAULT_INTERNAL_THUMB));
        if (
          msc_vaultProtocolAbsUnderRoot(legacyAbs, legacyRoot) &&
          fs.existsSync(legacyAbs)
        ) {
          abs = legacyAbs;
        } else {
          return fail();
        }
      }

      const body = fs.readFileSync(abs);
      return new Response(body, {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'no-store, max-age=0',
        },
      });
    } catch (e) {
      console.warn('[VPE]', 'vpe-vault protocol handler', e?.message ?? e);
      return fail();
    }
  });
  console.log('[VPE]', 'vpe-vault protocol handler registered (standard + secure)');
}

module.exports = {
  msc_registerVpeVaultPrivilegedScheme,
  msc_registerVpeVaultProtocolHandler,
};
