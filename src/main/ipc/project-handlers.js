'use strict';

/** Write-protect vault trees from stray `fs.rmSync` (see `vpe-vault-rm-guard.js`). */
process.env.VPE_VAULT_DELETION_LOCKED = String(process.env.VPE_VAULT_DELETION_LOCKED || '1');

const fs = require('fs');
const os = require('os');
const path = require('path');
const { msc_normalizePersistedProjectPath, msc_validateProjectPathForSave } = require('../path-guard');
const { msc_vpePortableBackupFromStore, msc_verifyProjectPaths } = require('../db/persistent-store');
const { pathToFileURL, fileURLToPath } = require('node:url');
const { nativeImage } = require('electron');
const {
  msc_projectVaultRootDir,
  msc_projectVaultProjectDir: msc_projectVaultProjectDirFromPaths,
  msc_safeVaultFolderName,
  msc_isSafeVaultIdSegment,
  VPE_VAULT_INTERNAL_THUMB,
  msc_isVaultInternalThumbBase,
  msc_isVaultKeepFile,
  msc_isVaultNonUserNoiseFile,
} = require('../vpe-vault-paths');

/**
 * WordPress theme screenshot harvester.
 * Traverses `<wpRoot>/wp-content/themes/` and returns a `file://` URL pointing
 * to the first `screenshot.png` or `screenshot.jpg` found in any active theme folder.
 * Returns `null` if no usable screenshot is found.
 *
 * @param {string} wpRoot — absolute path to the WordPress installation root (where wp-config.php lives)
 * @returns {string | null}
 */
function msc_detectWordPressThemeScreenshot(wpRoot) {
  const themesDir = path.join(wpRoot, 'wp-content', 'themes');
  try {
    if (!fs.existsSync(themesDir) || !fs.statSync(themesDir).isDirectory()) return null;
    const entries = fs.readdirSync(themesDir, { withFileTypes: true });
    // Sort so default/active themes (commonly named first alphabetically or "twentyXX") are preferred.
    const themeDirs = entries
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const themeDir of themeDirs) {
      for (const screenshotName of ['screenshot.png', 'screenshot.jpg', 'screenshot.jpeg']) {
        const screenshotAbs = path.join(themesDir, themeDir.name, screenshotName);
        try {
          if (fs.existsSync(screenshotAbs) && fs.statSync(screenshotAbs).isFile()) {
            // Use vpe-thumb:// instead of file:// — Electron's renderer CSP blocks file: URLs
            // but allows our registered privileged vpe-thumb: scheme.
            return pathToFileURL(screenshotAbs).href.replace(/^file:/, 'vpe-thumb:');
          }
        } catch (_) {
          /* skip unreadable entry */
        }
      }
    }
  } catch (_) {
    /* fs errors are non-fatal — caller receives null */
  }
  return null;
}

/** True when `targetAbs` is a subdirectory of `approvedRootAbs` (defense-in-depth before `rmSync`). */
function msc_vpeResolvedPathInsideRoot(approvedRootAbs, targetAbs) {
  const root = path.resolve(approvedRootAbs);
  const resolved = path.resolve(targetAbs);
  const rel = path.relative(root, resolved);
  return (
    rel !== '' &&
    rel !== '.' &&
    !rel.startsWith(`..${path.sep}`) &&
    !rel.startsWith('..') &&
    !path.isAbsolute(rel)
  );
}

/** All resolved vault roots (config + cwd) so purge works when defaults diverge from `process.cwd()`. */
function msc_vpeCollectVaultRootAbsPaths() {
  /** @type {Set<string>} */
  const roots = new Set();
  try {
    roots.add(path.resolve(msc_projectVaultRootDir()));
  } catch (_) {
    /* */
  }
  try {
    roots.add(path.resolve(path.join(process.cwd(), 'media', 'vault')));
  } catch (_) {
    /* */
  }
  /** Optional alternate layout e.g. `D:\MSC-Projectz\Vault` — Windows only, if present. */
  if (process.platform === 'win32') {
    const alt = path.join('D:', 'MSC-Projectz', 'Vault');
    try {
      if (fs.existsSync(alt)) roots.add(path.resolve(alt));
    } catch (_) {
      /* */
    }
  }
  return [...roots];
}

/** @returns {string | null} matching vault root, or null */
function msc_vpePathInsideAnyVaultRoot(absTarget, vaultRoots) {
  const abs = path.resolve(absTarget);
  for (const r of vaultRoots) {
    if (msc_vpeResolvedPathInsideRoot(r, abs)) return path.resolve(r);
  }
  return null;
}

/**
 * WordPress path traversal: if the picked folder is a generic WP subdirectory
 * (e.g. "public", "app", "htdocs"), step backward to find the real project name.
 * Example: D:\TalkShowLand_v1\app\public → "talkshowlandv1"
 *
 * @param {string} filePath — absolute folder path chosen by the user
 * @returns {string} lowercase alphanumeric slug (empty string if nothing useful found)
 */
function msc_wpSiteSlugFromPath(filePath) {
  const WP_GENERIC_SUBDIRS = new Set(['public', 'app', 'htdocs', 'www', 'web', 'html']);
  let folderName = path.basename(filePath);
  if (WP_GENERIC_SUBDIRS.has(folderName.toLowerCase())) {
    const parent = path.basename(path.dirname(filePath));
    if (parent && WP_GENERIC_SUBDIRS.has(parent.toLowerCase())) {
      const grandparent = path.basename(path.dirname(path.dirname(filePath)));
      folderName = grandparent || folderName;
    } else {
      folderName = parent || folderName;
    }
  }
  return folderName.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function msc_vpeRmVaultDirLogged(absDir, projectId) {
  const abs = path.resolve(absDir);
  try {
    if (!fs.existsSync(abs)) return false;
    const st = fs.statSync(abs);
    if (!st.isDirectory()) {
      console.warn('[VPE] delete-project: skip (not a directory)', abs);
      return false;
    }
    console.log('[VPE] delete-project: vaporizing vault dir', abs);
    fs.rmSync(abs, { recursive: true, force: true });
    return true;
  } catch (e) {
    console.error('[VPE] delete-project: fs.rmSync failed', {
      projectId,
      path: abs,
      message: e && typeof e === 'object' && 'message' in e ? String(e.message) : String(e),
      stack: e && typeof e === 'object' && 'stack' in e ? String(e.stack) : undefined,
    });
    return false;
  }
}

const VPE_VAULT_IMAGE_EXTS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.bmp',
  '.ico',
]);

function msc_vpeThumbUrlFileMissing(row) {
  const tu = row && row.thumbnail_url;
  if (!tu || typeof tu !== 'string') return true;
  const isFileUrl = tu.startsWith('file:') || tu.startsWith('vpe-thumb:');
  if (!isFileUrl) return false;
  try {
    // Normalise vpe-thumb: → file: for fileURLToPath resolution
    const fp = path.resolve(fileURLToPath(tu.replace(/^vpe-thumb:/, 'file:')));
    return !fs.existsSync(fp);
  } catch (_) {
    return true;
  }
}

