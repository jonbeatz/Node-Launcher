const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const isDev = require('electron-is-dev');
const MSC_PM2Manager = require('./pm2-manager');
const MSC_TrayManager = require('./tray-manager');
const { msc_createDatabase, msc_getDatabase } = require('./db/database');
const MSC_ProjectRunner = require('./project-runner');
const { msc_registerVpeIpc } = require('./vpe-ipc');
const { msc_archiveLegacyProjectsJson } = require('./legacy-projects-archive');
const { msc_reconcileStaleRunningProjects } = require('./boot-running-reconcile');

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
    lastThumbnail: row.thumbnail_url,
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
 * Window / taskbar icon: dev → repo `build/icon.ico` (same path as electron-builder `win.icon`);
 * packaged → `extraResources` copy at `resources/icon.ico` (ASAR-safe).
 * @returns {string | undefined}
 */
function msc_resolveAppIconPath() {
  const candidates = [];
  if (isDev) {
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

      void msc_reconcileStaleRunningProjects({ store, projectRunner }).catch(
        (err) => {
          console.warn(
            'VPE: Boot running reconcile failed:',
            err?.message ?? err,
          );
        },
      );
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
    width: 1280,
    height: 850,
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
    mainWindow.loadURL(VPE_RENDERER_DEV_ORIGIN);
    mainWindow.webContents.openDevTools();
    console.log(`Vader Shield: UI load URL ${VPE_RENDERER_DEV_ORIGIN}`);
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
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
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
  } catch (err) {
    console.error('VPE: SQLite init failed:', err?.message ?? err);
  }
});

app.on('ready', msc_createWindow);

app.on('before-quit', () => {
  if (pm2Manager && typeof pm2Manager.stopAll === 'function') {
    pm2Manager.stopAll().catch(() => {});
  }
  if (projectRunner) {
    try {
      projectRunner.killAll();
    } catch (_) {
      /* ignore */
    }
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