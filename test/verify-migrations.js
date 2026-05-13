'use strict';

/**
 * Phase E — migration guard: in-memory DB, same base DDL + migrate as production store.
 * Run: node test/verify-migrations.js  (or npm run test:migrations)
 */

const Database = require('better-sqlite3');
const {
  msc_sqliteApplyBaseSchema,
  msc_sqliteMigrateSchemaAndPorts,
  VPE_SQLITE_USER_VERSION,
} = require('../src/main/db/persistent-store');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const db = new Database(':memory:');
db.pragma('foreign_keys = ON');
msc_sqliteApplyBaseSchema(db);
msc_sqliteMigrateSchemaAndPorts(db);

const uv = Number(db.pragma('user_version', { simple: true }));
assert(
  uv === VPE_SQLITE_USER_VERSION,
  `user_version expected ${VPE_SQLITE_USER_VERSION}, got ${uv}`,
);

const col = (table) =>
  db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);

const projectCols = col('projects');
const expectedProjectCols = [
  'id',
  'name',
  'path',
  'port',
  'status',
  'thumbnail_url',
  'start_script',
  'build_script',
  'pkg_manager',
  'is_favorite',
  'health_http_code',
  'health_checked_at',
  'health_reachable',
  'project_type',
  'is_archived',
  'notes',
  'dev_session_started_at',
  'has_documentation',
  'sort_order',
  'display_order',
];
for (const c of expectedProjectCols) {
  assert(projectCols.includes(c), `projects missing column: ${c}`);
}

assert(
  db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='settings'`).get(),
  'settings table missing after migrations',
);
const settingsCols = col('settings');
const expectedSettingsCols = [
  'id',
  'minimize_to_tray',
  'theme_accent',
  'launch_at_login',
  'auto_start_projects',
  'default_view',
  'font_style',
  'port_range_start',
  'port_range_end',
  'auto_sync_db_on_close',
];
for (const c of expectedSettingsCols) {
  assert(settingsCols.includes(c), `settings missing column: ${c}`);
}

const logsCols = col('logs');
assert(logsCols.includes('project_id'), 'logs.project_id missing');
assert(logsCols.includes('message'), 'logs.message missing');

const repairCols = col('repair_runs');
assert(repairCols.includes('project_id'), 'repair_runs.project_id missing');
assert(repairCols.includes('files_changed'), 'repair_runs.files_changed missing');

db.close();
console.log(
  '[verify-migrations] OK user_version=%s projects_cols=%s',
  uv,
  projectCols.length,
);
