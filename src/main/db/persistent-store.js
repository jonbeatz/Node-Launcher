const fs = require('fs');
const path = require('path');
const { msc_launcherRendererPort } = require('../launcher-port');
const { msc_logWarn } = require('../lib/logger');
const {
  MSC_VPE_APP_SETTINGS_DEFAULTS,
  msc_normalizeAppSettingsRow,
  msc_normalizeDefaultView,
  msc_normalizeFontStyle,
} = require('../settings-defaults');

/** One-time migrate source; cwd file is archived to media/_vpe_archive after boot. */
const LEGACY_REGISTRY = path.join(process.cwd(), 'projects.json');

/** Final `PRAGMA user_version` after `msc_sqliteMigrateSchemaAndPorts` (v2.1.x: `sort_order`, `auto_sync_db_on_close`). */
const VPE_SQLITE_USER_VERSION = 16;

/**
 * Initial DDL before incremental migrations (see `msc_sqliteMigrateSchemaAndPorts`).
 * Kept as one string so tests and `msc_createPersistentStore` share the same source of truth.
 */
const VPE_SQLITE_BASE_DDL = `
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT NOT NULL,
        port INTEGER NOT NULL DEFAULT 3000,
        status TEXT NOT NULL DEFAULT 'stopped' CHECK (status IN ('running', 'stopped')),
        thumbnail_url TEXT,
        start_script TEXT NOT NULL DEFAULT 'dev',
        build_script TEXT NOT NULL DEFAULT 'build',
        pkg_manager TEXT NOT NULL DEFAULT 'npm',
        is_favorite INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        level TEXT NOT NULL CHECK (level IN ('info', 'warn', 'error')),
        message TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_logs_project_id ON logs(project_id);

      CREATE TABLE IF NOT EXISTS repair_runs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        project_name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed')),
        description TEXT NOT NULL,
        files_changed INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_repair_runs_created ON repair_runs(created_at DESC);
    `;

function msc_sqliteApplyBaseSchema(db) {
  db.exec(VPE_SQLITE_BASE_DDL);
}

/**
 * LOGIC_MOD_01 — Sovereign app root for catalog SQLite (not AppData).
 * - Dev / unpacked: `app.getAppPath()/data` (repo or app folder).
 * - Packaged: `path.dirname(process.execPath)/data` (next to the `.exe`; avoids writing inside `app.asar`).
 * - Node / headless: `process.cwd()/data`.
 * @returns {string}
 */
function msc_getSovereignAppRoot() {
  try {
    const { app } = require('electron');
    if (app && typeof app.isPackaged === 'boolean' && app.isPackaged) {
      return path.dirname(process.execPath);
    }
    if (app && typeof app.getAppPath === 'function') {
      return app.getAppPath();
    }
  } catch {
    /* electron not loadable */
  }
  return process.cwd();
}

/**
 * Writable DB directory: `<sovereignRoot>/data` (LOGIC_MOD_01 portability).
 * Falls back to `process.cwd()/data` when Electron is unavailable.
 * @returns {{ storeDir: string, sqlitePath: string, jsonPath: string }}
 */
function msc_getStorePaths() {
  const root = msc_getSovereignAppRoot();
  const storeDir = path.join(root, 'data');
  return {
    storeDir,
    sqlitePath: path.join(storeDir, 'vader.sqlite'),
    jsonPath: path.join(storeDir, 'vader-engine.json'),
  };
}

/** Copy legacy DB into sovereign `data/` from older layouts (userData/vpe-db, then module dir). */
function msc_migrateLegacyDbFiles(paths) {
  /** @type {string | null} */
  let userDataVpeDir = null;
  try {
    const { app } = require('electron');
    if (app && typeof app.getPath === 'function') {
      userDataVpeDir = path.join(app.getPath('userData'), 'vpe-db');
    }
  } catch {
    /* no electron */
  }

  const userDataSqlite = userDataVpeDir ? path.join(userDataVpeDir, 'vader.sqlite') : null;
  const userDataJson = userDataVpeDir ? path.join(userDataVpeDir, 'vader-engine.json') : null;

  try {
    if (
      userDataSqlite &&
      !fs.existsSync(paths.sqlitePath) &&
      fs.existsSync(userDataSqlite)
    ) {
      fs.mkdirSync(paths.storeDir, { recursive: true });
      fs.copyFileSync(userDataSqlite, paths.sqlitePath);
      console.log('VPE: Migrated vader.sqlite from userData/vpe-db to sovereign data/.');
    }
  } catch (e) {
    console.warn('VPE: userData SQLite migration skipped:', e?.message ?? e);
  }
  try {
    if (
      userDataJson &&
      !fs.existsSync(paths.jsonPath) &&
      fs.existsSync(userDataJson)
    ) {
      fs.mkdirSync(paths.storeDir, { recursive: true });
      fs.copyFileSync(userDataJson, paths.jsonPath);
      console.log('VPE: Migrated vader-engine.json from userData/vpe-db to sovereign data/.');
    }
  } catch (e) {
    console.warn('VPE: userData JSON migration skipped:', e?.message ?? e);
  }

  const legacySqlite = path.join(__dirname, 'vader.sqlite');
  const legacyJson = path.join(__dirname, 'vader-engine.json');
  try {
    if (!fs.existsSync(paths.sqlitePath) && fs.existsSync(legacySqlite)) {
      fs.mkdirSync(paths.storeDir, { recursive: true });
      fs.copyFileSync(legacySqlite, paths.sqlitePath);
      console.log('VPE: Migrated vader.sqlite from src/main/db to sovereign data/.');
    }
  } catch (e) {
    console.warn('VPE: Legacy SQLite migration skipped:', e?.message ?? e);
  }
  try {
    if (!fs.existsSync(paths.jsonPath) && fs.existsSync(legacyJson)) {
      fs.mkdirSync(paths.storeDir, { recursive: true });
      fs.copyFileSync(legacyJson, paths.jsonPath);
      console.log('VPE: Migrated vader-engine.json from src/main/db to sovereign data/.');
    }
  } catch (e) {
    console.warn('VPE: Legacy JSON migration skipped:', e?.message ?? e);
  }
}

