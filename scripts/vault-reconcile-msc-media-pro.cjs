'use strict';

/**
 * JEDI_MOD_127 — Global vault reclamation (markers + missing rows).
 * JEDI_MOD_129 — Repo vs vault: never write the media vault into `projects.path` (repo root only).
 * Wrong paths from JEDI_MOD_128 are repaired to a `D:\\Cursor_Projectz\\<displayName>` heuristic.
 * JEDI_MOD_131 — After repair, scan `VPE_REPO_SCAN_ROOT` for folders with `package.json` and
 * realign `projects.path` when the catalog name matches (exact, then conservative fuzzy).
 *
 * Legacy: still aligns `MSC_MEDIA_PRO_V2` display name when path heuristics match (see end).
 *
 * Run (better-sqlite3 ABI via Electron):
 *   npm run vault:reconcile-msc
 *   npm run vault:reconcile-msc -- --debug
 *
 * Optional:
 *   cross-env ELECTRON_RUN_AS_NODE=1 electron scripts/vault-reconcile-msc-media-pro.cjs -- --db="C:\\path\\vader.sqlite"
 *   VPE_VAULT_ROOT=... overrides vault root (default sovereign: Node-Launcher-v2 on Windows)
 *   VPE_REPO_SCAN_ROOT=... overrides repo discovery root (default: D:\\Cursor_Projectz on Windows, else parent of cwd)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const { randomUUID } = require('crypto');
const { pathToFileURL } = require('node:url');

const CANON_FOLDER = 'MSC_MEDIA_PRO_V2';
const VPE_VAULT_KEEP_FILE = '.vpe_keep';
const VPE_VAULT_INTERNAL_THUMB = '_vpe_thumb.png';
const VPE_KEEP_BODY =
  'VPE vault placeholder - keeps empty project folders materialized. Do not delete.\n';

function safeVaultFolderName(name) {
  const raw = String(name || 'project')
    .replace(/[<>:"/\\|?*\x00-\x1f]+/g, '_')
    .trim();
  const s = raw.replace(/^\.+/, '').replace(/\.+$/, '') || 'project';
  return s.slice(0, 120);
}

/** Same default as `msc_projectVaultRootDirSovereign()` (vpe-vault-paths). */
function sovereignVaultRoot() {
  const env = process.env.VPE_VAULT_ROOT;
  if (env && String(env).trim()) return path.resolve(String(env).trim());
  if (process.platform === 'win32') {
    return path.resolve('d:/Cursor_Projectz/Node-Launcher-v2/media/vault');
  }
  return path.join(process.cwd(), 'media', 'vault');
}

function parseDebugFlag() {
  return process.argv.includes('--debug') || process.argv.includes('--deep');
}

function vaultDirHasMarker(absDir) {
  try {
    return (
      fs.existsSync(path.join(absDir, VPE_VAULT_KEEP_FILE)) ||
      fs.existsSync(path.join(absDir, VPE_VAULT_INTERNAL_THUMB))
    );
  } catch (_) {
    return false;
  }
}

/** Materialize `.vpe_keep` when folder has neither keep nor internal thumb. */
function ensureVaultLeafMarkers(absDir, debug) {
  if (!fs.existsSync(absDir) || !fs.statSync(absDir).isDirectory()) return;
  if (vaultDirHasMarker(absDir)) {
    if (debug) {
      console.log(
        '[vault-reconcile] Marker OK (',
        VPE_VAULT_KEEP_FILE,
        'or',
        VPE_VAULT_INTERNAL_THUMB,
        '):',
        absDir,
      );
    }
    return;
  }
  const keepPath = path.join(absDir, VPE_VAULT_KEEP_FILE);
  fs.writeFileSync(keepPath, VPE_KEEP_BODY, 'utf8');
  if (process.platform === 'win32') {
    try {
      execFileSync('attrib', ['+h', keepPath], { windowsHide: true, stdio: 'ignore' });
    } catch (_) {
      /* */
    }
  }
  console.log('[vault-reconcile] Created missing vault marker:', keepPath);
}

/** Basenames of non-hidden directories under the vault root (global scan). */
function listVaultLeafFolders(vaultRoot) {
  if (!fs.existsSync(vaultRoot)) return [];
  let entries;
  try {
    entries = fs.readdirSync(vaultRoot, { withFileTypes: true });
  } catch (_) {
    return [];
  }
  const out = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const name = e.name;
    if (!name || name.startsWith('.')) continue;
    out.push(name);
  }
  return out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
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

