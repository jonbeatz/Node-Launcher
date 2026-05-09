'use strict'

const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { msc_projectVaultRootDir } = require('../vpe-vault-paths');

/** @typedef {{ id: string; ok: boolean; detail?: string }} ForgeCheck */

/**
 * Forge validator: SQLite `notes` read/write cycle + vault directory writability.
 * @param {import('../db/persistent-store').SqlitePersistence | Record<string, unknown>} store
 * @returns {{ ok: boolean; checks: ForgeCheck[] }}
 */
function msc_diagUpdatePayload(row, notesValue) {
  const payload = {
    id: row.id,
    name: row.name,
    path: row.path,
    port: row.port,
    thumbnail_url: row.thumbnail_url ?? null,
    start_script: row.start_script,
    build_script: row.build_script,
    pkg_manager: row.pkg_manager,
    notes: notesValue,
  };
  if (Object.prototype.hasOwnProperty.call(row, 'project_type'))
    payload.project_type = row.project_type;
  if (Object.prototype.hasOwnProperty.call(row, 'is_archived'))
    payload.is_archived = row.is_archived === true || row.is_archived === 1;
  return payload;
}

function msc_runForgeDiagnostics(store) {
  /** @type {ForgeCheck[]} */
  const checks = [];

  if (typeof store.listProjectsAlphabetical !== 'function') {
    return { ok: false, checks: [{ id: 'store', ok: false, detail: 'Persistence store unavailable.' }] };
  }

  const rows = store.listProjectsAlphabetical();
  if (!rows.length) {
    checks.push({
      id: 'sqlite_notes',
      ok: true,
      detail: 'No registry projects — SQLite notes column present but not exercised.',
    });
  } else {
    const row = rows[0];
    const id = row.id;
    try {
      const backup = typeof store.getProject === 'function' ? store.getProject(id) : row;
      if (!backup || !backup.id) {
        checks.push({ id: 'sqlite_notes', ok: false, detail: 'Could not load first project.' });
      } else {
        const sentinel = '__VPE_DIAG_NOTES__';
        const prevNotes =
          backup.notes == null || typeof backup.notes === 'undefined' ? null : String(backup.notes);
        store.updateProject(msc_diagUpdatePayload(backup, sentinel));
        const round = store.getProject(id);
        const readOk = round && String(round.notes) === sentinel;
        store.updateProject(
          msc_diagUpdatePayload(backup, prevNotes),
        );
        checks.push({
          id: 'sqlite_notes',
          ok: readOk,
          detail: readOk
            ? 'Notes column round-trip OK on first project.'
            : 'Notes round-trip mismatch after write.',
        });
      }
    } catch (err) {
      checks.push({
        id: 'sqlite_notes',
        ok: false,
        detail: err && typeof err === 'object' && 'message' in err ? String(err.message) : String(err),
      });
    }
  }

  /** Vault permissions under v1.6.0 project vault root (`media/vault` — see `vpe-vault-paths.js`) */
  try {
    const vaultRoot = msc_projectVaultRootDir();
    fs.mkdirSync(vaultRoot, { recursive: true });
    const probe = path.join(vaultRoot, `.vpe_forge_probe_${Date.now()}.tmp`);
    fs.writeFileSync(probe, 'vpe', 'utf8');
    fs.unlinkSync(probe);
    fs.accessSync(vaultRoot, fs.constants.R_OK | fs.constants.W_OK);
    checks.push({
      id: 'vault_fs',
      ok: true,
      detail: 'Project vault root is readable and writable.',
    });
  } catch (err) {
    checks.push({
      id: 'vault_fs',
      ok: false,
      detail:
        err && typeof err === 'object' && 'message' in err ? String(err.message) : String(err),
    });
  }

  const ok = checks.every((c) => c.ok);
  return { ok, checks };
}

module.exports = { msc_runForgeDiagnostics };
