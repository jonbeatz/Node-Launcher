const { Tray, Menu, nativeImage, app } = require('electron');
const path = require('path');
const fs = require('fs');

const MSC_TRAY_BRAND = 'Powered by the MSC Media Engine v1.0.7';

class MSC_TrayManager {
  /**
   * @param {import('electron').BrowserWindow} mainWindow
   * @param {import('./pm2-manager')} pm2Manager
   * @param store SqlitePersistence | JsonPersistence
   * @param {import('./project-runner') | null} projectRunner
   */
  constructor(mainWindow, pm2Manager, store, projectRunner) {
    this.mainWindow = mainWindow;
    this.pm2Manager = pm2Manager;
    this.store = store;
    this.projectRunner = projectRunner;
    this.tray = null;
    this.init();
  }

  init() {
    const isDev = require('electron-is-dev');
    let msc_iconPath;
    
    if (isDev) {
      msc_iconPath = path.join(app.getAppPath(), 'build', 'icon.ico');
    } else {
      // In production, extraResources puts it next to the executable or in resources
      msc_iconPath = path.join(process.resourcesPath, 'icon.ico');
    }

    if (!fs.existsSync(msc_iconPath)) {
      // Fallback for different build structures
      msc_iconPath = path.join(__dirname, '..', '..', 'build', 'icon.ico');
    }

    const icon = fs.existsSync(msc_iconPath) 
      ? nativeImage.createFromPath(msc_iconPath)
      : nativeImage.createEmpty();
    
    this.tray = new Tray(icon);
    this.setStatus('Idle');
    this.updateMenu('Idle');
  }

  msc_trayBalloon(title, bodyWithSignature) {
    if (!this.tray) return;
    if (process.platform !== 'win32') return;
    if (typeof this.tray.displayBalloon !== 'function') return;
    try {
      const content = bodyWithSignature.includes(MSC_TRAY_BRAND)
        ? bodyWithSignature
        : `${bodyWithSignature} — ${MSC_TRAY_BRAND}`;
      this.tray.displayBalloon({ title, content });
    } catch {
      /* optional on some Windows builds */
    }
  }

  updateMenu(status = 'Idle') {
    const projects = [];
    try {
      projects.push(...this.store.getProjects());
    } catch {
      /* ignore */
    }

    const projectItems =
      projects.slice(0, 16).map((p) => ({
        label: `${p.name} (${p.status})`,
        enabled: false,
      })) ?? [];

    const contextMenu = Menu.buildFromTemplate([
      { label: `VPE Status: ${status}`, enabled: false },
      { type: 'separator' },
      {
        label: 'Dashboard',
        click: () => {
          try {
            if (this.mainWindow && !this.mainWindow.isDestroyed())
              this.mainWindow.show();
          } catch {
            /* ignore */
          }
        },
      },
      {
        label: `Registered projects (${projects.length})`,
        enabled: false,
      },
      ...(projectItems.length ? projectItems : [{ label: '  (none)', enabled: false }]),
      { type: 'separator' },
      {
        label: 'Stop all (PM2 + dashboard spawns)',
        click: () => this.msc_stopAllUnified(),
      },
      { type: 'separator' },
      { label: MSC_TRAY_BRAND, enabled: false },
      { type: 'separator' },
      {
        label: 'Exit VPE',
        click: () => app.quit(),
      },
    ]);

    this.tray.setContextMenu(contextMenu);
  }

  async msc_stopAllUnified() {
    this.msc_trayBalloon(
      'VPE',
      'Stopping all PM2 apps and dashboard-managed processes…',
    );

    try {
      await this.pm2Manager.stopAll();
    } catch {
      /* ignore */
    }
    try {
      await this.pm2Manager.msc_pm2CleanupRegistered();
    } catch {
      /* ignore */
    }
    try {
      this.projectRunner?.killAll?.();
    } catch {
      /* ignore */
    }

    this.setStatus('Idle');
    this.msc_trayBalloon('VPE', 'All processes stopped.');
  }

  setStatus(status) {
    this.updateMenu(status);
    const tip = `Vader Project Engine — ${status}\n${MSC_TRAY_BRAND}`;
    try {
      this.tray?.setToolTip(tip);
    } catch {
      /* ignore */
    }
  }
}

module.exports = MSC_TrayManager;
