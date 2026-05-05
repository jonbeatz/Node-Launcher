const EventEmitter = require('events');
const { spawn } = require('child_process');
const fs = require('fs');
const net = require('net');
const path = require('path');
const treeKill = require('tree-kill');
const { msc_validateProjectPath } = require('./path-guard');

const MSC_VPE_RENDERER_PORT =
  parseInt(process.env.VPE_RENDERER_PORT || process.env.PORT || '3000', 10) || 3000;

class MSC_ProjectRunner extends EventEmitter {
  /**
   * @param {import('electron').BrowserWindow | null} mainWindow
   * @param store SqlitePersistence | JsonPersistence
   */
  constructor(mainWindow, store) {
    super();
    this.mainWindow = mainWindow;
    this.store = store;
    /** @type {Map<string, { dev?: import('child_process').ChildProcess, build?: import('child_process').ChildProcess }>} */
    this.children = new Map();
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

  _spawnScript(row, script, mode) {
    const cwd = msc_validateProjectPath(row.path);
    const pm = row.pkg_manager || 'npm';
    const cmd = pm;
    let args = ['run', script];
    if (pm === 'yarn') {
      args = ['run', script];
    }

    const configuredPort = Number(row.port);
    const env = { ...process.env, FORCE_COLOR: '1' };
    if (Number.isFinite(configuredPort) && configuredPort > 0) {
      env.PORT = String(configuredPort);
      env.NEXT_PORT = String(configuredPort);
      env.DEV_PORT = String(configuredPort);
    }

    const child = spawn(cmd, args, {
      cwd,
      shell: process.platform === 'win32',
      env,
    });

    const flushLines = (bufRef, chunk, streamLevel) => {
      bufRef.buf += chunk.toString('utf8');
      const lines = bufRef.buf.split(/\r?\n/);
      bufRef.buf = lines.pop() ?? '';
      for (const raw of lines) {
        const line = raw.trimEnd();
        if (!line) continue;
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

    return child;
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

  async _runDevPreflight(row) {
    // Validates path/root and package.json before process spawn.
    const projectRoot = msc_validateProjectPath(row.path);
    const port = this._assertPortConfigured(row.port);
    this._assertScriptPortCompatibility(projectRoot, row, port);
    const inUse = await this._isPortInUse(port);
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

    this._persistAndBroadcastLog(
      row.id,
      'info',
      `[vpe] starting dev (${row.pkg_manager} run ${row.start_script})`,
    );

    const child = this._spawnScript(row, row.start_script, 'dev');
    rec.dev = child;

    this.store.setProjectRunning(row.id);

    child.on('close', () => {
      const r = this.children.get(row.id);
      if (r) r.dev = undefined;
      this.store.setProjectStopped(row.id);
    });

    this.emit('start', { projectId: row.id, mode: 'dev' });
    return { ok: true, status: 'running' };
  }

  stopDev(projectId) {
    const rec = this.children.get(projectId);
    if (!rec?.dev) {
      this.store.setProjectStopped(projectId);
      return { ok: true, status: 'stopped' };
    }

    const pid = rec.dev.pid;
    this._persistAndBroadcastLog(
      projectId,
      'info',
      `[vpe] stopping dev (pid ${pid})`,
    );
    treeKill(pid, 'SIGTERM', () => {});
    rec.dev = undefined;
    this.store.setProjectStopped(projectId);
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
    if (rec?.build?.pid) treeKill(rec.build.pid, 'SIGTERM', () => {});
    if (rec?.dev?.pid) treeKill(rec.dev.pid, 'SIGTERM', () => {});
    if (rec) {
      rec.dev = undefined;
      rec.build = undefined;
    }
    this.store.setProjectStopped(projectId);
    return { ok: true };
  }

  killAll() {
    for (const [, rec] of this.children) {
      if (rec.dev?.pid) treeKill(rec.dev.pid, 'SIGTERM', () => {});
      if (rec.build?.pid) treeKill(rec.build.pid, 'SIGTERM', () => {});
    }
    this.children.clear();
  }
}

module.exports = MSC_ProjectRunner;
