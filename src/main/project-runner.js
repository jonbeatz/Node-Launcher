const EventEmitter = require('events');
const { spawn, execSync, exec } = require('child_process');
const fs = require('fs');
const net = require('net');
const path = require('path');
const treeKill = require('tree-kill');
const { msc_validateProjectPath } = require('./path-guard');
const { msc_ipcEnrichProjectsRow } = require('./project-detection');
const { msc_probeHttpHealth } = require('./health-probe');
const { msc_launcherRendererPort } = require('./launcher-port');
const { msc_healthPollDelayMs, MSC_HEALTH_FIRST_MS } = require('./health-scheduler');

const MSC_VPE_RENDERER_PORT = msc_launcherRendererPort();
/** No TCP/connect failures persisted to SQLite until elapsed — avoids false red “Offline” while Next/boot compiles. */
const MSC_STARTUP_GRACE_MS = 20000;
const MSC_STARTUP_MAX_CONSECUTIVE_HEALTH_FAILS = 6;
/** v1.2.3 — first HTTP health probe after auto `install && dev` pipeline (npm install can run long). */
const MSC_HEALTH_FIRST_INSTALL_MS = 10000;

/**
 * @param {string} projectRoot
 * @returns {{ needsAutoInstall: boolean, v0Prototype: boolean, hasPkg: boolean }}
 */
function msc_analyzeDependencyBootstrap(projectRoot) {
  const pkgPath = path.join(projectRoot, 'package.json');
  const nmPath = path.join(projectRoot, 'node_modules');
  const v0UiPath = path.join(projectRoot, 'components', 'ui');
  const hasPkg = fs.existsSync(pkgPath);
  const hasNm = fs.existsSync(nmPath);
  const v0Prototype =
    hasPkg && !hasNm && fs.existsSync(v0UiPath);
  const needsAutoInstall = hasPkg && !hasNm;
  return { needsAutoInstall, v0Prototype, hasPkg };
}

/**
 * Shell one-liner: install then run dev/start script (v0 zero-config bootstrap).
 */
function msc_shellInstallThenDev(row) {
  const script = (row.start_script || 'dev').toString();
  const pm = row.pkg_manager || 'npm';
  if (pm === 'yarn') return `yarn install && yarn run ${script}`;
  if (pm === 'pnpm') return `pnpm install && pnpm run ${script}`;
  return `npm install && npm run ${script}`;
}

function msc_spawnShellCommand(command, cwd, env) {
  if (process.platform === 'win32') {
    return spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', command], {
      cwd,
      env,
      windowsHide: true,
    });
  }
  return spawn('/bin/sh', ['-c', command], { cwd, env });
}

class MSC_ProjectRunner extends EventEmitter {
  /**
   * @param {import('electron').BrowserWindow | null} mainWindow
   * @param store SqlitePersistence | JsonPersistence
   */
  constructor(mainWindow, store) {
    super();
    this.mainWindow = mainWindow;
    this.store = store;
    /** @type {Map<string, { dev?: import('child_process').ChildProcess, build?: import('child_process').ChildProcess, healthPollTimer?: NodeJS.Timeout, healthStartedAt?: number, healthFailCount?: number }>} */
    this.children = new Map();
    /** Serialize HTTP health checks across projects (one in flight). */
    this._healthProbeChain = Promise.resolve();
  }

  setMainWindow(win) {
    this.mainWindow = win;
  }

  _broadcast(channel, payload) {
    const w = this.mainWindow;
    if (w && !w.isDestroyed() && w.webContents && !w.webContents.isDestroyed()) {
      w.webContents.send(channel, payload);
    }
  }

  _persistAndBroadcastLog(projectId, level, message) {
    const ts = new Date().toISOString();
    this.store.insertLog(projectId, ts, level, message);
    this._broadcast('vpe:log-update', {
      projectId,
      timestamp: ts,
      level,
      message,
    });
  }

  _emitProjectsRefresh() {
    const rows =
      typeof this.store.listProjectsAlphabetical === 'function'
        ? this.store.listProjectsAlphabetical()
        : this.store.getProjects();
    this._broadcast('vpe:projects-updated', {
      projects: rows.map((row) => msc_ipcEnrichProjectsRow(row)),
    });
  }

  _queueHealthProbe(fn) {
    const run = async () => {
      try {
        await fn();
      } catch (_) {
        /* ignore */
      }
    };
    const p = this._healthProbeChain.then(run, run);
    this._healthProbeChain = p.catch(() => {});
    return p;
  }

