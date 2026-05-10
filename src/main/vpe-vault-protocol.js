'use strict';

/**
 * v1.7.6 — Privileged `vpe-vault:` protocol; serves `media/vault/<project>/_vpe_thumb.png` by registry id.
 */

const { protocol, session, net } = require('electron');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('node:url');
const {
  VPE_VAULT_INTERNAL_THUMB,
  msc_projectVaultProjectDir,
} = require('./vpe-vault-paths');

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
      new Response('', { status: 404, headers: { 'Content-Type': 'text/plain' } });
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
      const vaultDir = path.resolve(msc_projectVaultProjectDir(row.name));
      const abs = path.resolve(path.join(vaultDir, VPE_VAULT_INTERNAL_THUMB));
      const rel = path.relative(vaultDir, abs);
      if (rel.startsWith('..') || path.isAbsolute(rel)) return fail();
      if (!fs.existsSync(abs)) return fail();
      return net.fetch(pathToFileURL(abs).href);
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
