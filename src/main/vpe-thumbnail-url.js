'use strict';

/**
 * v1.7.6 — Map Omni-Vault internal `_vpe_thumb.png` to `vpe-vault://` for the renderer (avoids
 * Chromium blocking `file:` from `http://localhost` in dev). Persistence stays `file:` hrefs.
 * v1.7.8 — `?pulse=` cache-busting (mtime + explicit bumps on pick / save).
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL, fileURLToPath } = require('node:url');
const {
  VPE_VAULT_INTERNAL_THUMB,
  msc_projectVaultSovereignInternalThumbAbs,
} = require('./vpe-vault-paths');

function msc_normalizeResolvedPath(p) {
  try {
    return path.normalize(path.resolve(p));
  } catch (_) {
    return '';
  }
}

/** Last explicit pulse per project (pick / save); combined with on-disk mtime for stable busting. */
const msc_vaultThumbExplicitPulseById = new Map();

function msc_bumpVaultThumbPulse(projectId, ts = Date.now()) {
  const id = projectId != null ? String(projectId).trim() : '';
  if (!id) return;
  const n = Number(ts);
  msc_vaultThumbExplicitPulseById.set(id, Number.isFinite(n) ? n : Date.now());
}

function msc_internalVaultThumbAbsForRow(row) {
  if (!row?.name) return '';
  return msc_normalizeResolvedPath(
    msc_projectVaultSovereignInternalThumbAbs(String(row.name), row.id),
  );
}

function msc_vaultThumbPulseForRow(row) {
  const id = row?.id != null ? String(row.id) : '';
  const abs = msc_internalVaultThumbAbsForRow(row);
  let mtime = 0;
  if (abs && fs.existsSync(abs)) {
    try {
      mtime = fs.statSync(abs).mtimeMs;
    } catch (_) {
      mtime = 0;
    }
  }
  const explicit = id ? msc_vaultThumbExplicitPulseById.get(id) ?? 0 : 0;
  return String(Math.max(mtime, explicit));
}

function msc_thumbnailUrlResolvesToAbsPath(thumbnailUrl) {
  if (!thumbnailUrl || typeof thumbnailUrl !== 'string') return '';
  const s = thumbnailUrl.trim();
  if (!s) return '';
  if (s.startsWith('file:')) {
    try {
      return msc_normalizeResolvedPath(fileURLToPath(s));
    } catch (_) {
      return '';
    }
  }
  if (/^[a-zA-Z][a-zA-Z0-9+\-.]*:/.test(s)) return '';
  if (!path.isAbsolute(s)) return '';
  return msc_normalizeResolvedPath(s);
}

function msc_sameFsPath(a, b) {
  if (!a || !b) return false;
  if (process.platform === 'win32') {
    return String(a).toLowerCase() === String(b).toLowerCase();
  }
  return a === b;
}

/** True if this row's thumbnail is the internal vault PNG (persisted as `file:` or legacy path). */
function msc_rowUsesInternalVaultThumbnail(row) {
  const tu = row?.thumbnail_url;
  if (!tu || typeof tu !== 'string') return false;
  if (tu.startsWith('vpe-vault:')) {
    try {
      const u = new URL(tu);
      if (u.protocol !== 'vpe-vault:') return false;
      const hid = decodeURIComponent(u.hostname || '');
      if (String(row.id || '').toLowerCase() !== hid.toLowerCase()) return false;
      const pn = u.pathname.replace(/\\/g, '/').toLowerCase();
      return pn === `/${VPE_VAULT_INTERNAL_THUMB}`.toLowerCase();
    } catch (_) {
      return false;
    }
  }
  const abs = msc_thumbnailUrlResolvesToAbsPath(tu);
  const vaultPng = msc_internalVaultThumbAbsForRow(row);
  if (!abs || !vaultPng) return false;
  if (!fs.existsSync(vaultPng)) return false;
  return msc_sameFsPath(abs, vaultPng);
}

/**
 * Renderer-facing href for internal vault thumb (`?pulse=`). Pass `pulseOverride` to force a value.
 * @param {Record<string, unknown>} row
 * @param {string | number | null | undefined} pulseOverride
 * @returns {string | null}
 */
function msc_rendererVaultThumbnailHref(row, pulseOverride) {
  if (!row?.id) return row?.thumbnail_url == null ? null : String(row.thumbnail_url);
  if (!msc_rowUsesInternalVaultThumbnail(row)) {
    return row?.thumbnail_url == null ? null : String(row.thumbnail_url);
  }
  const idStr = String(row.id);
  const base = `vpe-vault://${idStr}/${VPE_VAULT_INTERNAL_THUMB}`;
  const pulse =
    pulseOverride != null && String(pulseOverride).trim() !== ''
      ? String(pulseOverride)
      : msc_vaultThumbPulseForRow(row);
  return `${base}?pulse=${encodeURIComponent(pulse)}`;
}

function msc_enrichRowThumbnailForRenderer(row) {
  if (!row || typeof row !== 'object') return row;
  const href = msc_rendererVaultThumbnailHref(row);
  const prev = row.thumbnail_url != null ? String(row.thumbnail_url) : null;
  if (href === prev) return row;
  return { ...row, thumbnail_url: href };
}

/** Map renderer `vpe-vault:` back to `file:` for SQLite (internal thumb only). */
function msc_normalizeThumbnailUrlForPersistence(row, incoming) {
  if (!incoming || typeof incoming !== 'string') return incoming;
  /** Draft modal preview uses `data:image/png;base64,...`; on-disk vault PNG is canonical for SQLite. */
  if (incoming.startsWith('data:')) {
    if (!row?.name) return null;
    const abs = msc_internalVaultThumbAbsForRow(row);
    if (abs && fs.existsSync(abs)) return pathToFileURL(abs).href;
    return null;
  }
  if (!incoming.startsWith('vpe-vault:') || !row?.id) return incoming;
  try {
    const u = new URL(incoming);
    if (u.protocol !== 'vpe-vault:') return incoming;
    const hid = decodeURIComponent(u.hostname || '');
    if (String(row.id).toLowerCase() !== hid.toLowerCase()) return incoming;
    const pn = u.pathname.replace(/\\/g, '/').toLowerCase();
    if (pn !== `/${VPE_VAULT_INTERNAL_THUMB}`.toLowerCase()) return incoming;
    const abs = msc_internalVaultThumbAbsForRow(row);
    if (!abs || !fs.existsSync(abs)) return incoming;
    return pathToFileURL(abs).href;
  } catch (_) {
    return incoming;
  }
}

module.exports = {
  msc_internalVaultThumbAbsForRow,
  msc_rowUsesInternalVaultThumbnail,
  msc_bumpVaultThumbPulse,
  msc_rendererVaultThumbnailHref,
  msc_enrichRowThumbnailForRenderer,
  msc_normalizeThumbnailUrlForPersistence,
};