  _clearHealthPolling(projectId) {
    const rec = this.children.get(projectId);
    if (rec?.healthPollTimer) {
      clearTimeout(rec.healthPollTimer);
      rec.healthPollTimer = undefined;
    }
  }

  async _healthPollCycle(projectId) {
    const rec = this.children.get(projectId);
    if (!rec?.dev) return;
    if (rec.healthPollTimer) {
      clearTimeout(rec.healthPollTimer);
      rec.healthPollTimer = undefined;
    }

    let row = this.store.getProject(projectId);
    if (!row) return;

    await this._queueHealthProbe(async () => {
      const r = this.children.get(projectId);
      if (!r?.dev) return;
      row = this.store.getProject(projectId);
      if (!row) return;

      const { statusCode, reachedServer } = await msc_probeHttpHealth(row.port);
      const code = typeof statusCode === 'number' ? statusCode : null;
      const ts = new Date().toISOString();
      const rActive = this.children.get(projectId);
      const elapsedSinceStart =
        Date.now() - (rActive?.healthStartedAt || Date.now());
      const pastStartupGrace = elapsedSinceStart >= MSC_STARTUP_GRACE_MS;
      // HTTP response (any code): always persist so redirects/503 show truthfully.
      if (reachedServer) {
        this.store.setProjectHealth(projectId, code, ts, true);
      } else if (pastStartupGrace) {
        this.store.setProjectHealth(projectId, null, ts, false);
      }
      // Before grace ends, TCP/connect failures-only: leave DB health cleared → UI stays “Booting…”
      const failedProbe = !reachedServer;
      const activeRec = this.children.get(projectId);
      if (activeRec) {
        activeRec.healthFailCount = failedProbe
          ? Number(activeRec.healthFailCount || 0) + 1
          : 0;
      }
      let msg;
      let lvl = 'info';
      if (!reachedServer) {
        msg = `[vpe] health probe: no TCP/HTTP response on ${row.port} (offline or still compiling)`;
        lvl = pastStartupGrace ? 'warn' : 'info';
      } else if (code != null && code >= 500) {
        msg = `[vpe] health probe: HTTP ${code} (server error)`;
        lvl = 'warn';
      } else if (code != null && code >= 200 && code < 300) {
        msg = `[vpe] health probe: HTTP ${code}`;
        lvl = 'info';
      } else {
        msg = `[vpe] health probe: HTTP ${code}`;
        lvl = 'warn';
      }
      this._persistAndBroadcastLog(projectId, lvl, msg);

      // Safety guard: only terminate if startup grace has passed AND repeated health probes failed.
      if (activeRec?.dev) {
        const elapsed = Date.now() - (activeRec.healthStartedAt || Date.now());
        const failCount = Number(activeRec.healthFailCount || 0);
        if (
          elapsed >= MSC_STARTUP_GRACE_MS &&
          failCount >= MSC_STARTUP_MAX_CONSECUTIVE_HEALTH_FAILS &&
          activeRec.dev.pid
        ) {
          this._persistAndBroadcastLog(
            projectId,
            'warn',
            `[vpe] safety stop: ${failCount} consecutive failed health probes after ${Math.round(elapsed / 1000)}s`,
          );
          treeKill(activeRec.dev.pid, 'SIGTERM', () => {});
          return;
        }
      }

      this._emitProjectsRefresh();
    });

    const r2 = this.children.get(projectId);
    if (r2?.dev) {
      const elapsed = Date.now() - (r2.healthStartedAt || Date.now());
      const delay = msc_healthPollDelayMs(elapsed);
      r2.healthPollTimer = setTimeout(() => {
        void this._healthPollCycle(projectId);
      }, delay);
    }
  }