const MSC_VPE_RENDERER_PORT = msc_launcherRendererPort();

const SEED_PROJECTS = [
  ['1', 'MSC_PRIMARY_GATE', 'C:/Users/Vader/Projects/msc-primary-gate', 8080, 'stopped', null, 'dev', 'build', 'npm'],
  ['2', 'MEDIA_PRO_RENDER_V4', 'C:/Users/Vader/Projects/media-pro-render', 9000, 'stopped', null, 'dev', 'build', 'yarn'],
  ['3', 'VADER_BACKUP_NODE', 'C:/Users/Vader/Projects/vader-backup', 4443, 'stopped', null, 'dev', 'build', 'yarn'],
  ['4', 'MSC_CONTENT_API', 'C:/Users/Vader/Projects/msc-content-api', 3010, 'stopped', null, 'dev', 'build', 'pnpm'],
  ['5', 'MSC_AUTH_SERVICE', 'C:/Users/Vader/Projects/msc-auth-service', 3002, 'stopped', null, 'dev', 'build', 'npm'],
  ['6', 'MSC_MEDIA_GATE', 'C:/Users/Vader/Projects/msc-media-gate', 3003, 'stopped', null, 'dev', 'build', 'pnpm'],
];

function rowFromTuple(tuple) {
  return {
    id: tuple[0],
    name: tuple[1],
    path: tuple[2],
    port: tuple[3],
    status: tuple[4],
    thumbnail_url: tuple[5],
    start_script: tuple[6],
    build_script: tuple[7],
    pkg_manager: tuple[8],
    project_type: null,
    health_http_code: null,
    health_checked_at: null,
    health_reachable: null,
    is_archived: 0,
    notes: null,
    dev_session_started_at: null,
    has_documentation: 1,
    sort_order: 0,
    watchdog_enabled: 1,
  };
}

/**
 * When multiple projects share a `sort_order`, re-index 1..n by name so manual reorder swaps work.
 * @param {{ needsSortOrderSanitize?: () => boolean, sanitizeSortOrderAlphabetical?: () => void }} store
 * @returns {boolean} true if rows were rewritten
 */
function msc_vpeSanitizeSortOrder(store) {
  if (!store || typeof store.needsSortOrderSanitize !== 'function') return false;
  if (typeof store.sanitizeSortOrderAlphabetical !== 'function') return false;
  if (!store.needsSortOrderSanitize()) return false;
  store.sanitizeSortOrderAlphabetical();
  return true;
}

class SqlitePersistence {
  /** @param {import('better-sqlite3').Database} db */
  constructor(db) {
    this._db = db;
  }

  /** Tray / PM2: canonical list */
  getProjects() {
    return this.listProjectsAlphabetical();
  }

  listProjectsAlphabetical() {
    return this._db
      .prepare(
        `SELECT * FROM projects ORDER BY sort_order ASC, name COLLATE NOCASE`,
      )
      .all();
  }

  /** @returns {unknown | undefined} */
  getProject(projectId) {
    return this._db.prepare(`SELECT * FROM projects WHERE id = ?`).get(projectId);
  }

  setProjectRunning(projectId) {
    this._db
      .prepare(
        `UPDATE projects SET status = 'running', dev_session_started_at = ? WHERE id = ?`,
      )
      .run(new Date().toISOString(), projectId);
  }

  setProjectStopped(projectId) {
    this._db
      .prepare(
        `UPDATE projects SET status = 'stopped', dev_session_started_at = NULL WHERE id = ?`,
      )
      .run(projectId);
  }

  setProjectFavorite(projectId, isFavorite) {
    this._db
      .prepare(`UPDATE projects SET is_favorite = ? WHERE id = ?`)
      .run(isFavorite ? 1 : 0, projectId);
  }

  updateProject(payload) {
    const found = this._db.prepare(`SELECT * FROM projects WHERE id = ?`).get(payload.id);
    if (!found) throw new Error('VPE: Project not found');
    /** @type {string | null} */
    let projectTypeBind = found.project_type ?? null;
    if (Object.prototype.hasOwnProperty.call(payload, 'project_type')) {
      const v = payload.project_type;
      projectTypeBind =
        v == null || v === ''
          ? null
          : String(v).trim() || null;
    }

    let isArchivedBind = found.is_archived === 1 || found.is_archived === true ? 1 : 0;
    if (Object.prototype.hasOwnProperty.call(payload, 'is_archived')) {
      isArchivedBind =
        payload.is_archived === true || payload.is_archived === 1 ? 1 : 0;
    }

    let notesBind = found.notes != null ? String(found.notes) : null;
    if (Object.prototype.hasOwnProperty.call(payload, 'notes')) {
      const nv = payload.notes;
      notesBind =
        nv == null
          ? null
          : String(nv);
    }

    let watchdogBind = found.watchdog_enabled === 1 || found.watchdog_enabled === true ? 1 : 0;
    if (Object.prototype.hasOwnProperty.call(payload, 'watchdog_enabled')) {
      watchdogBind =
        payload.watchdog_enabled === true || payload.watchdog_enabled === 1 ? 1 : 0;
    }

    this._db
      .prepare(
        `
      UPDATE projects
      SET name = ?, path = ?, port = ?, thumbnail_url = ?, start_script = ?, build_script = ?, pkg_manager = ?, project_type = ?, is_archived = ?, notes = ?, watchdog_enabled = ?
      WHERE id = ?
    `,
      )
      .run(
        payload.name,
        payload.path,
        payload.port,
        payload.thumbnail_url ?? null,
        payload.start_script,
        payload.build_script,
        payload.pkg_manager,
        projectTypeBind,
        isArchivedBind,
        notesBind,
        watchdogBind,
        payload.id,
      );
  }