const VPE_DOTENV_MAX_BYTES = 512 * 1024;

/**
 * JEDI_MOD_136 — reclaimed / unlinked registry rows: missing disk root must not throw through `.env` IPC.
 * Returns a virtual `envPath` under the persisted path (read returns empty; write is blocked without toast).
 */
function msc_resolveProjectDotEnvAbs(store, projectId) {
  try {
    const row = store.getProject(projectId);
    if (!row || typeof row.path !== 'string' || !String(row.path).trim()) {
      return { ok: false, error: 'VPE: Unknown project or missing path.' };
    }
    let root;
    try {
      root = path.resolve(String(row.path).trim());
    } catch {
      return { ok: false, error: 'VPE: Invalid project path.' };
    }
    if (!fs.existsSync(root)) {
      const envPath = path.resolve(path.join(root, '.env'));
      return {
        ok: true,
        root,
        envPath,
        harmonizedMissingRoot: true,
      };
    }
    try {
      if (!fs.statSync(root).isDirectory()) {
        return { ok: false, error: 'VPE: Project path is not a directory.' };
      }
    } catch (e) {
      return { ok: false, error: e?.message ?? String(e) };
    }
    const envPath = path.resolve(path.join(root, '.env'));
    if (path.relative(root, envPath) !== '.env') {
      return { ok: false, error: 'VPE: Invalid .env location.' };
    }
    return { ok: true, root, envPath };
  } catch (e) {
    return { ok: false, error: e?.message ?? String(e) };
  }
}

function msc_vpeSortedVaultImagePathsForResync(absVaultDir) {
  /** @type {import('fs').Dirent[]} */
  let entries = [];
  try {
    entries = fs.readdirSync(absVaultDir, { withFileTypes: true });
  } catch (_) {
    return [];
  }
  const names = [];
  for (const e of entries) {
    if (!e.isFile()) continue;
    const nm = e.name;
    if (msc_isVaultInternalThumbBase(nm)) continue;
    if (msc_isVaultKeepFile(nm)) continue;
    if (msc_isVaultNonUserNoiseFile(nm)) continue;
    const ext = path.extname(nm).toLowerCase();
    if (!VPE_VAULT_IMAGE_EXTS.has(ext)) continue;
    names.push(nm);
  }
  names.sort((a, b) => a.localeCompare(b));
  return names.map((nm) => path.resolve(path.join(absVaultDir, nm)));
}

function msc_vpePickFirstLoadableVaultImage(absVaultDir) {
  for (const abs of msc_vpeSortedVaultImagePathsForResync(absVaultDir)) {
    try {
      const im = nativeImage.createFromPath(abs);
      if (!im.isEmpty()) return abs;
    } catch (_) {
      /* */
    }
  }
  return null;
}

/** Vader Protocol: deleting the registry row removes matching vault + legacy thumbnail files. */
const VPE_AUTO_VAULT_PURGE_ON_DELETE = true;

/**
 * IPC domain: project registry, CRUD, app settings, repair log, catalog, dev toggle/build.
 *
 * @typedef {import('../../renderer/types/vpe-ipc.ts').VpeProjectRow} VpeProjectRow
 * @typedef {import('../../renderer/types/vpe-ipc.ts').Project} Project
 */

/**
 * @param {import('electron').IpcMain} ipcMain
 * @param {Record<string, unknown>} c — built by `msc_registerVpeIpc` (shared IPC context).
 */
