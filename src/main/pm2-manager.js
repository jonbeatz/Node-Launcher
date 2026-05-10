const { spawn } = require('child_process');
const path = require('path');
const { msc_rendererVaultThumbnailHref } = require('./vpe-thumbnail-url');
const fs = require('fs');
const { msc_getPm2 } = require('./pm2-client');
const pm2 = msc_getPm2();
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
    /** PM2 programmatic client considered connected (see `msc_ensureConnected` + `pm2.list`). */
    this._pm2RpcConnected = false;
    /** @type {Promise<boolean> | null} */
    this._pm2ConnectInFlight = null;
    /** @type {ReturnType<typeof setInterval> | null} */
    this._telemetryInterval = null;
    this.init();
  }

  /**
   * @returns {boolean}
   */
  msc_isPm2RpcConnected() {
    return this._pm2RpcConnected === true && this._msc_hasActiveSpawnedProjects();
  }

  _msc_hasActiveSpawnedProjects() {
    try {
      const projects =
        this.store && typeof this.store.getProjects === 'function'
          ? this.store.getProjects()
          : [];
      return Array.isArray(projects) && projects.some((p) => p && p.status === 'running');
    } catch (_) {
      return false;
    }
  }

  /**
   * Idempotent connect; coalesces concurrent callers. Project launch errors must not call this.
   * @returns {Promise<boolean>}
   */
  async msc_ensureConnected() {
    if (this._pm2RpcConnected) return true;
    if (this._pm2ConnectInFlight) return this._pm2ConnectInFlight;

    const connectAttempt = new Promise((resolve) => {
      let settled = false;
      const finish = (ok) => {
        if (settled) return;
        settled = true;
        resolve(Boolean(ok));
      };
      const timeout = setTimeout(() => {
        console.warn('[VPE] PM2 connect timeout');
        this._pm2RpcConnected = false;
        finish(false);
      }, 1500);
      try {
        pm2.connect((err) => {
          clearTimeout(timeout);
          if (err) {
            console.warn('[VPE] PM2 connect failed:', err?.message ?? err);
            this._pm2RpcConnected = false;
            finish(false);
            return;
          }
          this._pm2RpcConnected = true;
          console.log('VPE: PM2 Connected');
          finish(true);
        });
      } catch (e) {
        clearTimeout(timeout);
        this._pm2RpcConnected = false;
        console.warn('[VPE] PM2 connect threw:', e?.message ?? e);
        finish(false);
      }
    });
    this._pm2ConnectInFlight = connectAttempt.finally(() => {
      this._pm2ConnectInFlight = null;
    });
    return this._pm2ConnectInFlight;
  }

  _msc_stopTelemetryLoop() {
    if (this._telemetryInterval != null) {
      clearInterval(this._telemetryInterval);
      this._telemetryInterval = null;
    }
  }

  /** App shutdown: stop polling and drop client (does not affect project-runner / spawn state). */
  msc_disconnectPm2Rpc() {
    this._msc_stopTelemetryLoop();
    this._pm2RpcConnected = false;
    this._pm2ConnectInFlight = null;
    try {
      if (typeof pm2.disconnect === 'function') {
        pm2.disconnect(() => {});
      }
    } catch (_) {
      /* ignore */
    }
  }

  _msc_resetPm2ClientAfterListFailure() {
    this._pm2RpcConnected = false;
  }

  async _msc_pm2TelemetryTickAsync() {
    try {
      // Always attempt reconnection on every tick while disconnected.
      const connected = await this.msc_ensureConnected();
      if (!connected) return;

      if (!this._logBusStarted) {
        this._ensurePm2LogBus();
      }

      pm2.list((err, list) => {
        try {
          if (err) {
            console.warn('[VPE] pm2.list failed:', err?.message ?? err);
            this._msc_resetPm2ClientAfterListFailure();
            return;
          }
          this._pm2RpcConnected = true;

          const w = this.mainWindow;
          if (!w || w.isDestroyed() || !w.webContents || w.webContents.isDestroyed()) return;
          const safeList = Array.isArray(list) ? list : [];
          const telemetry = safeList.map((proc) => ({
            id: proc?.name,
            cpu: Number(proc?.monit?.cpu) || 0,
            memory: Number(proc?.monit?.memory) || 0,
            status: proc?.pm2_env?.status || 'unknown',
          }));
          w.webContents.send('msc_telemetryUpdate', telemetry);
        } catch (callbackErr) {
          console.warn('[VPE] PM2 telemetry callback failed:', callbackErr?.message ?? callbackErr);
          this._msc_resetPm2ClientAfterListFailure();
        }
      });
    } catch (e) {
      console.warn('[VPE] PM2 telemetry tick:', e?.message ?? e);
      this._pm2RpcConnected = false;
    }
  }

  /**
   * Remove or stop PM2 process named `projectId` so it won't fight dashboard spawns.
   * Must not hang when PM2 RPC is down (was causing `vpe:stop-all` "reply was never sent").
   */
  async msc_evictPm2Slot(projectId) {
    const id = String(projectId);
    const connected = await this.msc_ensureConnected();
    if (!connected) {
      console.warn(`[VPE] msc_evictPm2Slot(${id}): PM2 not connected; skip`);
      return false;
    }
    const timeoutMs = 12000;
    return new Promise((resolve) => {
      const t = setTimeout(() => {
        console.warn(`[VPE] msc_evictPm2Slot(${id}): timeout ${timeoutMs}ms`);
        resolve(false);
      }, timeoutMs);
      const finish = (v) => {
        clearTimeout(t);
        resolve(v);
      };
      try {
        pm2.delete(id, (errDel) => {
          if (!errDel) return finish(true);
          pm2.stop(id, () => finish(true));
        });
      } catch (e) {
        clearTimeout(t);
        console.warn(`[VPE] msc_evictPm2Slot(${id}) threw:`, e?.message ?? e);
        finish(false);
      }
    });
  }

  init() {
    try {
      this.startTelemetryLoop();
    } catch (e) {
      console.error('VPE: PM2 Manager init failed:', e?.message ?? e);
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
      lastThumbnail: msc_rendererVaultThumbnailHref(row, null) ?? row.thumbnail_url ?? null,
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

    const okConnect = await this.msc_ensureConnected();
    if (!okConnect) {
      throw new Error('VPE: PM2 daemon unreachable (connect failed).');
    }

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
          else {
            this._pm2RpcConnected = true;
            resolve(apps);
          }
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

  /**
   * Stop every PM2 process. Ensures RPC is up first (packaged app loads PM2 from asar.unpacked).
   * Resolves false instead of rejecting so unified stop can still kill runner spawns + SQLite.
   */
  async stopAll() {
    const connected = await this.msc_ensureConnected();
    if (!connected) {
      console.warn('[VPE] stopAll: PM2 RPC not connected; skipping pm2.stop(all)');
      return false;
    }
    const timeoutMs = 20000;
    return new Promise((resolve) => {
      const t = setTimeout(() => {
        console.warn(`[VPE] pm2.stop(all) timeout ${timeoutMs}ms`);
        resolve(false);
      }, timeoutMs);
      pm2.stop('all', (err) => {
        clearTimeout(t);
        if (err) {
          console.warn('[VPE] pm2.stop(all):', err?.message ?? err);
          resolve(false);
          return;
        }
        resolve(true);
      });
    });
  }

  /** Delete all managed PM2 apps whose names match VPE registry IDs */
  async msc_pm2CleanupRegistered() {
    const connected = await this.msc_ensureConnected();
    if (!connected) {
      console.warn('[VPE] msc_pm2CleanupRegistered: PM2 not connected; skip evict loop');
      return;
    }
    for (const row of this.store.getProjects()) {
      await this.msc_evictPm2Slot(row.id);
    }
  }

  startTelemetryLoop() {
    if (this._telemetryInterval != null) return;

    void this._msc_pm2TelemetryTickAsync();
    this._telemetryInterval = setInterval(() => {
      void this._msc_pm2TelemetryTickAsync();
    }, 2000);
  }
}

module.exports = MSC_PM2Manager;
