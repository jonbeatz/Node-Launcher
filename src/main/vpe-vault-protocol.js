'use strict';

/**
 * v1.7.6 — Privileged `vpe-vault:` protocol; serves `media/vault/<project>/_vpe_thumb.png` by registry id.
 * JEDI_MOD_125 — Sovereign Windows root `Node-Launcher-v2/media/vault`, explicit `image/png` Response, legacy fallback.
 * v2.2.6+ — `vpe-thumb:` protocol: safe file-system passthrough for WordPress theme screenshots.
 */

const { protocol, session } = require('electron');
const fs = require('fs');
const path = require('path');

/** Allowed image MIME types served by vpe-thumb://. */
const VPE_THUMB_MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
};
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
    {
      scheme: 'vpe-thumb',
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

/**
 * `vpe-thumb:` protocol handler — safe passthrough for arbitrary image paths on disk.
 * URL format mirrors file:// but uses vpe-thumb:// so Electron's renderer CSP allows it.
 * e.g. vpe-thumb:///D:/path/to/screenshot.png  (Windows)
 *      vpe-thumb:///home/user/screenshot.png    (POSIX)
 */
function msc_registerVpeThumbProtocolHandler() {
  session.defaultSession.protocol.handle('vpe-thumb', (request) => {
    const fail = (code = 404) =>
      new Response('', { status: code, headers: { 'Content-Type': 'text/plain' } });
    try {
      const u = new URL(request.url);
      // pathname: "/D:/path/to/file.png" on Windows (triple-slash form), "/home/user/file.png" on POSIX
      let pathname = decodeURIComponent(u.pathname);

      // When registered as a standard scheme, Chromium treats the component after "//"
      // as the URL authority (hostname). For Windows paths on non-default drives the URL
      // vpe-thumb:///F:/path becomes vpe-thumb://f/path — "F:" is lowercased to "f" and
      // the colon is stripped (treated as an invalid port separator). Reconstruct the full
      // Windows absolute path by re-attaching the drive letter from u.hostname.
      if (
        process.platform === 'win32' &&
        u.hostname && /^[a-z]$/.test(u.hostname) &&
        !pathname.startsWith('/' + u.hostname.toUpperCase() + ':')
      ) {
        // e.g. hostname="f", pathname="/Websitez/..." → "F:/Websitez/..."
        pathname = u.hostname.toUpperCase() + ':' + pathname;
      } else {
        // Standard triple-slash form: vpe-thumb:///D:/path → pathname="/D:/path"
        // Strip the leading slash only when the next char is a Windows drive letter (e.g. /D:/)
        if (/^\/[A-Za-z]:[\\/]/.test(pathname)) {
          pathname = pathname.slice(1);
        }
      }

      const absFile = path.normalize(pathname);
      // Safety: only serve files with allowed image extensions
      const ext = path.extname(absFile).toLowerCase();
      const mimeType = VPE_THUMB_MIME[ext];
      if (!mimeType) return fail(403);
      if (!fs.existsSync(absFile)) return fail(404);
      const st = fs.statSync(absFile);
      if (!st.isFile()) return fail(404);
      const body = fs.readFileSync(absFile);
      return new Response(body, {
        status: 200,
        headers: {
          'Content-Type': mimeType,
          'Cache-Control': 'no-store, max-age=0',
        },
      });
    } catch (e) {
      console.warn('[VPE] vpe-thumb protocol error:', e?.message ?? e);
      return fail(500);
    }
  });
  console.log('[VPE] vpe-thumb protocol handler registered');
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
  msc_registerVpeThumbProtocolHandler,
};