  _attachChildStreams(row, child, mode, opts = {}) {
    const { installBootstrapRec } = opts;
    const npmReady =
      /(next dev|next-server|ready - started|Local:\s*http|▲ Next\.js|vite v\d|compiled \S+ in|✓\s*(Ready|Starting))/i;

    const flushLines = (bufRef, chunk, streamLevel) => {
      bufRef.buf += chunk.toString('utf8');
      const lines = bufRef.buf.split(/\r?\n/);
      bufRef.buf = lines.pop() ?? '';
      for (const raw of lines) {
        const line = raw.trimEnd();
        if (!line) continue;
        if (
          installBootstrapRec &&
          installBootstrapRec.installBootstrap &&
          npmReady.test(line)
        ) {
          this._broadcast('vpe:bootstrap-dev-visible', { projectId: row.id });
          installBootstrapRec.installBootstrap = false;
        }
        const lvl = streamLevel === 'stderr' ? 'warn' : 'info';
        this._persistAndBroadcastLog(row.id, lvl, line);
      }
    };

    const outBuf = { buf: '' };
    const errBuf = { buf: '' };

    child.stdout?.on('data', (d) => flushLines(outBuf, d, 'stdout'));
    child.stderr?.on('data', (d) => flushLines(errBuf, d, 'stderr'));

    child.on('error', (err) => {
      this._persistAndBroadcastLog(
        row.id,
        'error',
        `[vpe] spawn error: ${err?.message ?? err}`,
      );
      this.emit('error', { projectId: row.id, mode, err });
    });

    child.on('close', (code, signal) => {
      const tail = (outBuf.buf + errBuf.buf).trim();
      if (tail) {
        this._persistAndBroadcastLog(row.id, 'info', tail);
      }
      this._persistAndBroadcastLog(
        row.id,
        code === 0 ? 'info' : 'warn',
        `[vpe] ${mode} process exited (code ${code}, signal ${signal ?? 'none'})`,
      );
      this.emit('exit', { projectId: row.id, mode, code, signal });
    });
  }

  _spawnScript(row, script, mode) {
    const cwd = msc_validateProjectPath(row.path);
    const pm = row.pkg_manager || 'npm';
    const cmd =
      process.platform === 'win32'
        ? pm === 'yarn'
          ? 'yarn.cmd'
          : pm === 'pnpm'
            ? 'pnpm.cmd'
            : 'npm.cmd'
        : pm;
    const args = ['run', script];

    const configuredPort = Number(row.port);
    const env = this._projectChildEnv(row, configuredPort);

    const child = spawn(cmd, args, {
      cwd,
      shell: false,
      env,
    });

    this._attachChildStreams(row, child, mode);
    return child;
  }

  /** `npm install && npm run <script>` (or yarn/pnpm). */
  _spawnInstallThenDevPipeline(row, installBootstrapRec) {
    const cwd = msc_validateProjectPath(row.path);
    const configuredPort = Number(row.port);
    const env = this._projectChildEnv(row, configuredPort);
    const command = msc_shellInstallThenDev(row);
    const child = msc_spawnShellCommand(command, cwd, env);
    this._attachChildStreams(row, child, 'dev', { installBootstrapRec });
    return child;
  }

  _projectChildEnv(row, configuredPort) {
    const env = { ...process.env, FORCE_COLOR: '1' };
    if (Number.isFinite(configuredPort) && configuredPort > 0) {
      env.PORT = String(configuredPort);
      env.NEXT_PORT = String(configuredPort);
      env.DEV_PORT = String(configuredPort);
    }
    return env;
  }

