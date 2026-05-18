const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const {
  msc_registerVpeVaultPrivilegedScheme,
  msc_registerVpeVaultProtocolHandler,
  msc_registerVpeThumbProtocolHandler,
} = require('./vpe-vault-protocol');
const path = require('path');
const fs = require('fs');

function msc_ironParseSemverCore(s) {
  const m = String(s || '')
    .trim()
    .replace(/^v/i, '')
    .match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** @returns {boolean} true if a < b */
function msc_ironSemverLt(a, b) {
  const pa = msc_ironParseSemverCore(a);
  const pb = msc_ironParseSemverCore(b);
  if (!pa || !pb) return false;
  for (let i = 0; i < 3; i += 1) {
    if (pa[i] < pb[i]) return true;
    if (pa[i] > pb[i]) return false;
  }
  return false;
}

/** JEDI_MOD_33 — check version alignment (app vs DB/lock). */
function msc_ironCurtainVersionAudit(appVer) {
  if (process.env.VPE_E2E_USER_DATA) return;
  if (String(process.env.VPE_SKIP_IRON_CURTAIN || '').trim() === '1') return;

    const legacyVersion = msc_ironSemverLt(appVer, '2.2.5');
    if (legacyVersion) {
      const msg =
        'CRITICAL: LEGACY ENGINE DETECTED. Access to Vault v2.2.5+ has been locked to prevent data corruption. Please use the VPE Sovereign Build.';
      console.error('[SECURITY] Iron Curtain Active: Blocking legacy v' + appVer);
    try {
      dialog.showErrorBox('Vader Project Engine', msg);
    } catch (_) {}
    try {
      app.exit(0);
    } catch (_) {}
    process.exit(0);
  }
}

/**
 * Local-first `userData`: when running from a Node-Launcher checkout or with `--portable`,
 * keep SQLite/cache under `process.cwd()/vpe-local-data` so legacy trees on D: do not share
 * `%LocalAppData%/VaderProjectEngine` with other installs.
 */
function msc_vpeDetectLocalFirstUserData() {
  const pkgPath = path.join(__dirname, '..', '..', 'package.json');
  let appVer = '0.0.0';
  try {
    appVer = String(JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version || '0.0.0').trim();
  } catch (_) {}

  msc_ironCurtainVersionAudit(appVer);

  if (process.env.VPE_E2E_USER_DATA) return;
  if (process.env.VPE_PORTABLE_USER_DATA_ROOT) return;
  const cwd = process.cwd();
  const portableArgv =
    process.argv.includes('--portable') || String(process.env.VPE_PORTABLE || '') === '1';
  const cwdNodeLauncher = /node[-_]?launcher/i.test(cwd);
  if (portableArgv || cwdNodeLauncher || true) {
    process.env.VPE_LOCAL_USERDATA_ROOT = path.resolve(path.join(cwd, 'vpe-local-data'));
    console.log('[VPE] Local-first userData profile:', process.env.VPE_LOCAL_USERDATA_ROOT);
  }

  // JEDI_MOD_23: Portable Sync Lock — Force project root for all data
  const vaderDataPath = path.join(process.cwd(), 'vpe-local-data');
  app.setPath('userData', vaderDataPath);
  console.log('[SECURITY] Iron Curtain Active: Guarding Vault v2.2.5');
  console.log('Vader Data Path:', app.getPath('userData'));
}
msc_vpeDetectLocalFirstUserData();

const isDev = require('electron-is-dev');
const MSC_PM2Manager = require('./pm2-manager');
const MSC_TrayManager = require('./tray-manager');
const { msc_createDatabase, msc_getDatabase } = require('./db/database');
const { msc_vpePortableBackupFromStore, msc_vpeWalCheckpointIfSqlite } = require('./db/persistent-store');
const MSC_ProjectRunner = require('./project-runner');
const {
  msc_registerVpeIpc,
  msc_onDevExitCompanionSweep,
  msc_applyLoginStartupFromStore,
  msc_runAutoStartProjectsIfEnabled,
} = require('./vpe-ipc');
const { msc_archiveLegacyProjectsJson } = require('./legacy-projects-archive');
const { msc_reconcileStaleRunningProjects } = require('./boot-running-reconcile');
const { msc_startGhostWatcher } = require('./vpe-orchestrator');
const { msc_rendererVaultThumbnailHref } = require('./vpe-thumbnail-url');
const { msc_projectVaultRootDir } = require('./vpe-vault-paths');
const { msc_installVaultDeletionRmGuard } = require('./vpe-vault-rm-guard');
msc_installVaultDeletionRmGuard();

/** CDP / remote debugging: dev-only or explicit opt-in (packaged builds stay closed by default). */
const MSC_VPE_CDP_ALLOWED = isDev === true || String(process.env.VPE_ALLOW_CDP || '') === '1';
if (MSC_VPE_CDP_ALLOWED) {
  const MSC_VPE_REMOTE_DEBUG_PORT = String(
    process.env.VPE_REMOTE_DEBUG_PORT || '9222',
  ).replace(/[^\d]/g, '') || '9222';
  app.commandLine.appendSwitch('remote-debugging-port', MSC_VPE_REMOTE_DEBUG_PORT);
  app.commandLine.appendSwitch('remote-debugging-address', '127.0.0.1');
  console.log(
    `[VPE Main] Remote debugging enabled at http://127.0.0.1:${MSC_VPE_REMOTE_DEBUG_PORT} (dev or VPE_ALLOW_CDP=1)`,
  );
} else {
  console.log(
    '[VPE Main] Remote debugging disabled (production baseline). Set VPE_ALLOW_CDP=1 to enable CDP for MCP/Playwright.',
  );
}

/**
 * v2.0.x — Instance isolation: primary holds `requestSingleInstanceLock()`. If the lock is not
 * acquired, pivot identity (`app.setName`, Windows `setAppUserModelId`) and an aux profile under
 * `%AppData%/Vader-Vault-Aux-<ts>/` so SQLite and taskbar grouping do not collide with the first
 * process. Re-requests the lock after pivot so the auxiliary process can own its own lock key.
 * Skipped when `VPE_E2E_USER_DATA` is set (Playwright supplies its own profile per worker).
 */
if (!process.env.VPE_E2E_USER_DATA) {
  const msc_vpeInitialSingletonLock = app.requestSingleInstanceLock();
  if (!msc_vpeInitialSingletonLock) {
    const instanceId = Date.now().toString();
    try {
      app.setName(`VPE-Engine-${instanceId}`);
      if (process.platform === 'win32' && typeof app.setAppUserModelId === 'function') {
        app.setAppUserModelId(`VPE.Engine.${instanceId}`);
      }
      const auxRoot = path.join(app.getPath('appData'), `Vader-Vault-Aux-${instanceId}`);
      process.env.VPE_PORTABLE_USER_DATA_ROOT = auxRoot;
      app.commandLine.appendSwitch('vpe-portable', '1');
      if (!process.argv.includes('--portable')) {
        process.argv.push('--portable');
      }
      const msc_vpeLockAfterPivot = app.requestSingleInstanceLock();
      console.warn('[VPE] Auxiliary instance pivot', {
        instanceId,
        auxRoot,
        lockAfterPivot: msc_vpeLockAfterPivot,
      });
    } catch (e) {
      console.error('[VPE] Auxiliary instance pivot failed:', e?.message ?? e);
    }
  } else {
    app.on('second-instance', () => {
      const w = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
      if (w && !w.isDestroyed()) {
        if (w.isMinimized()) w.restore();
        w.show();
        w.focus();
      }
    });
  }
}

/** v1.6.0 — mute noisy DevTools/socket stderr unless `--verbose` is present; ghost watcher post-reconcile. */
const MSC_VPE_VERBOSE_LOG = process.argv.includes('--verbose');
if (!MSC_VPE_VERBOSE_LOG && !global.__vpe_stderr_filter_registered) {
  global.__vpe_stderr_filter_registered = true;
  const _stderrWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = function msc_filteredStderr(chunk, encoding, cb) {
    let enc = encoding;
    let cbFn = cb;
    if (typeof enc === 'function') {
      cbFn = enc;
      enc = undefined;
    }
    const s =
      typeof chunk === 'string'
        ? chunk
        : Buffer.isBuffer(chunk)
          ? chunk.toString('utf8')
          : String(chunk);
    if (/\b0x2740\b|DevTools.*socket|devtools.*\bsocket\b/i.test(s)) {
      if (typeof cbFn === 'function') cbFn();
      return true;
    }
    return _stderrWrite(chunk, enc, cbFn);
  };
}

function msc_ipcLegacyProjectRows(store) {
  return store.getProjects().map((row) => ({
    id: row.id,
    path: row.path,
    displayName: row.name,
    detectedStartScript: row.start_script,
    buildScript: row.build_script,
    detectedPackageManager: row.pkg_manager,
    preferredPort: row.port,
    status: row.status,
    lastThumbnail: msc_rendererVaultThumbnailHref(row, null) ?? row.thumbnail_url ?? null,
  }));
}

function msc_wireRunnerPm2Sync(runner, pm) {
  if (!runner || !pm) return;
  const evict = (projectId) => {
    if (projectId == null) return;
    void pm.msc_evictPm2Slot(String(projectId));
  };
  runner.on('start', ({ projectId, mode }) => {
    if (mode === 'dev') evict(projectId);
  });
  runner.on('stop', ({ projectId }) => evict(projectId));
  runner.on('exit', ({ projectId, mode }) => {
    if (mode === 'dev') evict(projectId);
  });
}

/**
 * VPE Port Sync: Node-Launcher UI uses 3000; managed apps use 3001+.
 * Matches npm run dev:renderer -p 3000
 */
const { msc_launcherRendererPort } = require('./launcher-port');
const { msc_waitForDevServer } = require('./wait-dev-server');
const VPE_RENDERER_DEV_PORT = msc_launcherRendererPort();
const VPE_RENDERER_DEV_ORIGIN = `http://localhost:${VPE_RENDERER_DEV_PORT}`;

/**
 * Vader Shield: Global Exception Guard
 * Prevents connect EPERM //./pipe/rpc.sock from crashing the engine.
 */
if (!global.__vpe_rpc_guard_registered) {
  global.__vpe_rpc_guard_registered = true;
  process.on('uncaughtException', (err) => {
    const msg = String(err?.message ?? err);
    if (msg.includes('//./pipe/rpc.sock')) {
      console.warn('VPE: RPC Pipe blocked. UI isolation mode active.');
      return;
    }
    console.error('VPE: Critical Error:', err);
  });
}

let mainWindow;
let pm2Manager;
let trayManager;
let projectRunner;
/** True during `app.quit()` / tray Exit so `close` is not intercepted for tray hide. */
let msc_vpeAppQuitting = false;
/** Ghost port watcher (`vpe:ghost-detected` IPC). */
let msc_ghostWatcher;

/**
 * Packaged UI: Next static export at `src/renderer/out/index.html` (inside app.asar).
 * @returns {string}
 */
function msc_getRendererIndexPath() {
  return path.join(__dirname, '..', 'renderer', 'out', 'index.html');
}
/** Set `pm2Manager` after daemon connect; `vpe:nuke-project` uses this. */
const msc_vpeRuntime = { pm2Manager: null };

function msc_configureWritablePaths() {
  /** Isolated profile for Playwright Electron e2e (`test:e2e:electron`). */
  if (process.env.VPE_E2E_USER_DATA) {
    const userDataDir = path.resolve(process.env.VPE_E2E_USER_DATA);
    const cacheDir = path.join(userDataDir, 'cache');
    const sessionDataDir = path.join(userDataDir, 'session-data');
    const gpuCacheDir = path.join(cacheDir, 'GPUCache');
    try {
      fs.mkdirSync(userDataDir, { recursive: true });
      fs.mkdirSync(cacheDir, { recursive: true });
      fs.mkdirSync(sessionDataDir, { recursive: true });
      fs.mkdirSync(gpuCacheDir, { recursive: true });
      app.setPath('userData', userDataDir);
      app.setPath('cache', cacheDir);
      app.setPath('sessionData', sessionDataDir);
      app.commandLine.appendSwitch('disk-cache-dir', cacheDir);
      app.commandLine.appendSwitch('gpu-shader-disk-cache-path', gpuCacheDir);
    } catch (err) {
      console.warn(
        'VPE: Failed to apply VPE_E2E_USER_DATA paths, using defaults.',
        err?.message ?? err,
      );
    }
    return;
  }

  /** Auxiliary profile (`Vader-Vault-Aux-*`) after lock conflict + identity pivot (see bootstrap). */
  if (process.env.VPE_PORTABLE_USER_DATA_ROOT) {
    const userDataDir = path.resolve(String(process.env.VPE_PORTABLE_USER_DATA_ROOT).trim());
    const cacheDir = path.join(userDataDir, 'cache');
    const sessionDataDir = path.join(userDataDir, 'session-data');
    const gpuCacheDir = path.join(cacheDir, 'GPUCache');
    try {
      fs.mkdirSync(userDataDir, { recursive: true });
      fs.mkdirSync(cacheDir, { recursive: true });
      fs.mkdirSync(sessionDataDir, { recursive: true });
      fs.mkdirSync(gpuCacheDir, { recursive: true });
      app.setPath('userData', userDataDir);
      app.setPath('cache', cacheDir);
      app.setPath('sessionData', sessionDataDir);
      app.commandLine.appendSwitch('disk-cache-dir', cacheDir);
      app.commandLine.appendSwitch('gpu-shader-disk-cache-path', gpuCacheDir);
      console.log('[VPE] Auxiliary instance userData:', userDataDir);
    } catch (err) {
      console.warn(
        'VPE: Failed to apply VPE_PORTABLE_USER_DATA_ROOT paths, using defaults.',
        err?.message ?? err,
      );
    }
    return;
  }

  /** Repo-local profile: `cwd/vpe-local-data` (portable / Node-Launcher checkout). */
  if (process.env.VPE_LOCAL_USERDATA_ROOT) {
    const userDataDir = path.resolve(String(process.env.VPE_LOCAL_USERDATA_ROOT).trim());
    const cacheDir = path.join(userDataDir, 'cache');
    const sessionDataDir = path.join(userDataDir, 'session-data');
    const gpuCacheDir = path.join(cacheDir, 'GPUCache');
    try {
      fs.mkdirSync(userDataDir, { recursive: true });
      fs.mkdirSync(cacheDir, { recursive: true });
      fs.mkdirSync(sessionDataDir, { recursive: true });
      fs.mkdirSync(gpuCacheDir, { recursive: true });
      app.setPath('userData', userDataDir);
      app.setPath('cache', cacheDir);
      app.setPath('sessionData', sessionDataDir);
      app.commandLine.appendSwitch('disk-cache-dir', cacheDir);
      app.commandLine.appendSwitch('gpu-shader-disk-cache-path', gpuCacheDir);
      console.log('[VPE] Local-first userData applied:', userDataDir);
    } catch (err) {
      console.warn(
        'VPE: Failed to apply VPE_LOCAL_USERDATA_ROOT paths, using defaults.',
        err?.message ?? err,
      );
    }
    return;
  }

  const localAppData =
    process.env.LOCALAPPDATA ||
    path.join(process.env.USERPROFILE || process.cwd(), 'AppData', 'Local');
  const baseDir = path.join(localAppData, 'VaderProjectEngine');
  const userDataDir = path.join(baseDir, 'user-data');
  const cacheDir = path.join(baseDir, 'cache');
  const sessionDataDir = path.join(baseDir, 'session-data');
  const gpuCacheDir = path.join(cacheDir, 'GPUCache');
  try {
    fs.mkdirSync(userDataDir, { recursive: true });
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.mkdirSync(sessionDataDir, { recursive: true });
    fs.mkdirSync(gpuCacheDir, { recursive: true });
    app.setPath('userData', userDataDir);
    app.setPath('cache', cacheDir);
    app.setPath('sessionData', sessionDataDir);
    app.commandLine.appendSwitch('disk-cache-dir', cacheDir);
    app.commandLine.appendSwitch('gpu-shader-disk-cache-path', gpuCacheDir);
  } catch (err) {
    console.warn(
      'VPE: Failed to preconfigure cache/userData paths, using defaults.',
      err?.message ?? err,
    );
  }
}
msc_configureWritablePaths();

/**
 * One-time copy of `%LocalAppData%/VaderProjectEngine/.../vader.sqlite` into `vpe-local-data`
 * when local profile is active and the repo folder has no DB yet.
 */
function msc_vpeMaybeMigrateSqliteToLocal() {
  if (!process.env.VPE_LOCAL_USERDATA_ROOT) return;
  try {
    const localBase = path.resolve(String(process.env.VPE_LOCAL_USERDATA_ROOT).trim());
    const localDbDir = path.join(localBase, 'vpe-db');
    const localDb = path.join(localDbDir, 'vader.sqlite');
    if (fs.existsSync(localDb)) return;

    const localAppData =
      process.env.LOCALAPPDATA ||
      path.join(process.env.USERPROFILE || '', 'AppData', 'Local');
    const legacyDb = path.join(
      localAppData,
      'VaderProjectEngine',
      'user-data',
      'vpe-db',
      'vader.sqlite',
    );
    if (fs.existsSync(legacyDb)) {
      fs.mkdirSync(localDbDir, { recursive: true });
      fs.copyFileSync(legacyDb, localDb);
      console.log('[VPE] Initial Migration: Database copied to project vpe-local-data folder.');
    }
  } catch (e) {
    console.error('[VPE] Local DB migration failed:', e?.message ?? e);
  }
}
msc_vpeMaybeMigrateSqliteToLocal();

/**
 * Vault Shield: `…/media/vault/vpe-version.lock` (see `msc_projectVaultRootDir`) records the newest
 * engine that touched the vault. Older executables refuse to run against a newer lock.
 *
 * Must run **before** `msc_registerVpeIpc` (which materializes vault dirs / migration scrub on attach)
 * so no sync touches the vault on a mismatched engine build.
 */
function msc_vpeParseSemverCore(s) {
  const m = String(s || '')
    .trim()
    .replace(/^v/i, '')
    .match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function msc_vpeSemverCompare(a, b) {
  const pa = msc_vpeParseSemverCore(a);
  const pb = msc_vpeParseSemverCore(b);
  if (!pa || !pb) return 0;
  for (let i = 0; i < 3; i += 1) {
    if (pa[i] > pb[i]) return 1;
    if (pa[i] < pb[i]) return -1;
  }
  return 0;
}

function msc_vpeReadEngineVersionFromPackage() {
  try {
    const pkgPath = path.join(__dirname, '..', '..', 'package.json');
    const j = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return String(j.version || '0.0.0').trim();
  } catch (_) {
    return '0.0.0';
  }
}

function msc_vpeEnforceVaultVersionLock() {
  if (process.env.VPE_E2E_USER_DATA) return;
  if (String(process.env.VPE_SKIP_VAULT_VERSION_LOCK || '').trim() === '1') return;

  const appVer = msc_vpeReadEngineVersionFromPackage();
  let vaultRoot;
  try {
    vaultRoot = path.resolve(msc_projectVaultRootDir());
  } catch (e) {
    console.warn('[VPE] Vault version lock skipped (no vault root):', e?.message ?? e);
    return;
  }

  const lockPath = path.join(vaultRoot, 'vpe-version.lock');
  try {
    fs.mkdirSync(vaultRoot, { recursive: true });
  } catch (e) {
    console.warn('[VPE] Vault version lock: mkdir failed:', e?.message ?? e);
    return;
  }

  let lockVer = '';
  try {
    if (fs.existsSync(lockPath)) {
      lockVer = String(fs.readFileSync(lockPath, 'utf8')).split(/\r?\n/)[0].trim();
    }
  } catch (e) {
    console.warn('[VPE] Vault version lock read failed:', e?.message ?? e);
  }

  if (lockVer && msc_vpeSemverCompare(lockVer, appVer) === 1) {
    const msg =
      'Incompatible Engine Version. Access Denied to Vault to prevent data corruption.\n\n' +
      `This installation is v${appVer}. The vault was last upgraded by v${lockVer}.`;
    console.error('[VPE]', msg);
    try {
      dialog.showErrorBox('Vader Project Engine', msg);
    } catch (_) {
      /* */
    }
    app.exit(1);
    return;
  }

  try {
    fs.writeFileSync(lockPath, `${appVer}\n`, 'utf8');
    console.log('[VPE] Vault version lock updated:', lockPath, '→', appVer);
  } catch (e) {
    console.warn('[VPE] Vault version lock write failed:', e?.message ?? e);
  }
}
msc_vpeEnforceVaultVersionLock();

/**
 * One-time cleanup of legacy workspace folders that are no longer the active
 * app root. Operates silently — any error (folder already deleted, permissions,
 * etc.) is swallowed so the boot sequence is never interrupted.
 *
 * Targets:
 *   D:\Cursor_Projectz\Node-Launcher      (original folder — now replaced by -v2)
 *   D:\Cursor_Projectz\Node-Launcher-v3   (intermediate revision — never deployed)
 *
 * The active repo (`Node-Launcher-v2`) is intentionally excluded.
 */
function msc_vpeCleanupLegacyWorkspaceFolders() {
  if (process.env.VPE_SKIP_LEGACY_CLEANUP === '1') return;
  const legacyPaths = [
    path.join('d:', 'Cursor_Projectz', 'Node-Launcher'),
    path.join('d:', 'Cursor_Projectz', 'Node-Launcher-v3'),
  ];
  for (const legacyDir of legacyPaths) {
    try {
      if (!fs.existsSync(legacyDir)) continue;
      const stat = fs.statSync(legacyDir);
      if (!stat.isDirectory()) continue;
      fs.rmSync(legacyDir, { recursive: true, force: true });
      console.log('[VPE] Legacy workspace removed:', legacyDir);
    } catch (e) {
      console.warn('[VPE] Legacy workspace cleanup skipped:', legacyDir, '-', e?.message ?? e);
    }
  }
}
msc_vpeCleanupLegacyWorkspaceFolders();

/** v1.7.6 — before `ready`; pairs with `msc_registerVpeVaultProtocolHandler` on startup. */
msc_registerVpeVaultPrivilegedScheme();

/**
 * Window / taskbar icon: dev → repo `media/icon.ico` (matches electron-builder `win.icon`);
 * packaged → `extraResources` copy at `resources/icon.ico` (ASAR-safe).
 * Falls back to legacy `build/icon.ico` if present.
 * @returns {string | undefined}
 */
function msc_resolveAppIconPath() {
  const candidates = [];
  if (isDev) {
    candidates.push(path.join(__dirname, '..', '..', 'media', 'icon.ico'));
    candidates.push(path.join(process.cwd(), 'media', 'icon.ico'));
    candidates.push(path.join(__dirname, '..', '..', 'build', 'icon.ico'));
    candidates.push(path.join(process.cwd(), 'build', 'icon.ico'));
  } else {
    candidates.push(path.join(process.resourcesPath, 'icon.ico'));
  }
  for (const p of candidates) {
    try {
      if (p && fs.existsSync(p)) return p;
    } catch (_) {
      /* ignore */
    }
  }
  return undefined;
}

/**
 * MSC Deferred Engine Attach
 * Ensures pm2.connect never blocks the first paint of the UI.
 */
function msc_attachEngineAfterWindow(mainWin) {
  try {
    if (!mainWin || mainWin.isDestroyed()) return;

    const db = msc_getDatabase();
    if (projectRunner) {
      projectRunner.setMainWindow(mainWin);
    } else {
      projectRunner = new MSC_ProjectRunner(mainWin, db);
      // IPC registers vault sync (`msc_syncVaultPhysicalFolders`); `msc_vpeEnforceVaultVersionLock` already ran at boot.
      msc_registerVpeIpc(projectRunner, db, msc_vpeRuntime);
    }
    console.log('VPE: Persistence + ProjectRunner IPC online.');
  } catch (e) {
    console.error('VPE: ProjectRunner / IPC attach failed:', e?.message ?? e);
  }

  setImmediate(() => {
    try {
      if (!mainWin || mainWin.isDestroyed()) return;

      const store = msc_getDatabase();
      pm2Manager = new MSC_PM2Manager(mainWin, store);
      msc_vpeRuntime.pm2Manager = pm2Manager;
      msc_wireRunnerPm2Sync(projectRunner, pm2Manager);
      trayManager = new MSC_TrayManager(
        mainWin,
        pm2Manager,
        store,
        projectRunner,
      );
      console.log('Vader Shield: PM2 Manager & Tray synchronized.');

      const priorRunningIds = (typeof store.listProjectsAlphabetical === 'function'
        ? store.listProjectsAlphabetical()
        : []
      )
        .filter((p) => p && p.status === 'running')
        .map((p) => p.id);

      void (async () => {
        try {
          await msc_reconcileStaleRunningProjects({ store, projectRunner });
        } catch (err) {
          console.warn(
            'VPE: Boot running reconcile failed:',
            err?.message ?? err,
          );
        }
        try {
          msc_applyLoginStartupFromStore(store);
        } catch (e) {
          console.warn('VPE: apply launch-at-login', e?.message ?? e);
        }
        try {
          await msc_runAutoStartProjectsIfEnabled(store, projectRunner, priorRunningIds);
        } catch (e) {
          console.warn('VPE: auto-start projects', e?.message ?? e);
        }
      })();

      try {
        if (!msc_ghostWatcher) {
          msc_ghostWatcher = msc_startGhostWatcher({
            getStore: () => msc_getDatabase(),
            getMainWindow: () => mainWindow,
            intervalMs: 60_000,
          });
          msc_ghostWatcher.start();
        }
      } catch (wErr) {
        console.warn('VPE: Ghost watcher did not start:', wErr?.message ?? wErr);
      }
    } catch (e) {
      console.error('VPE: Engine attach failed (continuing UI-only)', e?.message ?? e);
    }
  });
}

/**
 * Core UI Initialization
 * Forces Studio Dark aesthetic (#121212) and loads the launcher renderer (default port 3000).
 */
function msc_createWindow() {
  const msc_iconPath = msc_resolveAppIconPath();
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 1024,
    minHeight: 720,
    backgroundColor: '#121212', // Studio Dark Base
    ...(msc_iconPath ? { icon: msc_iconPath } : {}),
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
    titleBarStyle: 'hiddenInset',
    show: false,
  });

  /** Register VPE IPC before navigation so production UI never polls missing handlers. */
  msc_attachEngineAfterWindow(mainWindow);

  if (isDev) {
    /** DevTools never auto-open (avoids disconnect overlay). Toggle with Ctrl+Shift+I only. */
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown') return;
      const win = mainWindow;
      if (!win || win.isDestroyed()) return;
      const keyI =
        input.key === 'I' ||
        input.key === 'i' ||
        input.code === 'KeyI';
      if (input.control && input.shift && keyI) {
        win.webContents.toggleDevTools();
        event.preventDefault();
      }
    });

    let mscDevLoadRetries = 0;
    const MSC_DEV_FAIL_RELOAD_MAX = 50;

    async function msc_loadDevRenderer() {
      await msc_waitForDevServer(VPE_RENDERER_DEV_ORIGIN);
      if (!mainWindow || mainWindow.isDestroyed()) return;
      try {
        await mainWindow.loadURL(VPE_RENDERER_DEV_ORIGIN);
        console.log(`Vader Shield: UI load URL ${VPE_RENDERER_DEV_ORIGIN}`);
      } catch (err) {
        console.error('VPE: loadURL failed:', err?.message ?? err);
      }
    }

    mainWindow.webContents.on('did-fail-load', (_e, code, desc, url, isMainFrame) => {
      if (!isMainFrame || !mainWindow || mainWindow.isDestroyed()) return;
      if (!String(url).startsWith(VPE_RENDERER_DEV_ORIGIN)) return;
      if (code === -3 || code === -2) return;
      if (mscDevLoadRetries >= MSC_DEV_FAIL_RELOAD_MAX) {
        console.error('VPE: Dev did-fail-load retries exhausted:', code, desc, url);
        return;
      }
      mscDevLoadRetries += 1;
      console.warn(
        `[VPE Main] did-fail-load (${code}) ${desc}; retry ${mscDevLoadRetries}/${MSC_DEV_FAIL_RELOAD_MAX}`,
      );
      void (async () => {
        await msc_waitForDevServer(VPE_RENDERER_DEV_ORIGIN, {
          maxAttempts: 30,
          intervalMs: 400,
        });
        if (mainWindow && !mainWindow.isDestroyed()) {
          try {
            await mainWindow.loadURL(VPE_RENDERER_DEV_ORIGIN);
          } catch (err) {
            console.error('VPE: dev reload loadURL failed:', err?.message ?? err);
          }
        }
      })();
    });

    mainWindow.webContents.on('did-finish-load', () => {
      mscDevLoadRetries = 0;
    });

    void msc_loadDevRenderer();
  } else {
    const msc_indexHtml = msc_getRendererIndexPath();
    if (!fs.existsSync(msc_indexHtml)) {
      console.error(
        'VPE: Renderer bundle missing. Run `npm run build:renderer` before `npm run build:main`.',
        msc_indexHtml,
      );
    }
    void mainWindow.loadFile(msc_indexHtml);
    console.log(`Vader Shield: UI loadFile ${msc_indexHtml}`);
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  mainWindow.on('minimize', (event) => {
    try {
      const db = msc_getDatabase();
      const settings = db.getSettings?.();
      // Ensure we explicitly check the toggle from the persistent store
      const minimizeToTray = settings?.minimize_to_tray === true || settings?.minimize_to_tray === 1;
      
      if (minimizeToTray) {
        event.preventDefault();
        mainWindow.hide();
      }
    } catch (_) {
      /* ignore - fallback to default minimize */
    }
  });

  mainWindow.on('close', (e) => {
    if (msc_vpeAppQuitting) return;
    try {
      const db = msc_getDatabase();
      const settings = typeof db.getSettings === 'function' ? db.getSettings() : {};
      const minimizeToTray =
        settings.minimize_to_tray === true || settings.minimize_to_tray === 1;
      if (minimizeToTray) {
        e.preventDefault();
        if (!mainWindow.isDestroyed()) mainWindow.hide();
      }
    } catch (_) {
      /* */
    }
  });

  mainWindow.on('closed', () => {
    try {
      msc_ghostWatcher?.stop();
    } catch (_) {
      /* */
    }
    msc_ghostWatcher = undefined;
    mainWindow = null;
    if (projectRunner) {
      projectRunner.setMainWindow(null);
    }
  });
}