  insertProject(payload) {
    const pt =
      payload.project_type != null && String(payload.project_type).trim() !== ''
        ? String(payload.project_type).trim()
        : null;
    const isArc =
      payload.is_archived === true || payload.is_archived === 1 ? 1 : 0;
    const notesIns =
      payload.notes != null && String(payload.notes).trim() !== ''
        ? String(payload.notes)
        : null;
    const watchdogEnabled =
      payload.watchdog_enabled === false || payload.watchdog_enabled === 0 ? 0 : 1;
    this._db
      .prepare(
        `
      INSERT INTO projects (id, name, path, port, status, thumbnail_url, start_script, build_script, pkg_manager, project_type, is_archived, notes, watchdog_enabled)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .run(
        payload.id,
        payload.name,
        payload.path,
        payload.port,
        payload.status,
        payload.thumbnail_url ?? null,
        payload.start_script,
        payload.build_script,
        payload.pkg_manager,
        pt,
        isArc,
        notesIns,
        watchdogEnabled,
      );
  }

  deleteProject(projectId) {
    this._db.prepare(`DELETE FROM projects WHERE id = ?`).run(projectId);
  }

  /** Wipe all projects, logs (CASCADE), and repair history. */
  clearEntireRegistry() {
    this._db.transaction(() => {
      this._db.prepare(`DELETE FROM repair_runs`).run();
      this._db.prepare(`DELETE FROM projects`).run();
    })();
  }

  clearRepairHistory() {
    this._db.prepare(`DELETE FROM repair_runs`).run();
  }

  deleteRepairRun(repairId) {
    if (!repairId) return;
    this._db.prepare(`DELETE FROM repair_runs WHERE id = ?`).run(String(repairId));
  }

  insertLog(projectId, timestamp, level, message) {
    this._db
      .prepare(
        `INSERT INTO logs (project_id, timestamp, level, message) VALUES (?, ?, ?, ?)`,
      )
      .run(projectId, timestamp, level, message);
    this._trimLogs(projectId);
  }

  logsForProjectDesc(projectId, limit = 100) {
    return this._db
      .prepare(
        `SELECT * FROM logs WHERE project_id = ? ORDER BY id DESC LIMIT ?`,
      )
      .all(projectId, limit)
      .reverse();
  }

  logsRecentAll(limit = 200) {
    return this._db
      .prepare(
        `SELECT project_id, timestamp, level, message FROM logs ORDER BY id DESC LIMIT ?`,
      )
      .all(limit)
      .reverse();
  }

  getSettings() {
    try {
      const row = this._db.prepare(`SELECT * FROM settings WHERE id = 1`).get();
      if (!row) {
        this._db
          .prepare(
            `INSERT INTO settings (id, minimize_to_tray, theme_accent, launch_at_login, auto_start_projects, default_view)
             VALUES (1, 0, ?, 0, 0, 'cinema')`,
          )
          .run(MSC_VPE_APP_SETTINGS_DEFAULTS.theme_accent);
        return { id: 1, ...msc_normalizeAppSettingsRow({}) };
      }
      const n = msc_normalizeAppSettingsRow(row);
      return { id: 1, ...n };
    } catch (e) {
      console.error('VPE: getSettings failed', e);
      return { id: 1, ...msc_normalizeAppSettingsRow({}) };
    }
  }

  /** @param {Object.<string, *>} patch */
  updateAppSettings(patch) {
    let cur = this._db.prepare(`SELECT * FROM settings WHERE id = 1`).get();
    if (!cur) {
      this._db
        .prepare(
          `INSERT INTO settings (id, minimize_to_tray, theme_accent, launch_at_login, auto_start_projects, default_view)
           VALUES (1, 0, ?, 0, 0, 'cinema')`,
        )
        .run(MSC_VPE_APP_SETTINGS_DEFAULTS.theme_accent);
      cur = this._db.prepare(`SELECT * FROM settings WHERE id = 1`).get();
    }
    const merged = msc_normalizeAppSettingsRow({ ...(cur || {}), ...patch });
    const minimize = merged.minimize_to_tray ? 1 : 0;
    const launch = merged.launch_at_login ? 1 : 0;
    const autoStart = merged.auto_start_projects ? 1 : 0;
    const autoSyncClose = merged.auto_sync_db_on_close ? 1 : 0;
    const dv = msc_normalizeDefaultView(merged.default_view);
    const accent = merged.theme_accent || MSC_VPE_APP_SETTINGS_DEFAULTS.theme_accent;
    const fontStyle = msc_normalizeFontStyle(merged.font_style);
    const prs = merged.port_range_start;
    const pre = merged.port_range_end;
    this._db
      .prepare(
        `UPDATE settings SET minimize_to_tray = ?, theme_accent = ?, launch_at_login = ?, auto_start_projects = ?, default_view = ?, font_style = ?, port_range_start = ?, port_range_end = ?, auto_sync_db_on_close = ?
         WHERE id = 1`,
      )
      .run(minimize, accent, launch, autoStart, dv, fontStyle, prs, pre, autoSyncClose);
    return this.getSettings();
  }

  _trimLogs(projectId) {
    const { n } = this._db
      .prepare(`SELECT COUNT(*) AS n FROM logs WHERE project_id = ?`)
      .get(projectId);
    const excess = n - 100;
    if (excess <= 0) return;
    const rows = this._db
      .prepare(
        `SELECT id FROM logs WHERE project_id = ? ORDER BY id ASC LIMIT ?`,
      )
      .all(projectId, excess);
    const ids = rows.map((r) => r.id);
    if (!ids.length) return;
    const placeholders = ids.map(() => '?').join(',');
    this._db
      .prepare(`DELETE FROM logs WHERE id IN (${placeholders})`)
      .run(...ids);
  }

  setProjectHealth(projectId, httpCode, checkedAtIso, reachable) {
    const r =
      reachable === true ? 1 : reachable === false ? 0 : null;
    this._db
      .prepare(
        `UPDATE projects SET health_http_code = ?, health_checked_at = ?, health_reachable = ? WHERE id = ?`,
      )
      .run(httpCode, checkedAtIso, r, projectId);
  }

  clearProjectHealth(projectId) {
    this._db
      .prepare(
        `UPDATE projects SET health_http_code = NULL, health_checked_at = NULL, health_reachable = NULL WHERE id = ?`,
      )
      .run(projectId);
  }

  insertRepairRun(row) {
    this._db
      .prepare(
        `INSERT INTO repair_runs (id, project_id, project_name, created_at, status, description, files_changed)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        row.id,
        row.project_id,
        row.project_name,
        row.created_at,
        row.status,
        row.description,
        row.files_changed,
      );
  }

