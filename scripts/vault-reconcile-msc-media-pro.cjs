'use strict';

/**
 * One-off / diagnostic: align registry `projects.name` with vault folder `MSC_MEDIA_PRO_V2`
 * when the codebase path clearly references that project but the display name drifted
 * (spaces vs underscores), so `msc_safeVaultFolderName(name)` no longer matches disk.
 *
 * Run (matches better-sqlite3 ABI with Electron):
 *   npm run vault:reconcile-msc
 *
 * Optional:
 *   cross-env ELECTRON_RUN_AS_NODE=1 electron scripts/vault-reconcile-msc-media-pro.cjs -- --db="C:\\path\\vader.sqlite"
 *   set VPE_VAULT_ROOT=... to override vault root check
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const CANON_FOLDER = 'MSC_MEDIA_PRO_V2';

function safeVaultFolderName(name) {
  const raw = String(name || 'project')
    .replace(/[<>:"/\\|?*\x00-\x1f]+/g, '_')
    .trim();
  const s = raw.replace(/^\.+/, '').replace(/\.+$/, '') || 'project';
  return s.slice(0, 120);
}

function defaultVaultRoot() {
  const env = process.env.VPE_VAULT_ROOT;
  if (env && String(env).trim()) return path.resolve(String(env).trim());
  if (process.platform === 'win32') {
    return path.join('d:', 'Cursor_Projectz', 'Node-Launcher', 'media', 'vault');
  }
  return path.join(process.cwd(), 'media', 'vault');
}

function parseDbArg() {
  const hit = process.argv.find((a) => a.startsWith('--db='));
  if (hit) return path.resolve(hit.slice('--db='.length));
  const fromRepo = path.join(process.cwd(), 'data', 'vader.sqlite');
  if (fs.existsSync(fromRepo)) return fromRepo;
  if (process.platform === 'win32') {
    return path.join(
      os.homedir(),
      'AppData',
      'Roaming',
      'vader-project-engine',
      'vpe-db',
      'vader.sqlite',
    );
  }
  return path.join(os.homedir(), '.config', 'vader-project-engine', 'vpe-db', 'vader.sqlite');
}

function pathSuggestsCanon(p) {
  return String(p || '')
    .toLowerCase()
    .replace(/\\/g, '/')
    .includes('msc_media_pro_v2');
}

function nameSuggestsMscMediaPro(name) {
  const compact = String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return compact.includes('msc_media_pro');
}

function main() {
  const BetterSqlite3 = require('better-sqlite3');
  const dbPath = parseDbArg();
  const vaultRoot = defaultVaultRoot();
  const targetDir = path.join(vaultRoot, CANON_FOLDER);

  console.log('[vault-reconcile] DB:', dbPath);
  console.log('[vault-reconcile] Vault root:', vaultRoot);
  console.log('[vault-reconcile] Folder:', targetDir);

  if (!fs.existsSync(dbPath)) {
    console.error('[vault-reconcile] SQLite not found. Use --db=C:\\path\\vader.sqlite');
    process.exitCode = 1;
    return;
  }
  if (!fs.existsSync(targetDir)) {
    console.log('[vault-reconcile] No', CANON_FOLDER, 'folder at vault root — exit.');
    return;
  }

  const db = new BetterSqlite3(dbPath);
  const rows = db.prepare('SELECT id, name, path FROM projects').all();

  let candidates = rows.filter((r) => pathSuggestsCanon(r.path));
  if (candidates.length === 0) {
    const fuzzy = rows.filter((r) => nameSuggestsMscMediaPro(r.name));
    if (fuzzy.length === 1) {
      candidates = fuzzy;
      console.log('[vault-reconcile] Using single name-heuristic match (no path token).');
    }
  }

  const toFix = candidates.filter((r) => safeVaultFolderName(r.name) !== CANON_FOLDER);

  if (toFix.length === 0) {
    console.log('[vault-reconcile] Nothing to update (already aligned or no matching row).');
    db.close();
    return;
  }

  const upd = db.prepare('UPDATE projects SET name = ? WHERE id = ?');
  for (const r of toFix) {
    const prev = r.name;
    upd.run(CANON_FOLDER, r.id);
    console.log('[vault-reconcile] Updated', r.id, JSON.stringify(prev), '→', CANON_FOLDER);
  }
  db.close();
  console.log('[vault-reconcile] Done. Restart VPE to refresh the dashboard.');
}

main();