/**
 * Vader Shield: Security Guardrails
 * Restricts navigation to the internal renderer only.
 */
app.on('web-contents-created', (event, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    try {
      const parsedUrl = new URL(navigationUrl);
      if (isDev) {
        // Dev Mode: allow local HTTP(S) host
        const hostOk = parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1';
        if (!hostOk || (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:')) {
          event.preventDefault();
        }
      } else {
        // Production: Restrict to file protocol
        if (parsedUrl.origin !== VPE_RENDERER_DEV_ORIGIN && parsedUrl.protocol !== 'file:') {
          event.preventDefault();
        }
      }
    } catch {
      event.preventDefault();
    }
  });

  contents.setWindowOpenHandler(() => {
    return { action: 'deny' }; // Vader Protocol: No unauthorized popups
  });
});

/**
 * Persistence must exist before renderer loads IPC-backed state.
 */
app.on('will-finish-launching', () => {
  try {
    msc_createDatabase();
    msc_archiveLegacyProjectsJson();
    msc_applyLoginStartupFromStore(msc_getDatabase());
  } catch (err) {
    console.error('VPE: SQLite init failed:', err?.message ?? err);
  }
});

app.on('ready', () => {
  try {
    msc_registerVpeVaultProtocolHandler(() => msc_getDatabase());
  } catch (e) {
    console.error('[VPE]', 'vpe-vault protocol registration failed', e?.message ?? e);
  }
  try {
    msc_registerVpeThumbProtocolHandler();
  } catch (e) {
    console.error('[VPE]', 'vpe-thumb protocol registration failed', e?.message ?? e);
  }
  msc_createWindow();
});