  listRepairRunsDesc(limit = 200) {
    const n = Number(limit);
    const cap = Number.isFinite(n) && n > 0 ? Math.min(n, 500) : 200;
    return this._db
      .prepare(
        `SELECT id, project_id, project_name, created_at, status, description, files_changed
         FROM repair_runs ORDER BY datetime(created_at) DESC LIMIT ?`,
      )
      .all(cap);
  }

  /**
   * Portable vault: snapshot open SQLite into `<projectRoot>/vpe-backups/vpe_backup_*.sqlite`
   * via `VACUUM INTO` (WAL-safe). Rotates to the last 5 files.
   * @param {string} projectRootAbs
   * @returns {{ ok: true, path: string }}
   */
  portableVaultBackupToProjectRoot(projectRootAbs) {
    const root = path.resolve(projectRootAbs);
    const dir = path.join(root, 'vpe-backups');
    fs.mkdirSync(dir, { recursive: true });
    const stamp = msc_vpePortableBackupTimestamp();
    const dest = path.join(dir, `vpe_backup_${stamp}.sqlite`);
    const posix = path.resolve(dest).replace(/\\/g, '/').replace(/'/g, "''");
    if (fs.existsSync(dest)) fs.unlinkSync(dest);
    this._db.exec(`VACUUM INTO '${posix}'`);
    msc_vpeRotatePortableBackups(dir, '.sqlite', 5);
    return { ok: true, path: dest };
  }

  needsSortOrderSanitize() {
    const row = this._db.prepare(`SELECT COUNT(*) AS n FROM projects`).get();
    const n = row && typeof row.n === 'number' ? row.n : 0;
    if (n <= 1) return false;
    const dRow = this._db.prepare(`SELECT COUNT(DISTINCT sort_order) AS d FROM projects`).get();
    const d = dRow && typeof dRow.d === 'number' ? dRow.d : 0;
    return d < n;
  }

  sanitizeSortOrderAlphabetical() {
    const rows = this._db
      .prepare(`SELECT id FROM projects ORDER BY name COLLATE NOCASE`)
      .all();
    const tx = this._db.transaction(() => {
      const u = this._db.prepare(`UPDATE projects SET sort_order = ? WHERE id = ?`);
      for (let i = 0; i < rows.length; i += 1) {
        u.run(i + 1, rows[i].id);
      }
    });
    tx();
  }

  /**
   * @param {string} projectId
   * @param {'up' | 'down'} direction
   * @returns {{ ok: true } | { ok: false, error: string }}
   */
  reorderProjectNeighbor(projectId, direction) {
    msc_vpeSanitizeSortOrder(this);
    const ordered = this.listProjectsAlphabetical();
    const i = ordered.findIndex((r) => r.id === projectId);
    if (i < 0) return { ok: false, error: 'not_found' };
    const j = direction === 'up' ? i - 1 : i + 1;
    if (j < 0 || j >= ordered.length) return { ok: false, error: 'no_neighbor' };
    const a = ordered[i];
    const b = ordered[j];
    const sa = Number(a.sort_order);
    const sb = Number(b.sort_order);
    const va = Number.isFinite(sa) ? sa : 0;
    const vb = Number.isFinite(sb) ? sb : 0;
    const tx = this._db.transaction(() => {
      this._db.prepare(`UPDATE projects SET sort_order = ? WHERE id = ?`).run(vb, a.id);
      this._db.prepare(`UPDATE projects SET sort_order = ? WHERE id = ?`).run(va, b.id);
    });
    tx();
    return { ok: true };
  }
}

class JsonPersistence {
  /** @param {{ storeDir: string, jsonPath: string }} paths */
  constructor(paths) {
    this._storeDir = paths.storeDir;
    this._jsonPath = paths.jsonPath;
    /** @type {{ projects: Object.<string, *>, logs: Array<*>, logSeq: number, repairRuns: Array<*>, settings?: Object.<string, *> }} */
    this._data = {
      projects: {},
      logs: [],
      logSeq: 0,
      repairRuns: [],
      settings: { ...MSC_VPE_APP_SETTINGS_DEFAULTS },
    };
  }

  load() {
    try {
      if (fs.existsSync(this._jsonPath)) {
        const raw = JSON.parse(fs.readFileSync(this._jsonPath, 'utf8'));
        this._data = {
          projects: raw.projects && typeof raw.projects === 'object' ? raw.projects : {},
          logs: Array.isArray(raw.logs) ? raw.logs : [],
          logSeq: typeof raw.logSeq === 'number' ? raw.logSeq : this._inferNextLogId(),
          repairRuns: Array.isArray(raw.repairRuns) ? raw.repairRuns : [],
          settings:
            raw.settings && typeof raw.settings === 'object'
              ? { ...MSC_VPE_APP_SETTINGS_DEFAULTS, ...raw.settings }
              : { ...MSC_VPE_APP_SETTINGS_DEFAULTS },
        };
      }
    } catch {
      this._data = {
        projects: {},
        logs: [],
        logSeq: 0,
        repairRuns: [],
        settings: { ...MSC_VPE_APP_SETTINGS_DEFAULTS },
      };
    }
    if (!this._data.settings || typeof this._data.settings !== 'object') {
      this._data.settings = { ...MSC_VPE_APP_SETTINGS_DEFAULTS };
    }
    this._migrateJsonHealthAndPorts();
  }