function msc_registerProjectIpc(ipcMain, c) {
  const {
    store,
    projectRunner,
    vpeRuntime,
    msc_emitProjectsUpdated,
    msc_vpeStopAllEngines,
    msc_findAvailablePort,
    msc_assertPortNotReserved,
    msc_managedPortFloor,
    MSC_VPE_RENDERER_PORT,
    msc_applyLoginStartupFromStore,
    msc_summarizeAppSettingsChanges,
    msc_summarizeProjectSettingsRowDiff,
    msc_ipcEnrichProjectsRow,
    msc_vaultDirHasUserReferenceFiles,
    msc_validateProjectPath,
    msc_validateProjectPathForSave,
    msc_detectProjectScripts,
    msc_classifyProjectType,
    msc_patchPackageJsonStripScriptPorts,
    msc_allowedShieldType,
    msc_vaultRenameProjectFolder,
    msc_remapVaultThumbAfterProjectRename,
    msc_normalizeThumbnailUrlForPersistence,
    msc_rowUsesInternalVaultThumbnail,
    msc_bumpVaultThumbPulse,
    msc_rendererVaultThumbnailHref,
    msc_writeVaultInternalThumbnail,
    VPE_SYSTEM_REPAIR_PROJECT_ID,
    VPE_CATALOG_VERSION,
    msc_rowToCatalogPayload,
    msc_safeExportBasename,
    msc_parseCatalogJson,
    msc_normalizeCatalogProjectType,
    msc_normalizeCatalogArchived,
    fs,
    path,
    process,
    app,
    BrowserWindow,
    dialog,
    randomUUID,
  } = c;

  ipcMain.handle('vpe:get-app-settings', () => {
    try {
      return typeof store.getSettings === 'function' ? store.getSettings() : {};
    } catch (e) {
      console.warn('[VPE ERROR]', 'get-app-settings', e?.message ?? e);
      return {};
    }
  });

  ipcMain.handle('vpe:update-app-settings', (_evt, payload) => {
    if (!payload || typeof payload !== 'object') {
      throw new Error('VPE: Invalid app settings payload.');
    }
    if (typeof store.updateAppSettings !== 'function') {
      throw new Error('VPE: updateAppSettings not available on store.');
    }
    const before =
      typeof store.getSettings === 'function' ? store.getSettings() : {};
    const next = store.updateAppSettings(payload);
    msc_applyLoginStartupFromStore(store);
    const changeSummary = msc_summarizeAppSettingsChanges(before, next, payload);
    return { ok: true, settings: next, changeSummary };
  });

  ipcMain.handle('vpe:update-setting-launch-startup', (_evt, value) => {
    const v =
      value === true ||
      value === 1 ||
      value === '1' ||
      String(value).toLowerCase() === 'true';
    if (typeof store.updateAppSettings !== 'function') {
      throw new Error('VPE: updateAppSettings not available on store.');
    }
    const before =
      typeof store.getSettings === 'function' ? store.getSettings() : {};
    const next = store.updateAppSettings({ launch_at_login: v });
    msc_applyLoginStartupFromStore(store);
    const changeSummary = msc_summarizeAppSettingsChanges(before, next, {
      launch_at_login: v,
    });
    return { ok: true, settings: next, changeSummary };
  });

  // `listProjectsAlphabetical` orders by `display_order` (SQLite v17+) then `id` — backups include manual order.
  ipcMain.handle('vpe:getProjects', () =>
    store.listProjectsAlphabetical().map((row) => {
      const enriched = msc_ipcEnrichProjectsRow(row);
      return {
        ...enriched,
        vault_has_files: msc_vaultDirHasUserReferenceFiles(row.name, row.id),
      };
    }),
  );

  ipcMain.handle('vpe:reorder-project', (_evt, payload) => {
    if (!payload || typeof payload !== 'object') {
      return { ok: false, error: 'invalid_payload' };
    }
    const projectId = payload.projectId != null ? String(payload.projectId) : '';
    const direction = payload.direction === 'down' ? 'down' : payload.direction === 'up' ? 'up' : '';
    if (!projectId || (direction !== 'up' && direction !== 'down')) {
      return { ok: false, error: 'invalid_args' };
    }
    if (typeof store.reorderProjectNeighbor !== 'function') {
      return { ok: false, error: 'unsupported_store' };
    }
    const result = store.reorderProjectNeighbor(projectId, direction);
    if (!result.ok) return result;
    try {
      const settings = typeof store.getSettings === 'function' ? store.getSettings() : {};
      const syncOn =
        settings.auto_sync_db_on_close === true ||
        settings.auto_sync_db_on_close === 1 ||
        String(settings.auto_sync_db_on_close).toLowerCase() === 'true';
      if (syncOn) {
        const cwd = typeof process.cwd === 'function' ? process.cwd() : '.';
        const b = msc_vpePortableBackupFromStore(store, cwd);
        if (!b.ok) {
          console.warn('[VPE] reorder auto-sync backup failed:', b.error);
        }
      }
    } catch (e) {
      console.warn('[VPE] reorder auto-sync', e?.message ?? e);
    }
    msc_emitProjectsUpdated();
    return { ok: true };
  });

  ipcMain.handle('vpe:update-project-order', (_evt, payload) => {
    if (!Array.isArray(payload)) {
      return { ok: false, error: 'invalid_payload' };
    }
    const updates = [];
    for (const item of payload) {
      if (!item || typeof item !== 'object') continue;
      const id = item.id != null ? String(item.id) : '';
      if (!id) continue;
      const display_order = Number(item.display_order);
      if (!Number.isFinite(display_order)) continue;
      updates.push({ id, display_order: Math.floor(display_order) });
    }
    if (!updates.length) {
      return { ok: false, error: 'empty_updates' };
    }
    if (typeof store.updateProjectsDisplayOrder !== 'function') {
      return { ok: false, error: 'unsupported_store' };
    }
    const result = store.updateProjectsDisplayOrder(updates);
    if (!result.ok) return result;
    try {
      const settings = typeof store.getSettings === 'function' ? store.getSettings() : {};
      const syncOn =
        settings.auto_sync_db_on_close === true ||
        settings.auto_sync_db_on_close === 1 ||
        String(settings.auto_sync_db_on_close).toLowerCase() === 'true';
      if (syncOn) {
        const cwd = typeof process.cwd === 'function' ? process.cwd() : '.';
        const b = msc_vpePortableBackupFromStore(store, cwd);
        if (!b.ok) {
          console.warn('[VPE] update-project-order auto-sync backup failed:', b.error);
        }
      }
    } catch (e) {
      console.warn('[VPE] update-project-order auto-sync', e?.message ?? e);
    }
    msc_emitProjectsUpdated();
    return { ok: true };
  });

  ipcMain.handle('vpe:get-repair-runs', (_event, limit) => {
    const n = Number(limit);
    return typeof store.listRepairRunsDesc === 'function'
      ? store.listRepairRunsDesc(Number.isFinite(n) && n > 0 ? n : 200)
      : [];
  });

  ipcMain.handle('vpe:record-repair-run', (_event, payload) => {
    if (!payload || typeof payload !== 'object') {
      throw new Error('VPE: Invalid repair payload');
    }
    const projectId = payload.projectId != null ? String(payload.projectId) : '';
    if (!projectId) throw new Error('VPE: Missing project id');
    const row =
      projectId === VPE_SYSTEM_REPAIR_PROJECT_ID ? null : store.getProject(projectId);
    if (projectId !== VPE_SYSTEM_REPAIR_PROJECT_ID && !row) {
      throw new Error('VPE: Project not found');
    }
    const name =
      projectId === VPE_SYSTEM_REPAIR_PROJECT_ID
        ? typeof payload.projectName === 'string' && payload.projectName.trim()
          ? payload.projectName.trim()
          : 'VPE System'
        : typeof payload.projectName === 'string' && payload.projectName.trim()
          ? payload.projectName.trim()
          : String(row.name);
    const st = payload.status;
    const status =
      st === 'partial' || st === 'failed' || st === 'success' ? st : 'success';
    const desc =
      typeof payload.description === 'string' && payload.description.trim()
        ? payload.description.trim()
        : 'Repair apply';
    let files = Number(payload.filesChanged);
    if (!Number.isFinite(files) || files < 0) files = 0;
    const id = randomUUID();
    const created_at = new Date().toISOString();
    store.insertRepairRun({
      id,
      project_id: projectId,
      project_name: name,
      created_at,
      status,
      description: desc,
      files_changed: Math.round(files),
    });
    return { ok: true, id };
  });

  ipcMain.handle('vpe:auto-fix-port', async (_event, projectId) => {
    if (!projectId) throw new Error('VPE: Missing project id');
    const row = store.getProject(projectId);
    if (!row) throw new Error('VPE: Project not found');

    const root = msc_normalizePersistedProjectPath(row.path);
    const det = msc_detectProjectScripts(root);
    const newPort = await msc_findAvailablePort(msc_managedPortFloor(), projectId, det.is_nextjs);

    store.updateProject({
      id: row.id,
      name: row.name,
      path: root,
      port: msc_assertPortNotReserved(newPort),
      thumbnail_url: row.thumbnail_url ?? null,
      start_script: det.start_script,
      build_script: det.build_script,
      pkg_manager: det.pkg_manager,
      project_type: row.project_type ?? null,
      is_archived:
        row.is_archived === true ||
        row.is_archived === 1,
      notes: row.notes == null || typeof row.notes === 'undefined' ? null : String(row.notes),
    });
    msc_emitProjectsUpdated();
    return { ok: true, port: newPort, start_script: det.start_script };
  });

  /** Vault thumbnail recovery + JEDI_MOD_29 registry path audit (`path` workspace roots). */
  ipcMain.handle('vpe:repair-vault-links', async () => {
    const pathCheck = msc_verifyProjectPaths(store);
    if (typeof store.listProjectsAlphabetical !== 'function') {
      return { ok: true, repaired: 0, skipped: 0, errors: [], pathCheck };
    }
    const rows = store.listProjectsAlphabetical();
    let repaired = 0;
    let skipped = 0;
    const errors = [];

    for (const row of rows) {
      if (!row?.id || row.name == null || String(row.name).trim() === '') {
        skipped += 1;
        continue;
      }
      try {
        const vaultDir = path.resolve(
          msc_projectVaultProjectDirFromPaths(String(row.name), row.id),
        );
        if (!fs.existsSync(vaultDir) || !fs.statSync(vaultDir).isDirectory()) {
          skipped += 1;
          continue;
        }
        const internalAbs = path.resolve(path.join(vaultDir, VPE_VAULT_INTERNAL_THUMB));
        const internalExists = fs.existsSync(internalAbs);
        const linkBroken = msc_vpeThumbUrlFileMissing(row);
        if (internalExists && !linkBroken) {
          skipped += 1;
          continue;
        }
        if (!internalExists) {
          const src = msc_vpePickFirstLoadableVaultImage(vaultDir);
          if (!src) {
            skipped += 1;
            continue;
          }
          await msc_writeVaultInternalThumbnail(src, String(row.name), row.id);
        }
        if (!fs.existsSync(internalAbs)) {
          skipped += 1;
          continue;
        }
        const href = pathToFileURL(internalAbs).href;
        const thumbPersist = msc_normalizeThumbnailUrlForPersistence(row, href);
        const pt =
          row.project_type == null || String(row.project_type).trim() === ''
            ? null
            : String(row.project_type).trim();
        store.updateProject({
          id: row.id,
          name: row.name,
          path: row.path,
          port: row.port,
          thumbnail_url: thumbPersist ?? href,
          start_script: row.start_script,
          build_script: row.build_script,
          pkg_manager: row.pkg_manager,
          project_type: pt,
          is_archived: row.is_archived === true || row.is_archived === 1,
          notes: row.notes != null ? String(row.notes) : null,
        });
        msc_bumpVaultThumbPulse(row.id, Date.now());
        repaired += 1;
      } catch (e) {
        errors.push({
          id: row.id,
          message: e && typeof e === 'object' && 'message' in e ? String(e.message) : String(e),
        });
      }
    }
    msc_emitProjectsUpdated();
    return { ok: true, repaired, skipped, errors, pathCheck };
  });

  ipcMain.handle('vpe:reindex-project-display-order', () => {
    if (typeof store.reindexProjectsDisplayOrder !== 'function') {
      return { ok: false, error: 'unsupported_store' };
    }
    const r = store.reindexProjectsDisplayOrder();
    msc_emitProjectsUpdated();
    return r;
  });

  ipcMain.handle('vpe:inspect-project', async (_event, projectPath) => {
    const saveVal = msc_validateProjectPathForSave(projectPath);
    const root = saveVal.path;

    // WordPress-Local detection: check for wp-config.php before any Node.js detection.
    let is_wordpress = false;
    try {
      is_wordpress = fs.existsSync(path.join(root, 'wp-config.php'));
    } catch { /* ignore FS errors */ }

    const det = saveVal.hasFullNodeProject
      ? msc_detectProjectScripts(root)
      : {
          pkg_manager: 'npm',
          start_script: 'dev',
          build_script: 'build',
          is_nextjs: false,
          node_modules_missing: true,
        };
    const project_type = is_wordpress
      ? 'wordpress-local'
      : saveVal.hasFullNodeProject
        ? msc_classifyProjectType(root)
        : 'unknown';

    // Auto-derive a `.local` domain from the real project folder name for WordPress sites.
    // Uses msc_wpSiteSlugFromPath to step back out of generic subdirectories like "public"
    // or "app" — prevents the fallback "public.local" bug when the user selects app/public.
    let suggested_url = null;
    let suggested_slug = null;
    let suggested_thumbnail = null;
    if (is_wordpress) {
      const domainSlug = msc_wpSiteSlugFromPath(root);
      if (domainSlug) {
        // Use http:// — LocalWP self-signed certs cause ERR_CONNECTION_REFUSED in real browsers.
        // The Local Nginx proxy handles SSL redirect internally when configured for SSL.
        suggested_url = `http://${domainSlug}.local/`;
        suggested_slug = domainSlug;
      }
      // Harvest the active theme screenshot as the card thumbnail.
      suggested_thumbnail = msc_detectWordPressThemeScreenshot(root);
    }

    const suggestedPort = await msc_findAvailablePort(
      msc_managedPortFloor(),
      null,
      Boolean(det.is_nextjs),
    );
    return {
      ok: true,
      path: root,
      detection: det,
      project_type,
      suggestedPort,
      reservedPort: MSC_VPE_RENDERER_PORT,
      reclaimWarnings: saveVal.reclaimWarnings,
      is_wordpress,
      suggested_url,
      suggested_slug,
      /** file:// URL to the active theme screenshot.png (null when none found). */
      suggested_thumbnail,
    };
  });

  ipcMain.handle('vpe:getLogs', (event, projectId) => {
    if (!projectId) return [];
    return store.logsForProjectDesc(projectId, 100);
  });

  ipcMain.handle('vpe:get-unified-logs', (_event, limit) => {
    const n = Number(limit);
    const cap = Number.isFinite(n) && n > 0 ? Math.min(n, 800) : 300;
    return typeof store.logsRecentAll === 'function'
      ? store.logsRecentAll(cap)
      : [];
  });

  ipcMain.handle('vpe:patch-start-script', async (_event, projectId) => {
    if (!projectId) throw new Error('VPE: Missing project id');
    const row = store.getProject(projectId);
    if (!row) throw new Error('VPE: Project not found');
    const root = msc_validateProjectPath(row.path);
    const scriptName = (row.start_script || 'dev').toString();
    const { previous, next, backupPath } = msc_patchPackageJsonStripScriptPorts(
      root,
      scriptName,
    );
    msc_emitProjectsUpdated();
    return { ok: true, previous, next, backupPath, scriptName };
  });

  /**
   * Start/stop managed dev. v1.2.3+: missing `node_modules` + `package.json` runs shell
   * `install && run <start_script>` inside `project-runner` (not `vpe:execute-terminal-command`).
   * Install bootstrap delays first HTTP health probe to **10s** so the UI/Open flow is not starved.
   */
  ipcMain.handle('vpe:toggle-status', async (event, projectId) =>
    projectRunner.toggleStatus(projectId),
  );

  ipcMain.handle('vpe:run-build', async (event, projectId) =>
    projectRunner.runBuild(projectId),
  );

  ipcMain.handle('vpe:save-settings', async (event, payload) => {
    const {
      id,
      name,
      path: projectPath,
      port,
      start_script,
      build_script,
      thumbnail_url,
      project_type: projectTypeIncoming,
      project_url: projectUrlIncoming,
      slug: slugIncoming,
    } = payload;
    if (!id) throw new Error('VPE: Missing project id');

    const existingRow = typeof store.getProject === 'function' ? store.getProject(id) : null;

    /** JEDI_MOD_133 — sovereign save: persist path/thumbnail/name with no disk or package.json gate (vault guard only). */
    const root = msc_normalizePersistedProjectPath(projectPath);
    const start = (start_script || existingRow?.start_script || 'dev').toString();
    const build = (build_script || existingRow?.build_script || 'build').toString();
    const pkg_manager =
      existingRow && existingRow.pkg_manager != null && String(existingRow.pkg_manager).trim()
        ? String(existingRow.pkg_manager).trim()
        : 'npm';
    const det = {
      start_script: start,
      build_script: build,
      pkg_manager,
      is_nextjs: false,
      node_modules_missing: true,
    };

    let project_type = undefined;
    if (Object.prototype.hasOwnProperty.call(payload, 'project_type')) {
      if (
        projectTypeIncoming == null ||
        String(projectTypeIncoming).trim() === '' ||
        String(projectTypeIncoming).trim().toLowerCase() === 'auto'
      ) {
        project_type = null;
      } else {
        const cand = String(projectTypeIncoming).trim().toLowerCase();
        project_type = msc_allowedShieldType(cand) ? cand : null;
      }
    }

    let is_archived = undefined;
    if (Object.prototype.hasOwnProperty.call(payload, 'is_archived')) {
      const v = payload.is_archived;
      is_archived = v === true || v === 1;
    }

    let notes = undefined;
    if (Object.prototype.hasOwnProperty.call(payload, 'notes')) {
      const n = payload.notes;
      notes = n == null ? null : String(n);
    }

    const hasThumbPayload = Object.prototype.hasOwnProperty.call(payload, 'thumbnail_url');
    let savedThumbnail = hasThumbPayload ? thumbnail_url : existingRow?.thumbnail_url ?? null;

    if (existingRow && String(existingRow.name) !== String(name)) {
      try {
        msc_vaultRenameProjectFolder(existingRow.name, name);
      } catch (e) {
        console.warn(
          '[VPE]',
          'vault folder rename on project name change',
          e && typeof e === 'object' && 'message' in e ? String(e.message) : String(e),
        );
      }
      savedThumbnail = msc_remapVaultThumbAfterProjectRename(
        savedThumbnail,
        existingRow.name,
        name,
      );
    }

    // Stage file:// URLs and raw local paths to vault before normalization —
    // mirrors the same guard in vpe:add-project so thumbnails supplied
    // programmatically or from an agent always resolve via vpe-vault://.
    if (hasThumbPayload && savedThumbnail && typeof savedThumbnail === 'string' &&
        !savedThumbnail.startsWith('vpe-vault:') &&
        !savedThumbnail.startsWith('vpe-thumb:') &&
        !savedThumbnail.startsWith('data:') &&
        !savedThumbnail.startsWith('http')) {
      try {
        let srcFilePath = null;
        if (savedThumbnail.startsWith('file:')) {
          srcFilePath = fileURLToPath(savedThumbnail.replace(/^file:\/\/localhost\//i, 'file:///'));
        } else if (/^[A-Za-z]:[/\\]/.test(savedThumbnail) || savedThumbnail.startsWith('\\\\')) {
          srcFilePath = savedThumbnail;
        } else if (savedThumbnail.startsWith('/')) {
          srcFilePath = savedThumbnail;
        }
        if (srcFilePath && fs.existsSync(srcFilePath)) {
          const vaultResult = await msc_writeVaultInternalThumbnail(srcFilePath, name, id);
          if (vaultResult && vaultResult.url) {
            savedThumbnail = vaultResult.url;
            console.log(`[VPE] save-settings: thumbnail staged to vault → ${savedThumbnail}`);
          }
        }
      } catch (e) {
        console.warn('[VPE] save-settings: file-path thumbnail vault staging failed:', e?.message ?? e);
      }
    }

    if (hasThumbPayload && savedThumbnail != null && typeof savedThumbnail === 'string') {
      savedThumbnail = msc_normalizeThumbnailUrlForPersistence(
        { id, name },
        savedThumbnail,
      );
    }

    let project_url = undefined;
    if (Object.prototype.hasOwnProperty.call(payload, 'project_url')) {
      project_url = projectUrlIncoming == null ? null : String(projectUrlIncoming).trim() || null;
    }
    let slug = undefined;
    if (Object.prototype.hasOwnProperty.call(payload, 'slug')) {
      slug = slugIncoming == null ? null : String(slugIncoming).trim() || null;
    }

    store.updateProject({
      id,
      name,
      path: root,
      port: msc_assertPortNotReserved(port),
      thumbnail_url: savedThumbnail ?? null,
      start_script: start,
      build_script: build,
      pkg_manager: det.pkg_manager,
      ...(project_type !== undefined ? { project_type } : {}),
      ...(is_archived !== undefined ? { is_archived } : {}),
      ...(notes !== undefined ? { notes } : {}),
      ...(project_url !== undefined ? { project_url } : {}),
      ...(slug !== undefined ? { slug } : {}),
    });
    const updatedRow =
      typeof store.getProject === 'function' ? store.getProject(id) : null;
    const changeSummary = msc_summarizeProjectSettingsRowDiff(existingRow, updatedRow);
    let thumbnail_url_for_renderer = null;
    if (updatedRow) {
      if (msc_rowUsesInternalVaultThumbnail(updatedRow)) {
        msc_bumpVaultThumbPulse(id, Date.now());
        const again =
          typeof store.getProject === 'function' ? store.getProject(id) : updatedRow;
        thumbnail_url_for_renderer = msc_rendererVaultThumbnailHref(again);
      } else {
        thumbnail_url_for_renderer =
          updatedRow.thumbnail_url != null ? String(updatedRow.thumbnail_url) : null;
      }
    }
    msc_emitProjectsUpdated();
    return {
      ok: true,
      detection: det,
      thumbnail_url_for_renderer,
      changeSummary,
      reclaimWarnings: [],
    };
  });

  ipcMain.handle('vpe:add-project', async (event, payload) => {
    // Read project_type FIRST — WordPress-Local sites have no package.json and must
    // bypass the Node project validator entirely.
    const incomingTypeRaw = Object.prototype.hasOwnProperty.call(payload, 'project_type')
      ? String(payload.project_type ?? '').trim().toLowerCase()
      : '';
    const isWordPressLocal = incomingTypeRaw === 'wordpress-local';

    let root;
    let det;

    if (isWordPressLocal) {
      // WordPress-Local path: vault / vpe-local-data guards apply; package.json is NOT required.
      const saveVal = msc_validateProjectPathForSave(payload.path);
      root = saveVal.path;
      // Stub Node detection — WP sites are launched via local.exe, not npm scripts.
      det = { start_script: '', build_script: '', pkg_manager: 'npm', is_nextjs: false };
    } else {
      // Standard Node / Electron / Web path: full package.json + vault guards enforced.
      root = msc_validateProjectPath(payload.path);
      det = msc_detectProjectScripts(root);
    }

    const id = payload.id || randomUUID();

    // ── Duplicate path guard ──────────────────────────────────────────────────
    // Prevent registering a project whose resolved path is already in the catalog.
    // This avoids port / config collisions between projects that point to the same
    // workspace directory.
    if (root) {
      const normalizedRoot = root.replace(/\\/g, '/').toLowerCase().replace(/\/$/, '');
      const existingProjects = typeof store.getProjects === 'function' ? store.getProjects() : [];
      const duplicate = existingProjects.find((p) => {
        if (!p.path) return false;
        const n = String(p.path).replace(/\\/g, '/').toLowerCase().replace(/\/$/, '');
        return n === normalizedRoot;
      });
      if (duplicate) {
        // Return a structured response instead of throwing so the renderer
        // can display a user-friendly toast without the ugly
        // "Error invoking remote method" Electron IPC prefix.
        return {
          ok: false,
          code: 'DUPLICATE_PATH',
          error: `"${duplicate.name}" already uses this directory. Each workspace path can only be registered once — choose a different folder or edit the existing project.`,
          duplicate: {
            id: duplicate.id,
            name: duplicate.name,
            path: duplicate.path,
          },
        };
      }
    }

    // ── Port collision guard ──────────────────────────────────────────────────
    // If the caller supplies a port, check it doesn't collide with any existing
    // project. If it does (or is the renderer port), auto-assign a free one.
    const rawPort = payload.port;
    let portNum;
    if (rawPort != null && Number.isFinite(Number(rawPort))) {
      const requestedPort = Number(rawPort);
      const allPorts = new Set(
        (typeof store.getProjects === 'function' ? store.getProjects() : [])
          .map((p) => Number(p.port))
          .filter((n) => Number.isFinite(n) && n > 0),
      );
      if (allPorts.has(requestedPort) || requestedPort === msc_managedPortFloor() - 1) {
        // Requested port is already taken — find a free one instead.
        portNum = await msc_findAvailablePort(msc_managedPortFloor(), id, det.is_nextjs);
        console.warn(
          `[VPE] add-project: requested port ${requestedPort} already in use — reassigned to ${portNum}`,
        );
      } else {
        portNum = requestedPort;
      }
    } else {
      portNum = await msc_findAvailablePort(msc_managedPortFloor(), id, det.is_nextjs);
    }

    let project_type = undefined;
    if (Object.prototype.hasOwnProperty.call(payload, 'project_type')) {
      const incoming = payload.project_type;
      if (
        incoming == null ||
        String(incoming).trim() === '' ||
        String(incoming).trim().toLowerCase() === 'auto'
      ) {
        project_type = null;
      } else {
        const cand = String(incoming).trim().toLowerCase();
        project_type = msc_allowedShieldType(cand) ? cand : null;
      }
    }

    // Auto-harvest WordPress theme screenshot when no thumbnail was provided by the user.
    let resolvedThumbUrl = payload.thumbnail_url ?? null;
    if (isWordPressLocal && (!resolvedThumbUrl || typeof resolvedThumbUrl !== 'string' || !resolvedThumbUrl.trim())) {
      resolvedThumbUrl = msc_detectWordPressThemeScreenshot(root);
    }

    // ── Thumbnail staging: route ANY local image source through the vault ────
    // The renderer runs in Chromium's sandbox which blocks raw `file://` URLs for
    // external assets. All thumbnails must be copied into `media/vault/<name>/`
    // and referenced via the `vpe-vault://` custom protocol.
    //
    // IMPORTANT: msc_writeVaultInternalThumbnail returns a `file://` URL pointing
    // into the vault.  Branch B must NOT treat that as a new external source —
    // doing so would pass the vault path as both src and dest (ENOENT self-copy).
    // We guard this with `thumbAlreadyVaulted` set to true after any vault write.
    let thumbAlreadyVaulted = false;

    // Branch A: `data:image/` base64 preview (from the Add Project modal's
    //           pickThumbnail — the vault URL isn't available before the project
    //           is inserted, so the modal passes a base64 blob).
    if (resolvedThumbUrl && typeof resolvedThumbUrl === 'string' && resolvedThumbUrl.startsWith('data:image/')) {
      try {
        const b64Match = resolvedThumbUrl.match(/^data:image\/(\w+);base64,(.+)$/s);
        if (b64Match) {
          const ext = b64Match[1] === 'jpeg' ? 'jpg' : (b64Match[1] || 'png');
          const tmpPath = path.join(os.tmpdir(), `vpe-draft-thumb-${id}.${ext}`);
          fs.writeFileSync(tmpPath, Buffer.from(b64Match[2], 'base64'));
          try {
            const vaultResult = await msc_writeVaultInternalThumbnail(tmpPath, payload.name, id);
            const vaultFile = vaultResult && vaultResult.file ? vaultResult.file : vaultResult;
            const vaultUrl = vaultResult && vaultResult.url
              ? vaultResult.url
              : pathToFileURL(String(vaultFile)).href;
            resolvedThumbUrl = (typeof vaultUrl === 'string' && vaultUrl) ? vaultUrl : null;
            thumbAlreadyVaulted = true; // image is now in vault — Branch B must skip
          } finally {
            try { fs.unlinkSync(tmpPath); } catch (_) { /* ignore temp-file cleanup errors */ }
          }
        } else {
          resolvedThumbUrl = null;
        }
      } catch (e) {
        console.warn('[VPE] add-project: draft thumbnail decode failed:', e?.message ?? e);
        resolvedThumbUrl = null;
      }
    }

    // Branch B: `file://` URL or raw Windows/POSIX absolute path supplied
    //           programmatically (e.g. via vpeAPI.addProject from an agent or
    //           power-user script). Copy the source image into the vault so
    //           Chromium can serve it through the vpe-vault:// protocol handler.
    //           Skip if Branch A already vaulted the image.
    if (!thumbAlreadyVaulted &&
        resolvedThumbUrl && typeof resolvedThumbUrl === 'string' &&
        !resolvedThumbUrl.startsWith('vpe-vault:') &&
        !resolvedThumbUrl.startsWith('vpe-thumb:') &&
        !resolvedThumbUrl.startsWith('data:') &&
        !resolvedThumbUrl.startsWith('http')) {
      try {
        let srcFilePath = null;
        if (resolvedThumbUrl.startsWith('file:')) {
          // file:///C:/... or file://localhost/C:/...
          srcFilePath = fileURLToPath(resolvedThumbUrl.replace(/^file:\/\/localhost\//i, 'file:///'));
        } else if (/^[A-Za-z]:[/\\]/.test(resolvedThumbUrl) || resolvedThumbUrl.startsWith('\\\\')) {
          // Raw Windows absolute path e.g. C:\Users\...\mytest.jpg
          srcFilePath = resolvedThumbUrl;
        } else if (resolvedThumbUrl.startsWith('/')) {
          // POSIX absolute path
          srcFilePath = resolvedThumbUrl;
        }
        if (srcFilePath && fs.existsSync(srcFilePath)) {
          const vaultResult = await msc_writeVaultInternalThumbnail(srcFilePath, payload.name, id);
          if (vaultResult && vaultResult.url) {
            resolvedThumbUrl = vaultResult.url;
            thumbAlreadyVaulted = true;
            console.log(`[VPE] add-project: thumbnail staged to vault → ${resolvedThumbUrl}`);
          }
        } else if (srcFilePath) {
          console.warn(`[VPE] add-project: thumbnail source not found, skipping: ${srcFilePath}`);
          resolvedThumbUrl = null;
        }
      } catch (e) {
        console.warn('[VPE] add-project: file-path thumbnail vault staging failed:', e?.message ?? e);
        resolvedThumbUrl = null;
      }
    }

    const thumbNorm = msc_normalizeThumbnailUrlForPersistence(
      { id, name: payload.name },
      resolvedThumbUrl,
    );

    store.insertProject({
      id,
      name: payload.name,
      path: root,
      port: msc_assertPortNotReserved(portNum),
      status: 'stopped',
      thumbnail_url: thumbNorm ?? null,
      start_script: det.start_script,
      build_script: det.build_script,
      pkg_manager: det.pkg_manager,
      ...(project_type !== undefined ? { project_type } : {}),
      ...(payload.project_url != null ? { project_url: String(payload.project_url) } : {}),
      ...(payload.slug != null ? { slug: String(payload.slug) } : {}),
    });
    msc_emitProjectsUpdated();
    return { ok: true, id };
  });

  ipcMain.handle('vpe:delete-project', (event, projectId) => {
    global.__vpeVaultHardDeleteActive = true;
    try {
      if (!projectId) throw new Error('VPE: Missing project id');
      const id = String(projectId);
      const row = typeof store.getProject === 'function' ? store.getProject(id) : null;
      projectRunner.stopProject(projectId);
      store.deleteProject(projectId);

      let filesPurged = false;

      if (row && VPE_AUTO_VAULT_PURGE_ON_DELETE) {
        try {
          const vaultRoots = msc_vpeCollectVaultRootAbsPaths();
          /** Canonical + per-root name/id leaves (handles hardcoded `d:` default vs `cwd` vault). */
          const vaultCandidates = new Set();
          try {
            vaultCandidates.add(
              path.resolve(msc_projectVaultProjectDirFromPaths(String(row.name), row.id)),
            );
          } catch (_) {
            /* */
          }
          for (const vr of vaultRoots) {
            const rootAbs = path.resolve(vr);
            vaultCandidates.add(path.resolve(path.join(rootAbs, msc_safeVaultFolderName(String(row.name)))));
            if (msc_isSafeVaultIdSegment(id)) {
              vaultCandidates.add(path.resolve(path.join(rootAbs, id)));
            }
          }

          let vaultRmAny = false;
          for (const candidate of vaultCandidates) {
            const abs = path.resolve(candidate);
            const matchedRoot = msc_vpePathInsideAnyVaultRoot(abs, vaultRoots);
            if (!matchedRoot) {
              console.warn('[VPE] delete-project: skipped path (not under any vault root)', abs, {
                vaultRoots,
              });
              continue;
            }
            if (msc_vpeRmVaultDirLogged(abs, id)) {
              vaultRmAny = true;
              filesPurged = true;
            }
          }
          if (vaultRmAny) {
            console.log(`[VPE] Vault Purge Complete for Project: ${id}`);
          }

          /** Legacy flat thumbnails (pre–Omni-Vault): `media/thumbnails/<uuid>.(jpg|png|…)`. */
          const legacyThumbExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
          const allowedThumbRoots = new Set();
          allowedThumbRoots.add(path.resolve(path.join(process.cwd(), 'media', 'thumbnails')));
          try {
            if (typeof app?.getPath === 'function') {
              allowedThumbRoots.add(
                path.resolve(path.join(app.getPath('userData'), 'media', 'thumbnails')),
              );
            }
          } catch (_) {
            /* */
          }
          for (const thumbsRoot of allowedThumbRoots) {
            if (!thumbsRoot || !fs.existsSync(thumbsRoot)) continue;
            const rootResolved = path.resolve(thumbsRoot);
            for (const ext of legacyThumbExts) {
              const filePath = path.resolve(path.join(rootResolved, `${id}${ext}`));
              if (!msc_vpeResolvedPathInsideRoot(rootResolved, filePath)) continue;
              if (!fs.existsSync(filePath)) continue;
              try {
                fs.rmSync(filePath, { force: true });
                filesPurged = true;
              } catch (e) {
                console.error('[VPE] delete-project: legacy thumbnail rmSync failed', {
                  path: filePath,
                  message: e && typeof e === 'object' && 'message' in e ? String(e.message) : String(e),
                });
              }
            }
          }
        } catch (e) {
          console.warn('[VPE] Vault purge on delete failed:', e?.message ?? e);
        }
      }

      msc_emitProjectsUpdated();
      return { ok: true, success: true, filesPurged };
    } finally {
      global.__vpeVaultHardDeleteActive = false;
    }
  });

  ipcMain.handle('vpe:catalog-export', async (event, opts) => {
    const scope = opts && opts.scope === 'single' ? 'single' : 'full';
    const projectId = opts?.projectId != null ? String(opts.projectId) : '';
    let rows;
    if (scope === 'single') {
      if (!projectId) throw new Error('VPE: Select a project to export.');
      const row = store.getProject(projectId);
      if (!row) throw new Error('VPE: Project not found.');
      rows = [msc_rowToCatalogPayload(row)];
    } else {
      rows = store.listProjectsAlphabetical().map(msc_rowToCatalogPayload);
    }
    const payload = {
      vpe_catalog_version: VPE_CATALOG_VERSION,
      exported_at: new Date().toISOString(),
      scope,
      projects: rows,
    };
    const win =
      BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getFocusedWindow();
    const defaultName =
      scope === 'single' && rows[0]
        ? `vpe-project-${msc_safeExportBasename(rows[0].name)}.json`
        : 'vpe-projects-catalog.json';
    const { canceled, filePath } = await dialog.showSaveDialog(win || undefined, {
      title: 'Export project catalog',
      defaultPath: defaultName,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (canceled || !filePath) return { ok: false, canceled: true };
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
    return { ok: true, path: filePath };
  });

  ipcMain.handle('vpe:catalog-import', async (event, opts) => {
    const mode = opts && opts.mode === 'replace' ? 'replace' : 'merge';
    const win =
      BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getFocusedWindow();
    const { canceled, filePaths } = await dialog.showOpenDialog(win || undefined, {
      title: 'Import project catalog',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (canceled || !filePaths?.[0]) return { ok: false, canceled: true };

    const text = fs.readFileSync(filePaths[0], 'utf8');
    const catalogProjects = msc_parseCatalogJson(text);
    if (mode === 'replace') {
      await msc_vpeStopAllEngines();
      if (typeof store.clearEntireRegistry !== 'function') {
        throw new Error('VPE: Store does not support registry reset.');
      }
      store.clearEntireRegistry();
    }

    const errors = [];
    let imported = 0;
    for (const raw of catalogProjects) {
      try {
        const id = raw.id != null ? String(raw.id) : randomUUID();
        const name = String(raw.name || 'Project').trim() || 'Project';
        const root = msc_validateProjectPath(raw.path);
        const det = msc_detectProjectScripts(root);
        let portNum = Number(raw.port);
        if (!Number.isFinite(portNum) || portNum <= 0) {
          // eslint-disable-next-line no-await-in-loop
          portNum = await msc_findAvailablePort(msc_managedPortFloor(), id, det.is_nextjs);
        }
        portNum = msc_assertPortNotReserved(portNum);
        const rawPm = String(raw.pkg_manager || '').toLowerCase();
        const pkg_manager =
          rawPm === 'yarn' || rawPm === 'pnpm' || rawPm === 'npm' ? rawPm : det.pkg_manager;
        const start_script = String(raw.start_script || det.start_script || 'dev');
        const build_script = String(raw.build_script || det.build_script || 'build');
        const thumbnail_url =
          raw.thumbnail_url === undefined || raw.thumbnail_url === null
            ? null
            : String(raw.thumbnail_url);
        const catPt = msc_normalizeCatalogProjectType(raw.project_type);
        const catArchived =
          raw.is_archived === undefined
            ? undefined
            : msc_normalizeCatalogArchived(raw.is_archived);
        let catNotes = undefined;
        if (Object.prototype.hasOwnProperty.call(raw, 'notes')) {
          const nv = raw.notes;
          catNotes = nv == null ? null : String(nv);
        }

        const existing = store.getProject(id);
        if (mode === 'merge' && existing) {
          const base = {
            id,
            name,
            path: root,
            port: portNum,
            thumbnail_url,
            start_script,
            build_script,
            pkg_manager,
          };
          let merged =
            catPt !== undefined ? { ...base, project_type: catPt } : base;
          if (catArchived !== undefined) merged = { ...merged, is_archived: catArchived };
          if (catNotes !== undefined) merged = { ...merged, notes: catNotes };
          store.updateProject(merged);
        } else {
          store.insertProject({
            id,
            name,
            path: root,
            port: portNum,
            status: 'stopped',
            thumbnail_url,
            start_script,
            build_script,
            pkg_manager,
            project_type: catPt ?? null,
            is_archived:
              catArchived !== undefined ? catArchived : false,
            ...(catNotes !== undefined ? { notes: catNotes } : {}),
          });
        }
        imported += 1;
      } catch (e) {
        const msg = e && typeof e === 'object' && 'message' in e ? String(e.message) : String(e);
        errors.push({ id: raw?.id, message: msg });
      }
    }
    msc_emitProjectsUpdated();
    return { ok: true, imported, errors };
  });

  ipcMain.handle('vpe:clear-all-projects', async () => {
    await msc_vpeStopAllEngines();
    if (typeof store.clearEntireRegistry !== 'function') {
      throw new Error('VPE: Store does not support registry reset.');
    }
    store.clearEntireRegistry();
    msc_emitProjectsUpdated();
    return { ok: true };
  });

  ipcMain.handle('vpe:open-directory', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select project root (folder that contains package.json — not the vault)',
      properties: ['openDirectory'],
    });
    if (result.canceled || !Array.isArray(result.filePaths) || !result.filePaths[0]) {
      return null;
    }
    return result.filePaths[0];
  });

  ipcMain.handle('vpe:nuke-project', async (_event, projectId) => {
    if (!projectId) throw new Error('VPE: Missing project id');
    const row = store.getProject(projectId);
    if (!row) throw new Error('VPE: Project not found');
    projectRunner.stopProject(projectId);
    store.setProjectStopped(projectId);
    msc_emitProjectsUpdated();
    const pm = vpeRuntime.pm2Manager;
    if (pm && typeof pm.nukeProject === 'function') {
      await pm.nukeProject(projectId);
      msc_emitProjectsUpdated();
      return { ok: true, id: projectId };
    }
    return { ok: true, id: projectId, skipped: 'pm2_unavailable' };
  });

  ipcMain.handle('vpe:clear-repair-history', async () => {
    store.clearRepairHistory();
    return { ok: true };
  });

  ipcMain.handle('vpe:delete-repair-run', async (_event, repairId) => {
    if (!repairId) throw new Error('VPE: Missing repair run id');
    store.deleteRepairRun(repairId);
    return { ok: true };
  });

  ipcMain.handle('vpe:set-project-favorite', async (_event, { projectId, isFavorite }) => {
    if (!projectId) throw new Error('VPE: Missing project id');
    store.setProjectFavorite(projectId, isFavorite);
    msc_emitProjectsUpdated();
    return { ok: true };
  });

  ipcMain.handle('vpe:read-project-dotenv', async (_evt, projectId) => {
    try {
      if (!projectId || typeof projectId !== 'string') {
        return { ok: false, error: 'VPE: Missing project id.' };
      }
      const hit = msc_resolveProjectDotEnvAbs(store, projectId);
      if (!hit.ok) return hit;
      const { envPath, harmonizedMissingRoot } = hit;
      if (harmonizedMissingRoot) {
        return { ok: true, content: '', missingFile: true, path: envPath };
      }
      if (!fs.existsSync(envPath)) {
        return { ok: true, content: '', missingFile: true, path: envPath };
      }
      const st = fs.statSync(envPath);
      if (!st.isFile()) return { ok: false, error: 'VPE: .env is not a file.' };
      if (st.size > VPE_DOTENV_MAX_BYTES) {
        return { ok: false, error: 'VPE: .env exceeds maximum allowed size.' };
      }
      const content = fs.readFileSync(envPath, 'utf8');
      return { ok: true, content, path: envPath };
    } catch (e) {
      return { ok: false, error: e?.message ?? String(e) };
    }
  });

  ipcMain.handle('vpe:write-project-dotenv', async (_evt, payload) => {
    try {
      if (!payload || typeof payload !== 'object') {
        return { ok: false, error: 'VPE: Invalid payload.' };
      }
      const { projectId, content } = payload;
      if (!projectId || typeof projectId !== 'string') {
        return { ok: false, error: 'VPE: Missing project id.' };
      }
      if (typeof content !== 'string') {
        return { ok: false, error: 'VPE: Missing .env body.' };
      }
      if (content.length > VPE_DOTENV_MAX_BYTES) {
        return { ok: false, error: 'VPE: .env content too large.' };
      }
      const hit = msc_resolveProjectDotEnvAbs(store, projectId);
      if (!hit.ok) return hit;
      const { envPath, root, harmonizedMissingRoot } = hit;
      if (harmonizedMissingRoot) {
        return {
          ok: false,
          error: 'VPE: Project folder is not on disk yet.',
          suppressToast: true,
        };
      }
      fs.mkdirSync(root, { recursive: true });
      const tmp = `${envPath}.${randomUUID()}.tmp`;
      fs.writeFileSync(tmp, content, 'utf8');
      try {
        fs.renameSync(tmp, envPath);
      } catch (e) {
        try {
          fs.unlinkSync(tmp);
        } catch (_) {
          /* */
        }
        throw e;
      }
      return { ok: true, path: envPath };
    } catch (e) {
      return { ok: false, error: e?.message ?? String(e) };
    }
  });
}

module.exports = { msc_registerProjectIpc };