  _assertPortConfigured(portLike) {
    const parsed = Number(portLike);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error('VPE: Invalid project port. Use a managed port above the launcher UI (e.g. 3001).');
    }
    if (parsed === MSC_VPE_RENDERER_PORT) {
      throw new Error(
        `VPE: Port ${parsed} is reserved for Node-Launcher UI. Choose another port.`,
      );
    }
    return parsed;
  }

  _isPortInUse(port) {
    return new Promise((resolve) => {
      const socket = net.createConnection({ port, host: '127.0.0.1' });
      let settled = false;
      const done = (inUse) => {
        if (settled) return;
        settled = true;
        try {
          socket.destroy();
        } catch (_) {
          /* ignore */
        }
        resolve(inUse);
      };
      socket.setTimeout(350);
      socket.on('connect', () => done(true));
      socket.on('timeout', () => done(false));
      socket.on('error', () => done(false));
      socket.on('close', () => done(false));
    });
  }

  async _forceReleasePortWindows(port) {
    if (process.platform !== 'win32') return;
    const p = Number(port);
    if (!Number.isFinite(p) || p <= 0) return;
    try {
      const stdout = execSync(`netstat -ano | findstr :${p}`, {
        windowsHide: true,
      }).toString();
      const lines = stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      const killed = new Set();
      for (const line of lines) {
        const parts = line.split(/\s+/);
        const proto = parts[0] || '';
        const localAddress = parts[1] || '';
        const pid = parts[parts.length - 1];
        // netstat shape:
        // TCP 127.0.0.1:3006 0.0.0.0:0 LISTENING 9572
        // TCP [::1]:3006 [::1]:51500 ESTABLISHED 9572
        // Guard to only kill processes owning this exact local port.
        if (!/^tcp/i.test(proto)) continue;
        if (!new RegExp(`:${p}$`).test(localAddress)) continue;
        if (!pid || pid === '0' || Number.isNaN(Number(pid)) || killed.has(pid)) continue;
        try {
          execSync(`taskkill /F /PID ${pid}`, { windowsHide: true, stdio: 'ignore' });
          killed.add(pid);
          console.log(`[VPE] Force-killed ghost process ${pid} on Port ${p}`);
        } catch (_) {
          // Kill failed silently; preflight will still re-check the port.
        }
      }
    } catch (_) {
      // Port clear or netstat/findstr did not match.
    }
    // Last-resort cleanup if the port is still occupied by a lingering node process.
    const stillInUse = await this._isPortInUse(p);
    if (stillInUse) {
      try {
        execSync('taskkill /F /IM node.exe', { windowsHide: true, stdio: 'ignore' });
        console.warn(`[VPE] Last-resort cleanup: taskkill /F /IM node.exe (port ${p} still occupied)`);
      } catch (_) {
        /* ignore */
      }
    }
  }

  async _runDevPreflight(row) {
    // Validates path/root and package.json before process spawn.
    const projectRoot = msc_validateProjectPath(row.path);
    const port = this._assertPortConfigured(row.port);
    this._assertScriptPortCompatibility(projectRoot, row, port);
    let inUse = await this._isPortInUse(port);
    if (inUse) {
      await this._forceReleasePortWindows(port);
      inUse = await this._isPortInUse(port);
    }
    if (inUse) {
      throw new Error(
        [
          `VPE: Port ${port} is already in use.`,
          `Stop the process using ${port} or pick another project port in Settings.`,
        ].join(' '),
      );
    }
  }

  _assertScriptPortCompatibility(projectRoot, row, configuredPort) {
    const packageJsonPath = path.join(projectRoot, 'package.json');
    let packageJson;
    try {
      packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    } catch (_) {
      return;
    }
    const scripts =
      packageJson && typeof packageJson.scripts === 'object'
        ? packageJson.scripts
        : {};
    const scriptName = row.start_script || 'dev';
    const command = typeof scripts[scriptName] === 'string' ? scripts[scriptName] : '';
    if (!command) return;
    const m = command.match(/(?:^|\s)(?:-p|--port)\s*(?:=)?\s*(\d{2,5})(?:\s|$)/i);
    if (!m || !m[1]) return;
    const scriptPort = Number(m[1]);
    if (!Number.isFinite(scriptPort) || scriptPort <= 0) return;
    if (scriptPort !== configuredPort) {
      throw new Error(
        [
          `VPE: Start script "${scriptName}" hardcodes port ${scriptPort} but project is configured for ${configuredPort}.`,
          `Update package.json script or set project port to ${scriptPort}.`,
        ].join(' '),
      );
    }
  }

  getRow(projectId) {
    const row = this.store.getProject(projectId);
    if (!row) throw new Error('Project not found');
    return row;
  }

  async startDev(row) {
    let rec = this.children.get(row.id);
    if (!rec) {
      rec = {};
      this.children.set(row.id, rec);
    }
    if (rec.dev) {
      throw new Error('Dev process already running for this project');
    }

    await this._runDevPreflight(row);

    const projectRoot = msc_validateProjectPath(row.path);
    const boot = msc_analyzeDependencyBootstrap(projectRoot);
    let installBootstrap = false;

    /** @type {{ installing?: boolean, projectKind?: string }} */
    const extra = {};

    /** @type {import('child_process').ChildProcess} */
    let child;

    if (boot.needsAutoInstall) {
      installBootstrap = true;
      rec.installBootstrap = true;
      if (boot.v0Prototype) {
        this._persistAndBroadcastLog(
          row.id,
          'info',
          '[VPE] v0 project detected. Missing dependencies. Launching msc_autoRepairInstaller...',
        );
        extra.installing = true;
        extra.projectKind = 'v0-prototype';
      } else {
        this._persistAndBroadcastLog(
          row.id,
          'info',
          '[VPE] Missing node_modules. Running install before dev (`npm install && npm run …`).',
        );
        extra.installing = true;
      }
      child = this._spawnInstallThenDevPipeline(row, rec);
    } else {
      this._persistAndBroadcastLog(
        row.id,
        'info',
        `[vpe] starting dev (${row.pkg_manager} run ${row.start_script})`,
      );
      child = this._spawnScript(row, row.start_script, 'dev');
    }

    rec.dev = child;
    rec.healthFailCount = 0;

    this.store.setProjectRunning(row.id);
    this.store.clearProjectHealth(row.id);
    this._emitProjectsRefresh();

    rec.healthStartedAt = Date.now();
    const firstProbeMs =
      installBootstrap ? MSC_HEALTH_FIRST_INSTALL_MS : MSC_HEALTH_FIRST_MS;
    rec.healthPollTimer = setTimeout(() => {
      void this._healthPollCycle(row.id);
    }, firstProbeMs);

    child.on('close', (code, signal) => {
      const r = this.children.get(row.id);
      if (!r || r.dev !== child) return;
      this._clearHealthPolling(row.id);
      r.dev = undefined;
      r.healthFailCount = 0;
      r.installBootstrap = false;
      this.store.clearProjectHealth(row.id);
      this.store.setProjectStopped(row.id);
      this._emitProjectsRefresh();
    });

    this.emit('start', {
      projectId: row.id,
      mode: 'dev',
      installing: !!extra.installing,
      projectKind: extra.projectKind,
    });
    return { ok: true, status: 'running', ...extra };
  }

  stopDev(projectId) {
    const rec = this.children.get(projectId);
    if (!rec?.dev) {
      this.store.clearProjectHealth(projectId);
      this.store.setProjectStopped(projectId);
      if (rec) rec.installBootstrap = false;
      this._emitProjectsRefresh();
      return { ok: true, status: 'stopped' };
    }

    this._clearHealthPolling(projectId);
    const pid = rec.dev.pid;
    this._persistAndBroadcastLog(
      projectId,
      'info',
      `[vpe] stopping dev (pid ${pid})`,
    );
    treeKill(pid, 'SIGTERM', () => {});
    rec.dev = undefined;
    rec.installBootstrap = false;
    this.store.clearProjectHealth(projectId);
    this.store.setProjectStopped(projectId);
    this._emitProjectsRefresh();
    this.emit('stop', { projectId, mode: 'dev' });
    return { ok: true, status: 'stopped' };
  }

  async toggleStatus(projectId) {
    const row = this.getRow(projectId);
    const rec = this.children.get(projectId);
    if (rec?.dev) {
      return this.stopDev(projectId);
    }
    return this.startDev(row);
  }

  runBuild(projectId) {
    const row = this.getRow(projectId);
    let rec = this.children.get(row.id);
    if (!rec) {
      rec = {};
      this.children.set(row.id, rec);
    }
    if (rec.build) {
      throw new Error('Build already running for this project');
    }

    this._persistAndBroadcastLog(
      row.id,
      'info',
      `[vpe] starting build (${row.pkg_manager} run ${row.build_script})`,
    );

    const child = this._spawnScript(row, row.build_script, 'build');
    rec.build = child;
    child.on('close', () => {
      const r = this.children.get(row.id);
      if (r) r.build = undefined;
    });
    this.emit('start', { projectId: row.id, mode: 'build' });
    return { ok: true };
  }

  /** Stops dev + build for one project (registry delete, app quit, etc.). */
  stopProject(projectId) {
    const rec = this.children.get(projectId);
    this._clearHealthPolling(projectId);
    if (rec?.build?.pid) treeKill(rec.build.pid, 'SIGTERM', () => {});
    if (rec?.dev?.pid) treeKill(rec.dev.pid, 'SIGTERM', () => {});
    if (rec) {
      rec.dev = undefined;
      rec.build = undefined;
      rec.installBootstrap = false;
    }
    this.store.clearProjectHealth(projectId);
    this.store.setProjectStopped(projectId);
    this._emitProjectsRefresh();
    return { ok: true };
  }

  killAll() {
    for (const [, rec] of this.children) {
      if (rec.healthPollTimer) {
        clearTimeout(rec.healthPollTimer);
        rec.healthPollTimer = undefined;
      }
      rec.installBootstrap = false;
      if (rec.dev?.pid) treeKill(rec.dev.pid, 'SIGTERM', () => {});
      if (rec.build?.pid) treeKill(rec.build.pid, 'SIGTERM', () => {});
    }
    this.children.clear();
  }
}

module.exports = MSC_ProjectRunner;