/** Heuristic repo root (NOT the media vault). User should browse if this folder does not exist. */
function defaultReclaimRepoPath(displayName) {
  const leaf = String(displayName || 'project').trim() || 'project';
  if (process.platform === 'win32') {
    return path.normalize(path.join('D:', 'Cursor_Projectz', leaf));
  }
  return path.normalize(path.join(process.cwd(), leaf));
}

/** True when `childPath` is the vault root or a directory under it. */
function isPathUnderVaultRoot(childPath, vaultRoot) {
  try {
    const c = path.resolve(childPath);
    const v = path.resolve(vaultRoot);
    const rel = path.relative(v, c);
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
  } catch (_) {
    return false;
  }
}

/**
 * JEDI_MOD_129 — If `path` was mistakenly set to a folder inside the vault tree, reset to repo heuristic.
 */
function repairVaultMisassignedRepoPaths(db, vaultRoot, debug) {
  const rows = db.prepare('SELECT id, name, path FROM projects').all();
  const stmt = db.prepare('UPDATE projects SET path = ? WHERE id = ?');
  for (const r of rows) {
    const p = String(r.path || '');
    if (!p || !isPathUnderVaultRoot(p, vaultRoot)) continue;
    const next = defaultReclaimRepoPath(r.name);
    if (next === path.normalize(p)) continue;
    stmt.run(next, r.id);
    console.log('[vault-reconcile] Repaired repo path (was vault):', r.name, '→', next);
  }
  if (debug) {
    console.log('[vault-reconcile] Repo/vault repair pass complete (paths must contain package.json for START).');
  }
}