  /** One-time: health fields + move projects off launcher port (legacy port 3000 rows). */
  _migrateJsonHealthAndPorts() {
    let changed = false;
    const launcher = MSC_VPE_RENDERER_PORT;
    for (const p of Object.values(this._data.projects)) {
      if (!p) continue;
      if (p.health_http_code === undefined) {
        p.health_http_code = null;
        changed = true;
      }
      if (p.health_checked_at === undefined) {
        p.health_checked_at = null;
        changed = true;
      }
      if (p.health_reachable === undefined) {
        p.health_reachable = null;
        changed = true;
      }
      if (p.project_type === undefined) {
        p.project_type = null;
        changed = true;
      }
      if (p.is_archived === undefined) {
        p.is_archived = false;
        changed = true;
      }
      if (p.notes === undefined) {
        p.notes = null;
        changed = true;
      }
      if (p.dev_session_started_at === undefined) {
        p.dev_session_started_at = null;
        changed = true;
      }
      if (p.sort_order === undefined) {
        p.sort_order = 0;
        changed = true;
      }
      if (p.has_documentation === undefined) {
        p.has_documentation = 1;
        changed = true;
      } else {
        const hd = p.has_documentation;
        let n = null;
        if (hd === false || hd === 0 || hd === '0') n = 0;
        else if (hd === true || hd === 1 || hd === '1') n = 1;
        else if (typeof hd === 'string') {
          const parsed = Number(hd);
          n = Number.isFinite(parsed) && parsed === 0 ? 0 : 1;
        } else if (typeof hd === 'number' && Number.isFinite(hd)) {
          n = hd === 0 ? 0 : 1;
        }
        if (n !== null && p.has_documentation !== n) {
        p.has_documentation = n;
        changed = true;
      }
    }
    if (p.watchdog_enabled === undefined) {
      p.watchdog_enabled = 1;
      changed = true;
    }
  }
    const list = Object.values(this._data.projects);
    for (const p of list) {
      if (!p || Number(p.port) !== launcher) continue;
      const used = new Set(list.map((x) => Number(x?.port)));
      let np = launcher + 1;
      while (used.has(np)) np += 1;
      p.port = np;
      used.add(np);
      changed = true;
      console.log(
        `VPE(JSON): Migrated project "${p.name}" off launcher port ${launcher} → ${np}.`,
      );
    }
    if (changed) this.save();
  }

  save() {
    fs.mkdirSync(this._storeDir, { recursive: true });
    fs.writeFileSync(this._jsonPath, JSON.stringify(this._data, null, 2), 'utf8');
  }

  _inferNextLogId() {
    if (!this._data.logs.length) return 0;
    return Math.max(...this._data.logs.map((l) => l.id || 0));
  }

  migrateFromLegacyRegistry() {
    if (!fs.existsSync(LEGACY_REGISTRY)) return;
    let data;
    try {
      data = JSON.parse(fs.readFileSync(LEGACY_REGISTRY, 'utf8'));
    } catch {
      return;
    }
    const list = Array.isArray(data.projects) ? data.projects : [];
    for (const p of list) {
      const id = p.id != null ? String(p.id) : undefined;
      if (!id) continue;
      this._data.projects[id] = {
        id,
        name: (p.displayName || p.name || id).toString(),
        path: (p.path || '').toString(),
        port: Number(p.preferredPort || p.port || 3000),
        status: p.status === 'running' ? 'running' : 'stopped',
        thumbnail_url: p.lastThumbnail || null,
        start_script: (p.detectedStartScript || 'dev').toString(),
        build_script: (p.buildScript || 'build').toString(),
        pkg_manager: (p.detectedPackageManager || 'npm').toString(),
        sort_order: 0,
        health_http_code: null,
        health_checked_at: null,
        health_reachable: null,
        dev_session_started_at: null,
      };
    }
  }

  seedIfEmpty() {
    const ids = Object.keys(this._data.projects);
    if (ids.length > 0) return;

    this.migrateFromLegacyRegistry();

    if (Object.keys(this._data.projects).length > 0) {
      this.save();
      this._migrateJsonHealthAndPorts();
      return;
    }

    for (const t of SEED_PROJECTS) {
      const row = rowFromTuple(t);
      this._data.projects[row.id] = row;
    }
    this.save();
    this._migrateJsonHealthAndPorts();
  }

  getProjects() {
    return this.listProjectsAlphabetical();
  }

  listProjectsAlphabetical() {
    return Object.values(this._data.projects).sort((a, b) => {
      const sa = Number(a.sort_order);
      const sb = Number(b.sort_order);
      const oa = Number.isFinite(sa) ? sa : 0;
      const ob = Number.isFinite(sb) ? sb : 0;
      if (oa !== ob) return oa - ob;
      return String(a.name).localeCompare(String(b.name));
    });
  }

  getProject(projectId) {
    return this._data.projects[projectId];
  }

  setProjectRunning(projectId) {
    const p = this._data.projects[projectId];
    if (p) {
      p.status = 'running';
      p.dev_session_started_at = new Date().toISOString();
      this.save();
    }
  }

  setProjectStopped(projectId) {
    const p = this._data.projects[projectId];
    if (p) {
      p.status = 'stopped';
      p.dev_session_started_at = null;
      this.save();
    }
  }

  updateProject(payload) {
    const p = this._data.projects[payload.id];
    if (!p) throw new Error('VPE: Project not found');
    p.name = payload.name;
    p.path = payload.path;
    p.port = payload.port;
    p.thumbnail_url = payload.thumbnail_url ?? null;
    p.start_script = payload.start_script;
    p.build_script = payload.build_script;
    p.pkg_manager = payload.pkg_manager;
    if (
      Object.prototype.hasOwnProperty.call(payload, 'project_type') &&
      typeof payload.project_type !== 'undefined'
    ) {
      const v = payload.project_type;
      p.project_type =
        v == null || v === '' ? null : String(v);
    }
    if (
      Object.prototype.hasOwnProperty.call(payload, 'is_archived') &&
      typeof payload.is_archived !== 'undefined'
    ) {
      p.is_archived = Boolean(payload.is_archived);
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'notes')) {
      const nv = payload.notes;
      p.notes = nv == null ? null : String(nv);
    }
    this.save();
  }

  insertProject(payload) {
    const pt =
      payload.project_type != null && String(payload.project_type).trim() !== ''
        ? String(payload.project_type).trim()
        : null;
    const notesIni =
      payload.notes != null && String(payload.notes).trim() !== ''
        ? String(payload.notes)
        : null;
    const soRaw = Number(payload.sort_order);
    const sortOrder = Number.isFinite(soRaw) ? Math.floor(soRaw) : 0;
    this._data.projects[payload.id] = {
      ...payload,
      project_type: pt,
      is_archived: Boolean(payload.is_archived),
      notes: notesIni,
      sort_order: sortOrder,
      health_http_code: null,
      health_checked_at: null,
      health_reachable: null,
    };
    this.save();
  }