app.on('before-quit', () => {
  msc_vpeAppQuitting = true;
  if (isDev) {
    msc_onDevExitCompanionSweep();
  }
  if (pm2Manager && typeof pm2Manager.stopAll === 'function') {
    pm2Manager.stopAll().catch(() => {});
  }
  if (pm2Manager && typeof pm2Manager.msc_disconnectPm2Rpc === 'function') {
    pm2Manager.msc_disconnectPm2Rpc();
  }
  if (projectRunner) {
    try {
      projectRunner.killAll();
    } catch (_) {
      /* ignore */
    }
  }
});

app.on('will-quit', () => {
  const store = msc_getDatabase();
  try {
    msc_vpeWalCheckpointIfSqlite(store);
  } catch (_) {
    /* */
  }
  try {
    // ... proceed to portable backup
    const s = typeof store.getSettings === 'function' ? store.getSettings() : {};
    const syncOn =
      s.auto_sync_db_on_close === true ||
      s.auto_sync_db_on_close === 1 ||
      String(s.auto_sync_db_on_close).toLowerCase() === 'true';
    if (syncOn) {
      const r = msc_vpePortableBackupFromStore(store, process.cwd());
      if (r.ok) console.log(`[VPE] Portable DB snapshot (quit): ${r.path}`);
      else console.warn('[VPE] Portable DB snapshot (quit) failed:', r.error);
    }
  } catch (e) {
    console.warn('[VPE] Portable quit snapshot error:', e?.message ?? e);
  }
  if (isDev && process.env.VPE_LAUNCHER_FORGE === '1') {
    process.exit(0);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    msc_createWindow();
  }
});

