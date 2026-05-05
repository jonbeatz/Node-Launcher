const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const MSC_PM2Manager = require('./pm2-manager');
const MSC_TrayManager = require('./tray-manager');

/** VPE dev renderer port (must match npm run dev:renderer) */
const VPE_RENDERER_DEV_PORT =
  parseInt(process.env.VPE_RENDERER_PORT || process.env.PORT || '3001', 10) || 3001;
const VPE_RENDERER_DEV_ORIGIN = `http://localhost:${VPE_RENDERER_DEV_PORT}`;

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

function msc_attachEngineAfterWindow(mainWin) {
  setImmediate(() => {
    try {
      if (!mainWin || mainWin.isDestroyed()) return;
      pm2Manager = new MSC_PM2Manager(mainWin);
      trayManager = new MSC_TrayManager(mainWin, pm2Manager);
    } catch (e) {
      console.error('VPE: Engine attach failed (continuing UI-only)', e?.message ?? e);
    }
  });
}

function msc_createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    backgroundColor: '#121212',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true, // Enable sandbox for extra security
    },
    titleBarStyle: 'hiddenInset',
    show: false, // Don't show until ready-to-show
  });

  const startUrl = isDev
    ? VPE_RENDERER_DEV_ORIGIN
    : `file://${path.join(__dirname, '../renderer/out/index.html')}`;

  mainWindow.loadURL(startUrl);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  console.log(`Vader Shield: UI load URL ${startUrl}`);
  console.log('Vader Shield: PM2/engine attach deferred (non-blocking)');
  msc_attachEngineAfterWindow(mainWindow);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Vader Shield: Security Guardrails
app.on('web-contents-created', (event, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    if (!isDev) {
      try {
        const parsedUrl = new URL(navigationUrl);
        if (parsedUrl.origin !== VPE_RENDERER_DEV_ORIGIN && parsedUrl.protocol !== 'file:') {
          event.preventDefault();
        }
      } catch {
        event.preventDefault();
      }
      return;
    }
    try {
      const parsedUrl = new URL(navigationUrl);
      const hostOk = parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1';
      if (!hostOk || (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:')) {
        event.preventDefault();
      }
    } catch {
      event.preventDefault();
    }
  });

  contents.setWindowOpenHandler(({ url }) => {
    return { action: 'deny' }; // Disable all new windows for security
  });
});

app.on('ready', msc_createWindow);

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

// IPC Handlers bridged to PM2 Manager
ipcMain.handle('msc_getProjects', async () => {
  if (!pm2Manager) return [];
  return pm2Manager.getProjects();
});

ipcMain.handle('msc_startProject', async (event, id) => {
  if (!pm2Manager) throw new Error('VPE engine not ready');
  if (trayManager) trayManager.setStatus(`Starting ${id}`);
  const result = await pm2Manager.startProject(id);
  if (trayManager) trayManager.setStatus('Running');
  return result;
});

ipcMain.handle('msc_stopProject', async (event, id) => {
  if (!pm2Manager) throw new Error('VPE engine not ready');
  const result = await pm2Manager.stopProject(id);
  if (trayManager) trayManager.setStatus('Idle');
  return result;
});

ipcMain.handle('msc_nukeProject', async (event, id) => {
  if (!pm2Manager) throw new Error('VPE engine not ready');
  if (trayManager) trayManager.setStatus(`Nuking ${id}`);
  const result = await pm2Manager.nukeProject(id);
  if (trayManager) trayManager.setStatus('Rebuilding');
  return result;
});