  deleteProject(projectId) {
    delete this._data.projects[projectId];
    this._data.logs = this._data.logs.filter((l) => l.project_id !== projectId);
    this.save();
  }

  clearEntireRegistry() {
    this._data.projects = {};
    this._data.logs = [];
    this._data.repairRuns = [];
    this._data.logSeq = 0;
    this.save();
  }

  clearRepairHistory() {
    this._data.repairRuns = [];
    this.save();
  }

  deleteRepairRun(repairId) {
    if (!repairId) return;
    if (!Array.isArray(this._data.repairRuns)) return;
    this._data.repairRuns = this._data.repairRuns.filter((r) => r.id !== repairId);
    this.save();
  }

  insertLog(projectId, timestamp, level, message) {
    this._data.logSeq += 1;
    this._data.logs.push({
      id: this._data.logSeq,
      project_id: projectId,
      timestamp,
      level,
      message,
    });
    this._trimLogs(projectId);
    this.save();
  }

  logsForProjectDesc(projectId, limit = 100) {
    return this._data.logs
      .filter((l) => l.project_id === projectId)
      .sort((a, b) => b.id - a.id)
      .slice(0, limit)
      .reverse();
  }

  _trimLogs(projectId) {
    const mine = this._data.logs.filter((l) => l.project_id === projectId);
    if (mine.length <= 100) return;
    const sorted = [...mine].sort((a, b) => a.id - b.id);
    const drop = sorted.slice(0, mine.length - 100).map((l) => l.id);
    this._data.logs = this._data.logs.filter((l) => !drop.includes(l.id));
  }

  setProjectHealth(projectId, httpCode, checkedAtIso, reachable) {
    const p = this._data.projects[projectId];
    if (!p) return;
    p.health_http_code = httpCode;
    p.health_checked_at = checkedAtIso;
    p.health_reachable = reachable === undefined ? null : Boolean(reachable);
    this.save();
  }

  clearProjectHealth(projectId) {
    const p = this._data.projects[projectId];
    if (!p) return;
    p.health_http_code = null;
    p.health_checked_at = null;
    p.health_reachable = null;
    this.save();
  }

  insertRepairRun(row) {
    if (!Array.isArray(this._data.repairRuns)) this._data.repairRuns = [];
    this._data.repairRuns.push({
      id: row.id,
      project_id: row.project_id,
      project_name: row.project_name,
      created_at: row.created_at,
      status: row.status,
      description: row.description,
      files_changed: row.files_changed,
    });
    this.save();
  }

  listRepairRunsDesc(limit = 200) {
    const n = Number(limit);
    const cap = Number.isFinite(n) && n > 0 ? Math.min(n, 500) : 200;
    const list = Array.isArray(this._data.repairRuns) ? [...this._data.repairRuns] : [];
    list.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    return list.slice(0, cap);
  }

  /** Recent log lines across all projects (for unified feed). */
  logsRecentAll(limit = 200) {
    const slice = [...this._data.logs]
      .sort((a, b) => (b.id || 0) - (a.id || 0))
      .slice(0, limit)
      .reverse();
    return slice.map((row) => ({
      project_id: row.project_id,
      timestamp: row.timestamp,
      level: row.level,
      message: row.message,
    }));
  }

  needsSortOrderSanitize() {
    const list = Object.values(this._data.projects);
    if (list.length <= 1) return false;
    const distinct = new Set(
      list.map((p) => {
        const n = Number(p.sort_order);
        return Number.isFinite(n) ? n : 0;
      }),
    );
    return distinct.size < list.length;
  }

  sanitizeSortOrderAlphabetical() {
    const rows = Object.values(this._data.projects).sort((a, b) =>
      String(a.name).localeCompare(String(b.name)),
    );
    for (let i = 0; i < rows.length; i += 1) {
      const p = this._data.projects[rows[i].id];
      if (p) p.sort_order = i + 1;
    }
    this.save();
  }

  /**
   * @param {string} projectId
   * @param {'up' | 'down'} direction
   * @returns {{ ok: true } | { ok: false, error: string }}
   */
  reorderProjectNeighbor(projectId, direction) {
    msc_vpeSanitizeSortOrder(this);
    const ordered = this.listProjectsAlphabetical();
    const i = ordered.findIndex((r) => r.id === projectId);
    if (i < 0) return { ok: false, error: 'not_found' };
    const j = direction === 'up' ? i - 1 : i + 1;
    if (j < 0 || j >= ordered.length) return { ok: false, error: 'no_neighbor' };
    const a = ordered[i];
    const b = ordered[j];
    const pa = this._data.projects[a.id];
    const pb = this._data.projects[b.id];
    if (!pa || !pb) return { ok: false, error: 'not_found' };
    const sa = Number(pa.sort_order);
    const sb = Number(pb.sort_order);
    const va = Number.isFinite(sa) ? sa : 0;
    const vb = Number.isFinite(sb) ? sb : 0;
    pa.sort_order = vb;
    pb.sort_order = va;
    this.save();
    return { ok: true };
  }

  /**
   * JSON fallback engine: copy `vader-engine.json` into `vpe-backups` (rotated).
   * @param {string} projectRootAbs
   * @returns {{ ok: true, path: string }}
   */
  portableVaultBackupToProjectRoot(projectRootAbs) {
    const root = path.resolve(projectRootAbs);
    const dir = path.join(root, 'vpe-backups');
    fs.mkdirSync(dir, { recursive: true });
    const stamp = msc_vpePortableBackupTimestamp();
    const dest = path.join(dir, `vpe_backup_${stamp}.json`);
    if (!fs.existsSync(this._jsonPath)) {
      throw new Error('VPE: JSON engine store file not found');
    }
    fs.copyFileSync(this._jsonPath, dest);
    msc_vpeRotatePortableBackups(dir, '.json', 5);
    return { ok: true, path: dest };
  }

  getSettings() {
    return { id: 1, ...msc_normalizeAppSettingsRow(this._data.settings) };
  }

  /** @param {Object.<string, *>} patch */
  updateAppSettings(patch) {
    const cur = msc_normalizeAppSettingsRow(this._data.settings);
    const merged = msc_normalizeAppSettingsRow({ ...cur, ...patch });
    this._data.settings = merged;
    this.save();
    return this.getSettings();
  }
}

