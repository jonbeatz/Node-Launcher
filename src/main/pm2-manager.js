const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const pm2 = require('pm2');
const treeKill = require('tree-kill');
const { msc_launcherRendererPort } = require('./launcher-port');
const { msc_probeHttpHealth } = require('./health-probe');

class MSC_PM2Manager {
  /**
   * @param {import('electron').BrowserWindow} mainWindow
   * @param store SqlitePersistence | JsonPersistence
   */
  constructor(mainWindow, store) {
    this.mainWindow = mainWindow;
    this.store = store;
    this._logBusStarted = false;
    this.init();
  }

  /** Remove or stop PM2 process named `projectId` so it won't fight dashboard spawns */
  async msc_evictPm2Slot(projectId) {
    const id = String(projectId);
    return new Promise((resolve) => {
      pm2.delete(id, (errDel) => {
        if (!errDel) return resolve(true);
        pm2.stop(id, () => resolve(true));
      });
    });
  }

  init() {
    try {
      pm2.connect((err) => {
        if (err) {
          console.error('VPE: PM2 Connection Failed');
          return;
        }
        console.log('VPE: PM2 Connected');
        this.startTelemetryLoop();
        this._ensurePm2LogBus();
      });
    } catch (err) {
      console.error('VPE: PM2 Initialization Error');
    }
  }

  /** Wire PM2 daemon log bus once; forward to SQLite/JSON store + renderer `vpe:log-update`. */
  _ensurePm2LogBus() {
    if (this._logBusStarted) return;
    this._logBusStarted = true;

    pm2.launchBus((err, bus) => {
      if (err || !bus) {
        console.warn('VPE: PM2 log bus unavailable', err?.message ?? err);
        return;
      }

      bus.on('log:out', (packet) => this._routePm2Log(packet, 'info'));
      bus.on('log:err', (packet) => this._routePm2Log(packet, 'warn'));
    });
  }

  _routePm2Log(packet, level) {
    const name =
      packet && packet.process ? String(packet.process.name) : undefined;
    if (!name) return;
    if (!this.store.getProject(name)) return;

    const raw = typeof packet.data === 'string' ? packet.data : String(packet.data ?? '');
    for (const line of raw.split(/\r?\n/)) {
      const msg = line.trimEnd();
      if (!msg.trim()) continue;
      const tagged = `[pm2] ${msg}`;
      const ts = new Date().toISOString();
      try {
        this.store.insertLog(name, ts, level, tagged);
      } catch (_) {
        /* ignore */
      }
      this._sendVpeRenderer(name, ts, level, tagged);
      this._sendLegacyRenderer(name, 'stdout', tagged);
    }
  }

  _sendVpeRenderer(projectId, timestamp, level, message) {
    const w = this.mainWindow;
    if (!w || w.isDestroyed() || !w.webContents || w.webContents.isDestroyed()) return;
    w.webContents.send('vpe:log-update', {
      projectId,
      timestamp,
      level,
      message,
    });
  }

  /** Optional legacy subscriber */
  _nukeStageLog(projectId, message, level = 'info') {
    const ts = new Date().toISOString();
    try {
      this.store.insertLog(projectId, ts, level, message);
    } catch (_) {
      /* ignore */
    }
    this._sendVpeRenderer(projectId, ts, level, message);
  }

  _sendLegacyRenderer(projectId, type, content) {
    const w = this.mainWindow;
    if (!w || w.isDestroyed() || !w.webContents || w.webContents.isDestroyed()) return;
    w.webContents.send('msc_logData', {
      id: projectId,
      type,
      content,
    });
  }

  /**
   * Vader Shield Path Validator — package.json OR vader.lock
   */
  msc_validatePath(projectPath) {
    const absolutePath = path.resolve(projectPath);
    const hasPackageJson = fs.existsSync(path.join(absolutePath, 'package.json'));
    const hasVaderLock = fs.existsSync(path.join(absolutePath, 'vader.lock'));

    if (!hasPackageJson && !hasVaderLock) {
      throw new Error(
        `Security Violation: Path ${absolutePath} is not a valid VPE project.`,
      );
    }
    return absolutePath;
  }