/**
 * IPC Handlers (PM2 Bridge)
 * Guarded against null managers to prevent UI crashes if engine initialization is slow.
 */
ipcMain.handle('msc_getProjects', async () => {
  try {
    const store = msc_getDatabase();
    if (pm2Manager) return pm2Manager.getProjects();
    return msc_ipcLegacyProjectRows(store);
  } catch {
    return [];
  }
});

ipcMain.handle('msc_startProject', async (event, id) => {
  if (!pm2Manager) throw new Error('VPE engine not ready');
  if (trayManager) {
    trayManager.setStatus(`Starting ${id}`);
    trayManager.msc_trayBalloon('VPE', `Starting project ${id} via PM2.`);
  }
  const result = await pm2Manager.startProject(id);
  if (trayManager) trayManager.setStatus('Running');
  return result;
});

ipcMain.handle('msc_stopProject', async (event, id) => {
  if (!pm2Manager) throw new Error('VPE engine not ready');
  const result = await pm2Manager.stopProject(id);
  if (trayManager) {
    trayManager.setStatus('Idle');
    trayManager.msc_trayBalloon('VPE', `Stopped PM2 project ${id}.`);
  }
  return result;
});

ipcMain.handle('msc_nukeProject', async (event, id) => {
  if (!pm2Manager) throw new Error('VPE engine not ready');
  if (trayManager) {
    trayManager.setStatus(`Nuking ${id}`);
    trayManager.msc_trayBalloon('VPE', `NUKE initiated for ${id}.`);
  }
  const result = await pm2Manager.nukeProject(id);
  if (trayManager) trayManager.setStatus('Rebuilding');
  return result;
});