function msc_migrateFromProjectsJsonSQLite(db) {
  if (!fs.existsSync(LEGACY_REGISTRY)) return;
  let data;
  try {
    data = JSON.parse(fs.readFileSync(LEGACY_REGISTRY, 'utf8'));
  } catch {
    return;
  }
  const list = Array.isArray(data.projects) ? data.projects : [];
  if (!list.length) return;

  const insert = db.prepare(`
    INSERT OR REPLACE INTO projects (id, name, path, port, status, thumbnail_url, start_script, build_script, pkg_manager)
    VALUES (@id, @name, @path, @port, @status, @thumbnail_url, @start_script, @build_script, @pkg_manager)
  `);

  const tx = db.transaction(() => {
    for (const p of list) {
      const id = p.id != null ? String(p.id) : undefined;
      if (!id) continue;
      insert.run({
        id,
        name: (p.displayName || p.name || id).toString(),
        path: (p.path || '').toString(),
        port: Number(p.preferredPort || p.port || 3000),
        status: p.status === 'running' ? 'running' : 'stopped',
        thumbnail_url: p.lastThumbnail || null,
        start_script: (p.detectedStartScript || 'dev').toString(),
        build_script: (p.buildScript || 'build').toString(),
        pkg_manager: (p.detectedPackageManager || 'npm').toString(),
      });
    }
  });
  tx();
}

function msc_sqliteTableColumnNames(db, table) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
}

/** Add health columns; bump any project still on the launcher port (one-time). */
function msc_sqliteMigrateSchemaAndPorts(db) {
  let ver = Number(db.pragma('user_version', { simple: true })) || 0;
  const launcher = MSC_VPE_RENDERER_PORT;

  if (ver < 1) {
    const names = msc_sqliteTableColumnNames(db, 'projects');
    if (!names.includes('health_http_code')) {
      db.exec(`ALTER TABLE projects ADD COLUMN health_http_code INTEGER`);
    }
    if (!names.includes('health_checked_at')) {
      db.exec(`ALTER TABLE projects ADD COLUMN health_checked_at TEXT`);
    }
    ver = 1;
  }

  if (ver < 2) {
    const rows = db.prepare(`SELECT id FROM projects WHERE port = ?`).all(launcher);
    if (rows.length) {
      for (const { id } of rows) {
        const used = new Set(
          db.prepare(`SELECT port FROM projects`).all().map((r) => r.port),
        );
        let np = launcher + 1;
        while (used.has(np)) np += 1;
        db.prepare(`UPDATE projects SET port = ? WHERE id = ?`).run(np, id);
      }
      console.log(
        `VPE(SQLite): Migrated ${rows.length} project(s) off launcher port ${launcher}.`,
      );
    }
    ver = 2;
  }

  if (ver < 3) {
    const names = msc_sqliteTableColumnNames(db, 'projects');
    if (!names.includes('health_reachable')) {
      db.exec(`ALTER TABLE projects ADD COLUMN health_reachable INTEGER`);
    }
    ver = 3;
  }

  if (ver < 4) {
    const names = msc_sqliteTableColumnNames(db, 'projects');
    if (!names.includes('is_favorite')) {
      db.exec(`ALTER TABLE projects ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0`);
    }
    ver = 4;
  }
  
  if (ver < 5) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        minimize_to_tray INTEGER DEFAULT 0,
        theme_accent TEXT DEFAULT '#4fde82'
      )
    `);
    ver = 5;
  }

  if (ver < 6) {
    const names = msc_sqliteTableColumnNames(db, 'projects');
    if (!names.includes('project_type')) {
      db.exec(`ALTER TABLE projects ADD COLUMN project_type TEXT`);
    }
    ver = 6;
  }

  if (ver < 7) {
    const names = msc_sqliteTableColumnNames(db, 'projects');
    if (!names.includes('is_archived')) {
      db.exec(
        `ALTER TABLE projects ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0`,
      );
    }
    ver = 7;
  }

  if (ver < 8) {
    const names = msc_sqliteTableColumnNames(db, 'projects');
    if (!names.includes('notes')) {
      db.exec(`ALTER TABLE projects ADD COLUMN notes TEXT`);
    }
    ver = 8;
  }

  if (ver < 9) {
    let sn = msc_sqliteTableColumnNames(db, 'settings');
    if (!sn.includes('launch_at_login')) {
      db.exec(
        `ALTER TABLE settings ADD COLUMN launch_at_login INTEGER NOT NULL DEFAULT 0`,
      );
      sn = msc_sqliteTableColumnNames(db, 'settings');
    }
    if (!sn.includes('auto_start_projects')) {
      db.exec(
        `ALTER TABLE settings ADD COLUMN auto_start_projects INTEGER NOT NULL DEFAULT 0`,
      );
      sn = msc_sqliteTableColumnNames(db, 'settings');
    }
    if (!sn.includes('default_view')) {
      db.exec(`ALTER TABLE settings ADD COLUMN default_view TEXT NOT NULL DEFAULT 'card'`);
    }
    ver = 9;
  }

  if (ver < 10) {
    const sn = msc_sqliteTableColumnNames(db, 'settings');
    if (!sn.includes('font_style')) {
      db.exec(
        `ALTER TABLE settings ADD COLUMN font_style TEXT NOT NULL DEFAULT 'mulish_studio'`,
      );
    }
    ver = 10;
  }

  if (ver < 11) {
    const names = msc_sqliteTableColumnNames(db, 'projects');
    if (!names.includes('dev_session_started_at')) {
      db.exec(`ALTER TABLE projects ADD COLUMN dev_session_started_at TEXT`);
    }
    ver = 11;
  }

  if (ver < 12) {
    let sn = msc_sqliteTableColumnNames(db, 'settings');
    if (!sn.includes('port_range_start')) {
      db.exec(
        `ALTER TABLE settings ADD COLUMN port_range_start INTEGER NOT NULL DEFAULT 3000`,
      );
      sn = msc_sqliteTableColumnNames(db, 'settings');
    }
    if (!sn.includes('port_range_end')) {
      db.exec(
        `ALTER TABLE settings ADD COLUMN port_range_end INTEGER NOT NULL DEFAULT 3020`,
      );
    }
    ver = 12;
  }

  // Registry: documentation/paperclip gate — INTEGER 0/1 only (never TEXT).
  if (ver < 13) {
    const names = msc_sqliteTableColumnNames(db, 'projects');
    if (!names.includes('has_documentation')) {
      db.exec(
        `ALTER TABLE projects ADD COLUMN has_documentation INTEGER NOT NULL DEFAULT 1`,
      );
    }
    ver = 13;
  }

  if (ver < 14) {
    const names = msc_sqliteTableColumnNames(db, 'projects');
    if (!names.includes('sort_order')) {
      db.exec(`ALTER TABLE projects ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0`);
    }
    ver = 14;
  }

  if (ver < 15) {
    let sn = msc_sqliteTableColumnNames(db, 'settings');
    if (!sn.includes('auto_sync_db_on_close')) {
      db.exec(
        `ALTER TABLE settings ADD COLUMN auto_sync_db_on_close INTEGER NOT NULL DEFAULT 0`,
      );
      sn = msc_sqliteTableColumnNames(db, 'settings');
    }
    ver = 15;
  }

  if (ver < 16) {
    const names = msc_sqliteTableColumnNames(db, 'projects');
    if (!names.includes('watchdog_enabled')) {
      db.exec(`ALTER TABLE projects ADD COLUMN watchdog_enabled INTEGER NOT NULL DEFAULT 1`);
    }
    ver = 16;
  }

  db.pragma(`user_version = ${ver}`);
}

/**
 * @param {string} backupDir
 * @param {string} suffix — e.g. `.sqlite` or `.json`
 * @param {number} keep
 */
function msc_vpeRotatePortableBackups(backupDir, suffix, keep) {
  let names = [];
  try {
    names = fs.readdirSync(backupDir);
  } catch {
    return;
  }
  const matches = names.filter((n) => n.startsWith('vpe_backup_') && n.endsWith(suffix));
  const scored = matches.map((n) => {
    const full = path.join(backupDir, n);
    let ms = 0;
    try {
      ms = fs.statSync(full).mtimeMs;
    } catch {
      /* */
    }
    return { full, ms };
  });
  scored.sort((a, b) => b.ms - a.ms);
  for (let i = keep; i < scored.length; i += 1) {
    try {
      fs.unlinkSync(scored[i].full);
    } catch {
      /* */
    }
  }
}

function msc_vpePortableBackupTimestamp() {
  const d = new Date();
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function msc_seedSqlite(database) {
  const row = database.prepare('SELECT COUNT(*) AS c FROM projects').get();
  if (row.c > 0) return;

  if (fs.existsSync(LEGACY_REGISTRY)) {
    try {
      const data = JSON.parse(fs.readFileSync(LEGACY_REGISTRY, 'utf8'));
      if (Array.isArray(data.projects) && data.projects.length > 0) {
        msc_migrateFromProjectsJsonSQLite(database);
        const after = database.prepare('SELECT COUNT(*) AS c FROM projects').get();
        if (after.c > 0) return;
      }
    } catch {
      /* static seed */
    }
  }

  const insert = database.prepare(`
    INSERT INTO projects (id, name, path, port, status, thumbnail_url, start_script, build_script, pkg_manager)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const tx = database.transaction(() => {
    for (const r of SEED_PROJECTS) insert.run(r);
  });
  tx();
}

