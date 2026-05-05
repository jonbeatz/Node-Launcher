const fs = require('fs');
const path = require('path');

const STORE_DIR = __dirname;
const SQLITE_PATH = path.join(STORE_DIR, 'vader.sqlite');
const JSON_STORE_PATH = path.join(STORE_DIR, 'vader-engine.json');
/** One-time migrate source; cwd file is archived to media/_vpe_archive after boot. */
const LEGACY_REGISTRY = path.join(process.cwd(), 'projects.json');

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
}

class JsonPersistence {
  constructor() {
    /** @type {{ projects: Record<string, any>, logs: any[], logSeq: number }} */
    this._data = { projects: {}, logs: [], logSeq: 0 };
  }

  load() {
    try {
      if (fs.existsSync(JSON_STORE_PATH)) {
        const raw = JSON.parse(fs.readFileSync(JSON_STORE_PATH, 'utf8'));
        this._data = {
          projects: raw.projects && typeof raw.projects === 'object' ? raw.projects : {},
          logs: Array.isArray(raw.logs) ? raw.logs : [],
          logSeq: typeof raw.logSeq === 'number' ? raw.logSeq : this._inferNextLogId(),
        };
      }
    } catch {
      this._data = { projects: {}, logs: [], logSeq: 0 };
    }
  }

  save() {
    fs.mkdirSync(STORE_DIR, { recursive: true });
    fs.writeFileSync(JSON_STORE_PATH, JSON.stringify(this._data, null, 2), 'utf8');
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
      };
    }
  }

  seedIfEmpty() {
    const ids = Object.keys(this._data.projects);
    if (ids.length > 0) return;

    this.migrateFromLegacyRegistry();

    if (Object.keys(this._data.projects).length > 0) {
      this.save();
      return;
    }

    for (const t of SEED_PROJECTS) {
      const row = rowFromTuple(t);
      this._data.projects[row.id] = row;
    }
    this.save();
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
    this._data.projects[payload.id] = { ...payload };
    this.save();
  }

  deleteProject(projectId) {
    delete this._data.projects[projectId];
    this._data.logs = this._data.logs.filter((l) => l.project_id !== projectId);
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

  fs.mkdirSync(STORE_DIR, { recursive: true });

  try {
    const BetterSqlite3 = require('better-sqlite3');
    const rawDb = new BetterSqlite3(SQLITE_PATH);
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
        pkg_manager TEXT NOT NULL DEFAULT 'npm'
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
    `);

    msc_seedSqlite(rawDb);
    storeSingleton = new SqlitePersistence(rawDb);
    console.log('VPE persistence: SQLite (better-sqlite3)');
  } catch (err) {
    console.warn(
      'VPE: SQLite unavailable (Electron/Node ABI or build tools); using JSON store.',
      err?.message ?? err,
    );
    const j = new JsonPersistence();
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
