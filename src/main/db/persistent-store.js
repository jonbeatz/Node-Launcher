const fs = require('fs');
const path = require('path');
const { msc_launcherRendererPort } = require('../launcher-port');

/** One-time migrate source; cwd file is archived to media/_vpe_archive after boot. */
const LEGACY_REGISTRY = path.join(process.cwd(), 'projects.json');

/**
 * Writable DB directory: `app.getPath("userData")/vpe-db` in Electron (avoids SQLite inside read-only app.asar).
 * Falls back to `__dirname` when `electron` is not available (plain Node / tests).
 * @returns {{ storeDir: string, sqlitePath: string, jsonPath: string }}
 */
function msc_getStorePaths() {
  let storeDir;
  try {
    const { app } = require('electron');
    if (app && typeof app.getPath === 'function') {
      storeDir = path.join(app.getPath('userData'), 'vpe-db');
    }
  } catch {
    /* electron not loadable */
  }
  if (!storeDir) {
    storeDir = __dirname;
  }
  return {
    storeDir,
    sqlitePath: path.join(storeDir, 'vader.sqlite'),
    jsonPath: path.join(storeDir, 'vader-engine.json'),
  };
}

/** Copy legacy DB files that lived next to this module (dev / pre-migration) into the userData store. */
function msc_migrateLegacyDbFiles(paths) {
  const legacySqlite = path.join(__dirname, 'vader.sqlite');
  const legacyJson = path.join(__dirname, 'vader-engine.json');
  try {
    if (!fs.existsSync(paths.sqlitePath) && fs.existsSync(legacySqlite)) {
      fs.mkdirSync(paths.storeDir, { recursive: true });
      fs.copyFileSync(legacySqlite, paths.sqlitePath);
      console.log('VPE: Migrated vader.sqlite to userData vpe-db.');
    }
  } catch (e) {
    console.warn('VPE: Legacy SQLite migration skipped:', e?.message ?? e);
  }
  try {
    if (!fs.existsSync(paths.jsonPath) && fs.existsSync(legacyJson)) {
      fs.mkdirSync(paths.storeDir, { recursive: true });
      fs.copyFileSync(legacyJson, paths.jsonPath);
      console.log('VPE: Migrated vader-engine.json to userData vpe-db.');
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
    health_http_code: null,
    health_checked_at: null,
    health_reachable: null,
  };
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
    return this._db.prepare(`SELECT * FROM projects ORDER BY name COLLATE NOCASE`).all();
  }

  /** @returns {unknown | undefined} */
  getProject(projectId) {
    return this._db.prepare(`SELECT * FROM projects WHERE id = ?`).get(projectId);
  }

  setProjectRunning(projectId) {
    this._db.prepare(`UPDATE projects SET status = 'running' WHERE id = ?`).run(projectId);
  }

  setProjectStopped(projectId) {
    this._db.prepare(`UPDATE projects SET status = 'stopped' WHERE id = ?`).run(projectId);
  }

  setProjectFavorite(projectId, isFavorite) {
    this._db
      .prepare(`UPDATE projects SET is_favorite = ? WHERE id = ?`)
      .run(isFavorite ? 1 : 0, projectId);
  }

  updateProject(payload) {
    const found = this._db
      .prepare(`SELECT id FROM projects WHERE id = ?`)
      .get(payload.id);
    if (!found) throw new Error('VPE: Project not found');

    this._db
      .prepare(
        `
      UPDATE projects
      SET name = ?, path = ?, port = ?, thumbnail_url = ?, start_script = ?, build_script = ?, pkg_manager = ?
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
        payload.id,
      );
  }

  insertProject(payload) {
    this._db
      .prepare(
        `
      INSERT INTO projects (id, name, path, port, status, thumbnail_url, start_script, build_script, pkg_manager)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        this._db.prepare(`INSERT INTO settings (id) VALUES (1)`).run();
        return { id: 1, minimize_to_tray: 0, theme_accent: '#4fde82' };
      }
      return {
        ...row,
        minimize_to_tray: row.minimize_to_tray === 1,
      };
    } catch (e) {
      console.error('VPE: getSettings failed', e);
      return {};
    }
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
}

class JsonPersistence {
  /** @param {{ storeDir: string, jsonPath: string }} paths */
  constructor(paths) {
    this._storeDir = paths.storeDir;
    this._jsonPath = paths.jsonPath;
    /** @type {{ projects: Object.<string, any>, logs: any[], logSeq: number, repairRuns: any[] }} */
    this._data = { projects: {}, logs: [], logSeq: 0, repairRuns: [] };
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
        };
      }
    } catch {
      this._data = { projects: {}, logs: [], logSeq: 0, repairRuns: [] };
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
        health_http_code: null,
        health_checked_at: null,
        health_reachable: null,
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
    return Object.values(this._data.projects).sort((a, b) =>
      String(a.name).localeCompare(String(b.name)),
    );
  }

  getProject(projectId) {
    return this._data.projects[projectId];
  }

  setProjectRunning(projectId) {
    const p = this._data.projects[projectId];
    if (p) {
      p.status = 'running';
      this.save();
    }
  }

  setProjectStopped(projectId) {
    const p = this._data.projects[projectId];
    if (p) {
      p.status = 'stopped';
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
    this.save();
  }

  insertProject(payload) {
    this._data.projects[payload.id] = {
      ...payload,
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

  db.pragma(`user_version = ${ver}`);
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

  try {
    const BetterSqlite3 = require('better-sqlite3');
    const rawDb = new BetterSqlite3(paths.sqlitePath);
    rawDb.pragma('journal_mode = WAL');
    rawDb.pragma('foreign_keys = ON');

    rawDb.exec(`
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
    `);

    msc_sqliteMigrateSchemaAndPorts(rawDb);
    msc_seedSqlite(rawDb);
    storeSingleton = new SqlitePersistence(rawDb);
    console.log('VPE persistence: SQLite (better-sqlite3)');
  } catch (err) {
    console.warn(
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

module.exports = {
  msc_createPersistentStore,
  msc_getPersistentStore,
  /** @deprecated Migrate once at boot, then archived — do not rely on cwd path */
  MSC_LEGACY_PROJECTS_JSON_PATH: LEGACY_REGISTRY,
};