let storeSingleton = null;

function msc_createPersistentStore() {
  if (storeSingleton) return storeSingleton;

  const paths = msc_getStorePaths();
  fs.mkdirSync(paths.storeDir, { recursive: true });
  msc_migrateLegacyDbFiles(paths);

  console.log('[VPE] LOGIC_MOD_01 — sovereign SQLite path:', paths.sqlitePath);

  try {
    const BetterSqlite3 = require('better-sqlite3');
    const rawDb = new BetterSqlite3(paths.sqlitePath);
    rawDb.pragma('journal_mode = WAL');
    rawDb.pragma('foreign_keys = ON');

    msc_sqliteApplyBaseSchema(rawDb);

    msc_sqliteMigrateSchemaAndPorts(rawDb);
    msc_seedSqlite(rawDb);
    storeSingleton = new SqlitePersistence(rawDb);
    console.log('VPE persistence: SQLite (better-sqlite3)');
  } catch (err) {
    msc_logWarn(
      'VPE: SQLite unavailable (Electron/Node ABI or build tools); using JSON store.',
      err?.message ?? err,
    );
    const j = new JsonPersistence(paths);
    j.load();
    j.seedIfEmpty();
    storeSingleton = j;
  }

  return storeSingleton;
}

function msc_getPersistentStore() {
  if (!storeSingleton) {
    throw new Error('VPE persistence not initialized. Call msc_createPersistentStore first.');
  }
  return storeSingleton;
}

/**
 * @param {unknown} store — `SqlitePersistence` | `JsonPersistence`
 * @param {string} projectRootAbs — portable tree root (`process.cwd()` for checkout layout)
 * @returns {{ ok: true, path: string } | { ok: false, error: string }}
 */
function msc_vpePortableBackupFromStore(store, projectRootAbs) {
  if (!store || typeof store.portableVaultBackupToProjectRoot !== 'function') {
    return { ok: false, error: 'VPE: Portable backup requires active persistence engine.' };
  }
  try {
    return store.portableVaultBackupToProjectRoot(projectRootAbs);
  } catch (e) {
    const m = e && typeof e === 'object' && 'message' in e ? String(e.message) : String(e);
    return { ok: false, error: m };
  }
}

module.exports = {
  msc_createPersistentStore,
  msc_getPersistentStore,
  msc_getSovereignAppRoot,
  msc_getStorePaths,
  msc_vpePortableBackupFromStore,
  msc_vpeSanitizeSortOrder,
  msc_sqliteApplyBaseSchema,
  msc_sqliteMigrateSchemaAndPorts,
  VPE_SQLITE_USER_VERSION,
  /** @deprecated Migrate once at boot, then archived — do not rely on cwd path */
  MSC_LEGACY_PROJECTS_JSON_PATH: LEGACY_REGISTRY,
};