/** Lowercase alphanumeric only — comparable across `_`, `-`, spaces. */
function msc_normalizeKey(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function pathHasPackageJson(absDir) {
  try {
    return fs.existsSync(path.join(absDir, 'package.json'));
  } catch (_) {
    return false;
  }
}

function needsRepoRealign(absPathRaw) {
  const p = String(absPathRaw || '').trim();
  if (!p) return true;
  try {
    const abs = path.resolve(p);
    if (!fs.existsSync(abs)) return true;
    if (!fs.statSync(abs).isDirectory()) return true;
    return !pathHasPackageJson(abs);
  } catch (_) {
    return true;
  }
}

/** Workspace parent for repos (not the vault). */
function repoScanRoot() {
  const env = process.env.VPE_REPO_SCAN_ROOT;
  if (env && String(env).trim()) return path.resolve(String(env).trim());
  if (process.platform === 'win32') {
    return path.normalize(path.join('D:', 'Cursor_Projectz'));
  }
  return path.normalize(path.join(process.cwd(), '..'));
}

/**
 * Direct child directories of `scanRoot` that contain `package.json`, excluding anything under `vaultRoot`.
 */
function scanRepoCandidates(scanRoot, vaultRoot) {
  const out = [];
  if (!fs.existsSync(scanRoot)) return out;
  let entries;
  try {
    entries = fs.readdirSync(scanRoot, { withFileTypes: true });
  } catch (_) {
    return [];
  }
  for (const e of entries) {
    if (!e.isDirectory() || e.name.startsWith('.')) continue;
    const full = path.join(scanRoot, e.name);
    if (isPathUnderVaultRoot(full, vaultRoot)) continue;
    try {
      if (!fs.statSync(full).isDirectory()) continue;
    } catch (_) {
      continue;
    }
    if (!pathHasPackageJson(full)) continue;
    out.push(full);
  }
  return out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

function absNormKey(p) {
  try {
    return path.normalize(path.resolve(String(p || ''))).toLowerCase();
  } catch (_) {
    return '';
  }
}

/**
 * JEDI_MOD_131 — Point `projects.path` at a real repo when the catalog name matches a scan folder.
 * Each candidate folder is used at most once (avoids two cards stealing the same repo).
 */
function realignRepoPathsFromScan(db, scanRoot, vaultRoot, debug) {
  const candidates = scanRepoCandidates(scanRoot, vaultRoot);
  if (debug) {
    console.log('[vault-reconcile] JEDI_MOD_131 repo scan root:', scanRoot);
    console.log(
      '[vault-reconcile] JEDI_MOD_131:',
      candidates.length,
      'folder(s) with package.json (direct children of scan root)',
    );
  }
  const used = new Set();
  const stmt = db.prepare('UPDATE projects SET path = ? WHERE id = ?');

  function findExact(projectName) {
    const needle = msc_normalizeKey(projectName);
    if (!needle) return null;
    const hits = [];
    for (const c of candidates) {
      if (used.has(absNormKey(c))) continue;
      if (msc_normalizeKey(path.basename(c)) === needle) hits.push(c);
    }
    if (hits.length === 0) return null;
    hits.sort((a, b) => a.length - b.length);
    if (hits.length > 1 && debug) {
      console.log('[vault-reconcile] Multiple exact key hits for', projectName, '— picking shortest path.');
    }
    return hits[0];
  }

  function fuzzyScore(needle, base) {
    if (base.length < 6 || needle.length < 6) return 0;
    if (needle.includes(base)) return base.length;
    if (base.includes(needle)) return needle.length;
    return 0;
  }

  function findFuzzy(projectName) {
    const needle = msc_normalizeKey(projectName);
    if (!needle) return null;
    let best = null;
    let bestScore = 0;
    for (const c of candidates) {
      if (used.has(absNormKey(c))) continue;
      const base = msc_normalizeKey(path.basename(c));
      const sc = fuzzyScore(needle, base);
      if (sc > bestScore) {
        bestScore = sc;
        best = c;
      }
    }
    if (!best || bestScore < 6) return null;
    const ties = candidates.filter((c) => {
      if (used.has(absNormKey(c))) return false;
      const base = msc_normalizeKey(path.basename(c));
      return fuzzyScore(needle, base) === bestScore;
    });
    if (ties.length > 1) {
      if (debug) {
        console.log(
          '[vault-reconcile] Ambiguous fuzzy repo match, skipping:',
          projectName,
          ties.map((t) => path.basename(t)),
        );
      }
      return null;
    }
    return best;
  }

  let rows = db.prepare('SELECT id, name, path FROM projects').all();
  for (const r of rows) {
    if (!needsRepoRealign(r.path)) continue;
    const hit = findExact(r.name);
    if (!hit) continue;
    const next = path.normalize(hit);
    if (path.normalize(String(r.path || '')) === next) continue;
    stmt.run(next, r.id);
    used.add(absNormKey(next));
    console.log('[vault-reconcile] Repo path realigned (exact key):', r.name, '→', next);
  }

  rows = db.prepare('SELECT id, name, path FROM projects').all();
  for (const r of rows) {
    if (!needsRepoRealign(r.path)) continue;
    const hit = findFuzzy(r.name);
    if (!hit) {
      if (debug) console.log('[vault-reconcile] No discovered repo for:', r.name);
      continue;
    }
    const next = path.normalize(hit);
    if (path.normalize(String(r.path || '')) === next) continue;
    stmt.run(next, r.id);
    used.add(absNormKey(next));
    console.log('[vault-reconcile] Repo path realigned (fuzzy key):', r.name, '→', next);
  }
}

/**
 * New vault leaf → initial `projects.path`: match an on-disk repo under the scan root, or null.
 * Marks chosen candidates in `usedAbsKeys` so multiple inserts do not map to the same repo.
 * @param {string} folderName
 * @param {string[]} candidates
 * @param {Set<string>} usedAbsKeys
 * @returns {string|null}
 */
function discoverRepoPathForInsert(folderName, candidates, usedAbsKeys) {
  const needle = msc_normalizeKey(folderName);
  if (!needle) return null;

  const exactHits = [];
  for (const c of candidates) {
    if (usedAbsKeys.has(absNormKey(c))) continue;
    if (msc_normalizeKey(path.basename(c)) === needle) exactHits.push(c);
  }
  if (exactHits.length > 0) {
    exactHits.sort((a, b) => a.length - b.length);
    const pick = exactHits[0];
    usedAbsKeys.add(absNormKey(pick));
    return path.normalize(pick);
  }

  let best = null;
  let bestScore = 0;
  for (const c of candidates) {
    if (usedAbsKeys.has(absNormKey(c))) continue;
    const base = msc_normalizeKey(path.basename(c));
    if (base.length < 6 || needle.length < 6) continue;
    let score = 0;
    if (needle.includes(base)) score = base.length;
    else if (base.includes(needle)) score = needle.length;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  if (!best || bestScore < 6) return null;

  const ties = candidates.filter((c) => {
    if (usedAbsKeys.has(absNormKey(c))) return false;
    const base = msc_normalizeKey(path.basename(c));
    if (base.length < 6 || needle.length < 6) return false;
    const sc = needle.includes(base) ? base.length : base.includes(needle) ? needle.length : 0;
    return sc === bestScore;
  });
  if (ties.length > 1) return null;

  usedAbsKeys.add(absNormKey(best));
  return path.normalize(best);
}

function nextRegistryPort(db) {
  const row = db.prepare(`SELECT COALESCE(MAX(port), 3000) AS m FROM projects`).get();
  const base = Math.max(3001, Number(row?.m) || 3000);
  return base + 1;
}

function main() {
  const BetterSqlite3 = require('better-sqlite3');
  const debug = parseDebugFlag();
  const dbPath = parseDbArg();
  const vaultRoot = sovereignVaultRoot();

  console.log('[vault-reconcile] DB:', dbPath);
  console.log('[vault-reconcile] Vault root (sovereign):', vaultRoot);

  if (!fs.existsSync(dbPath)) {
    console.error('[vault-reconcile] SQLite not found. Use --db=C:\\path\\vader.sqlite');
    process.exitCode = 1;
    return;
  }

  if (!fs.existsSync(vaultRoot)) {
    console.log('[vault-reconcile] Skipping folder (vault root missing):', vaultRoot);
    return;
  }

  const db = new BetterSqlite3(dbPath);
  /** @type {{ id: string, name: string, path: string }[]} */
  let rows = db.prepare('SELECT id, name, path FROM projects').all();

  const scanRoot = repoScanRoot();
  const repoCandidates = scanRepoCandidates(scanRoot, vaultRoot);

  const leaves = listVaultLeafFolders(vaultRoot);
  if (debug) {
    console.log('[vault-reconcile] --debug: global scan,', leaves.length, 'folder(s) under', vaultRoot);
  }

  let nextPort = nextRegistryPort(db);
  const insertSql = `
    INSERT INTO projects (id, name, path, port, status, thumbnail_url, start_script, build_script, pkg_manager, project_type, is_archived, notes, watchdog_enabled, sort_order, display_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const insertStmt = db.prepare(insertSql);

  const usedCandidateKeys = new Set();

  for (const folderName of leaves) {
    const full = path.join(vaultRoot, folderName);
    if (debug) console.log('[vault-reconcile] Found path:', full);

    ensureVaultLeafMarkers(full, debug);

    const leafKey = safeVaultFolderName(folderName);
    const matches = rows.filter((r) => safeVaultFolderName(r.name) === leafKey);

    if (matches.length > 0) {
      continue;
    }

    const id = randomUUID();
    const name = folderName;
    const discovered =
      discoverRepoPathForInsert(folderName, repoCandidates, usedCandidateKeys) ??
      defaultReclaimRepoPath(folderName);
    const projectPath = discovered;
    const thumbAbs = path.join(full, VPE_VAULT_INTERNAL_THUMB);
    const thumbnailUrl = fs.existsSync(thumbAbs) ? pathToFileURL(thumbAbs).href : null;

    const mx = db
      .prepare(`SELECT COALESCE(MAX(sort_order), 0) AS ms, COALESCE(MAX(display_order), 0) AS md FROM projects`)
      .get();
    const ord = Math.max(Number(mx?.ms) || 0, Number(mx?.md) || 0, 0) + 1;

    insertStmt.run(
      id,
      name,
      projectPath,
      nextPort,
      'stopped',
      thumbnailUrl,
      'dev',
      'build',
      'npm',
      null,
      0,
      'VPE global vault reconcile — set Repo Root in Settings to the folder that contains package.json.',
      1,
      ord,
      ord,
    );
    nextPort += 1;

    console.log('[vault-reconcile] Registering NEW project:', name);
    rows.push({ id, name, path: projectPath });
  }

  repairVaultMisassignedRepoPaths(db, vaultRoot, debug);
  realignRepoPathsFromScan(db, scanRoot, vaultRoot, debug);
  rows = db.prepare('SELECT id, name, path FROM projects').all();

  // Legacy single-project alignment: MSC_MEDIA_PRO_V2 name from path / fuzzy heuristics
  let candidates = rows.filter((r) => pathSuggestsCanon(r.path));
  if (candidates.length === 0) {
    const fuzzy = rows.filter((r) => nameSuggestsMscMediaPro(r.name));
    if (fuzzy.length === 1) {
      candidates = fuzzy;
      console.log('[vault-reconcile] Using single name-heuristic match (no path token).');
    }
  }
  const canonDir = path.join(vaultRoot, CANON_FOLDER);
  const toFix =
    fs.existsSync(canonDir) && candidates.length
      ? candidates.filter((r) => safeVaultFolderName(r.name) !== CANON_FOLDER)
      : [];

  if (toFix.length > 0) {
    const upd = db.prepare('UPDATE projects SET name = ? WHERE id = ?');
    for (const r of toFix) {
      const prev = r.name;
      upd.run(CANON_FOLDER, r.id);
      console.log('[vault-reconcile] Updated', r.id, JSON.stringify(prev), '→', CANON_FOLDER);
    }
  } else if (debug && candidates.length === 0) {
    console.log('[vault-reconcile] MSC_MEDIA_PRO_V2 name alignment: no matching rows (ok).');
  }

  db.close();
  console.log('[vault-reconcile] Done. Restart VPE (`npm run vader:dev`) to refresh the dashboard.');
}

main();