  /** Rows shaped like legacy IPC consumers expect */
  getProjectsLegacyShape() {
    return this.store.getProjects().map((row) => ({
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

  /** @deprecated Prefer store.getProjects() */
  getProjects() {
    return this.getProjectsLegacyShape();
  }

  _pmScriptCandidates(pkg) {
    if (process.platform !== 'win32') return pkg;
    if (pkg === 'npm') return 'npm.cmd';
    if (pkg === 'pnpm') return 'pnpm.cmd';
    if (pkg === 'yarn') return 'yarn.cmd';
    return pkg;
  }

  async startProject(projectId) {
    const row = this.store.getProject(projectId);
    if (!row) throw new Error('Project not found');

    const validatedPath = this.msc_validatePath(row.path);
    await this.msc_evictPm2Slot(projectId);

    const pkg = (row.pkg_manager || 'npm').toLowerCase();
    const script = row.start_script || 'dev';

    const scriptBin = this._pmScriptCandidates(pkg === 'pnpm' ? 'pnpm' : pkg === 'yarn' ? 'yarn' : 'npm');

    return new Promise((resolve, reject) => {
      pm2.start(
        {
          name: String(row.id),
          cwd: validatedPath,
          script: scriptBin,
          args: ['run', script],
          env: {
            ...process.env,
            NODE_ENV: 'development',
            VPE_OPTIMIZED: 'true',
          },
          autorestart: false,
          watch: false,
        },
        (errStart, apps) => {
          if (errStart) reject(errStart);
          else resolve(apps);
        },
      );
    });
  }

  async stopProject(projectId) {
    return new Promise((resolve, reject) => {
      pm2.stop(projectId, (err) => {
        if (err) reject(err);
        else resolve(true);
      });
    });
  }

  async nukeProject(projectId) {
    const row = this.store.getProject(projectId);
    if (!row) throw new Error('Project not found');

    const validatedPath = this.msc_validatePath(row.path);
    const label = row.name || row.id;
    console.log(`[VPE] Initiating NUKE sequence for ${label} at ${validatedPath}`);
    this._nukeStageLog(projectId, '[nuke:stage] kill_started');

    await new Promise((resolve) => {
      pm2.describe(projectId, (errDesc, description) => {
        if (
          !errDesc &&
          description &&
          description[0] &&
          description[0].pid
        ) {
          treeKill(description[0].pid, 'SIGKILL', () => {
            pm2.stop(projectId, () => resolve(true));
          });
        } else {
          resolve(true);
        }
      });
    });
    this._nukeStageLog(projectId, '[nuke:stage] kill_done');

    const nmPath = path.join(validatedPath, 'node_modules');
    const nextPath = path.join(validatedPath, '.next');

    console.log('[VPE] Purging directories...');
    this._nukeStageLog(projectId, '[nuke:stage] purge_started');
    try {
      if (fs.existsSync(nmPath))
        fs.rmSync(nmPath, { recursive: true, force: true, maxRetries: 3 });
      if (fs.existsSync(nextPath))
        fs.rmSync(nextPath, { recursive: true, force: true, maxRetries: 3 });
    } catch (err) {
      console.error('[VPE] Purge failed:', err);
      this._nukeStageLog(
        projectId,
        `[nuke:stage] purge_error ${err?.message ?? err}`,
        'warn',
      );
    }
    this._nukeStageLog(projectId, '[nuke:stage] purge_done');

    const pkgManager = row.pkg_manager || 'npm';
    console.log(`[VPE] Running ${pkgManager} install...`);
    this._nukeStageLog(projectId, '[nuke:stage] install_started');

    const installProcess = spawn(pkgManager, ['install'], {
      cwd: validatedPath,
      shell: true,
      env: { ...process.env, ADBLOCK: '1', DISABLE_OPENCOLLECTIVE: '1' },
    });

    const forward = (chunk, stream) => {
      const text = `[nuke:${stream}] ${chunk.toString()}`;
      try {
        this.store.insertLog(
          projectId,
          new Date().toISOString(),
          stream === 'stderr' ? 'warn' : 'info',
          text.trim(),
        );
      } catch (_) {
        /* ignore */
      }
      this._sendVpeRenderer(projectId, new Date().toISOString(),
        stream === 'stderr' ? 'warn' : 'info',
        text.trim(),
      );
      this._sendLegacyRenderer(projectId, stream, chunk.toString());
    };

    installProcess.stdout?.on('data', (data) => forward(data, 'stdout'));
    installProcess.stderr?.on('data', (data) => forward(data, 'stderr'));

    installProcess.on('close', (code) => {
      console.log(`[VPE] Install completed with code ${code}`);
      this._nukeStageLog(projectId, `[nuke:stage] install_exit code=${code}`);
      if (code === 0) this.startProject(projectId);

      const launcher = msc_launcherRendererPort();
      const port = Number(row.port);
      const delayMs = code === 0 ? 5000 : 0;
      setTimeout(() => {
        if (code !== 0) {
          this._nukeStageLog(
            projectId,
            '[nuke:stage] verify_health_skipped install_failed',
            'warn',
          );
          return;
        }
        void (async () => {
          this._nukeStageLog(
            projectId,
            `[nuke:stage] verify_health port=${port} (launcher UI ${launcher})`,
          );
          try {
            const { statusCode, reachedServer } = await msc_probeHttpHealth(port);
            const line = !reachedServer
              ? '[nuke:stage] verify_health_result offline'
              : `[nuke:stage] verify_health_result HTTP ${statusCode}`;
            this._nukeStageLog(projectId, line, 'info');
          } catch (e) {
            this._nukeStageLog(
              projectId,
              `[nuke:stage] verify_health_error ${e?.message ?? e}`,
              'warn',
            );
          }
        })();
      }, delayMs);
    });

    return { success: true };
  }

  stopAll() {
    return new Promise((resolve, reject) => {
      pm2.stop('all', (err) => {
        if (err) reject(err);
        else resolve(true);
      });
    });
  }

  /** Delete all managed PM2 apps whose names match VPE registry IDs */
  async msc_pm2CleanupRegistered() {
    for (const row of this.store.getProjects()) {
      await this.msc_evictPm2Slot(row.id);
    }
  }

  startTelemetryLoop() {
    setInterval(() => {
      pm2.list((err, list) => {
        if (err) return;
        const w = this.mainWindow;
        if (!w || w.isDestroyed() || !w.webContents || w.webContents.isDestroyed()) return;
        const telemetry = list.map((proc) => ({
          id: proc.name,
          cpu: proc.monit.cpu,
          memory: proc.monit.memory,
          status: proc.pm2_env.status,
        }));
        w.webContents.send('msc_telemetryUpdate', telemetry);
      });
    }, 2000);
  }
}

module.exports = MSC_PM2Manager;
