const { ipcMain, BrowserWindow, dialog, shell, nativeImage, app } = require('electron');
const { randomUUID } = require('crypto');
const fs = require('fs');
const path = require('path');
const net = require('net');
const os = require('os');
const { msc_launcherRendererPort } = require('./launcher-port');
const { msc_detectProjectScripts } = require('./project-detection');
const { msc_validateProjectPath } = require('./path-guard');
const { msc_patchPackageJsonStripScriptPorts } = require('./package-json-script-patch');
const isDev = require('electron-is-dev');

let msc_vpeIpcRegistered = false;
/** Node-Launcher UI port; managed projects must avoid this port. */
const MSC_VPE_RENDERER_PORT = msc_launcherRendererPort();
const MAX_THUMB_EDGE = 960;
const MAX_THUMB_BYTES = 512 * 1024;
const VPE_CATALOG_VERSION = 1;
const VPE_SYSTEM_REPAIR_PROJECT_ID = '__vpe_system__';

/**
 * @returns {Promise<boolean>} true if something accepts TCP connections on 127.0.0.1:port
 */
function msc_tcpPortHasListener(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host: '127.0.0.1' });
    let settled = false;
    const done = (listening) => {
      if (settled) return;
      settled = true;
      try {
        socket.destroy();
      } catch (_) {
        /* */
      }
      resolve(listening);
    };
    socket.setTimeout(250);
    socket.on('connect', () => done(true));
    socket.on('timeout', () => done(false));
    socket.on('error', () => done(false));
    socket.on('close', () => done(false));
  });
}

function msc_netstatListeningPidsOnPort(port) {
  const { execSync } = require('child_process');
  const pids = new Set();
  try {
    const out = execSync('netstat -ano', { windowsHide: true }).toString();
    const portRe = new RegExp(`:${port}\\s`);
    for (const line of out.split(/\r?\n/)) {
      if (!/\bLISTENING\b/i.test(line) || !portRe.test(line)) continue;
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (/^\d+$/.test(pid)) pids.add(pid);
    }
  } catch (_) {
    /* */
  }
  return [...pids];
}

function msc_tasklistImageName(pid) {
  const { execSync } = require('child_process');
  try {
    const out = execSync(`tasklist /FI "PID eq ${pid}" /NH /FO CSV`, { windowsHide: true }).toString();
    const m = out.match(/^"([^"]+)"/);
    return m ? m[1].toLowerCase() : '';
  } catch (_) {
    return '';
  }
}

function msc_promptVaultPath() {
  return path.join(app.getPath('userData'), 'prompt-vault.json');
}

/** v1.2.2 — stable-id master Prompt Vault rows (merged on read / seeded on empty file). */
function msc_promptVaultMasterItems() {
  const updatedAt = new Date().toISOString();
  return [
    {
      id: 'vpe-master-vader-sync',
      title: 'Vader Sync',
      versionLabel: 'MSC Media Engine v1.2.3',
      updatedAt,
      bodyMd:
        '**Command:** `npm run vader:clean-sync`\n\n' +
        '**Full Production Build:** Wipes `dist`, runs a fresh Dev App, then makes the `.exe`.',
    },
    {
      id: 'vpe-master-rapid-prototype',
      title: 'Rapid Prototype',
      versionLabel: 'MSC Media Engine v1.2.3',
      updatedAt,
      bodyMd:
        '**Command:** `npm run vader:dev`\n\n' +
        '**Speed prototyping:** Starts Next.js and Electron; both stop when you close the window.',
    },
    {
      id: 'vpe-master-validation-forge',
      title: 'Validation & Forge',
      versionLabel: 'MSC Media Engine v1.2.3',
      updatedAt,
      bodyMd:
        '**Command:** `npm run vader:sync`\n\n' +
        '**Verify then ship:** Validates the update in dev, then builds the `.exe` once the dev window is closed.',
    },
    {
      id: 'vpe-master-version-bump-sync',
      title: 'Version Bump Sync',
      versionLabel: 'MSC Media Engine v1.2.3',
      updatedAt,
      bodyMd:
        '**Command:** `npm run vader:clean-sync`\n\n' +
        '**Version bump path:** Wipes `dist`, verifies dev, and creates a fresh release build.',
    },
    {
      id: 'vpe-master-scorched-earth',
      title: 'Scorched Earth',
      versionLabel: 'MSC Media Engine v1.2.3',
      updatedAt,
      bodyMd:
        '**Command:** `npm run vpe:force-clear`\n\n' +
        '**Emergency purge:** Kills project-root Node processes over 1GB RSS (matches `vpe:force-clear` filter). Use with care.',
    },
  ];
}

/**
 * Ensures built-in masters exist without overwriting user-edited rows (match by id only).
 */
function msc_mergePromptVaultMasters(parsed) {
  const masters = msc_promptVaultMasterItems();
  const items = Array.isArray(parsed?.items) ? parsed.items.slice() : [];
  const seen = new Set(items.map((i) => (i && i.id ? String(i.id) : '')).filter(Boolean));
  let injected = false;
  for (let i = masters.length - 1; i >= 0; i -= 1) {
    const m = masters[i];
    if (!seen.has(m.id)) {
      items.unshift(m);
      seen.add(m.id);
      injected = true;
    }
  }
  return {
    data: { v: typeof parsed?.v === 'number' ? parsed.v : 1, items },
    injected,
  };
}

/**
 * v1.2.1 — avoid "[object Event]" / empty stringification in dev-terminal IPC paths.
 * DOM `Event` instances are not real `Error`s; log `type`/`message` when present.
 */
function msc_formatCaughtForTerminal(reason) {
  if (reason == null) return 'Unknown failure';
  if (typeof reason === 'string') return reason;
  if (typeof reason !== 'object') return String(reason);
  if (reason instanceof Error) return reason.message || reason.name || '[Error]';
  const o = /** @type {any} */ (reason);
  if (typeof o.message === 'string' && o.message.trim()) return o.message;
  if (typeof Event !== 'undefined' && reason instanceof Event) {
    const t = typeof o.type === 'string' ? o.type : 'unknown';
    return o.message ? `DOM Event (${t}): ${o.message}` : `DOM Event (${t})`;
  }
  if (typeof o.type === 'string') {
    try {
      const s = JSON.stringify(o);
      return s && s !== '{}' ? s : `Event-like (${o.type})`;
    } catch (_) {
      return `Event-like (${o.type})`;
    }
  }
  try {
    const s = JSON.stringify(o);
    if (s && s !== '{}') return s;
  } catch (_) {
    /* fall through */
  }
  return o?.constructor?.name ? `[${o.constructor.name}]` : '[unserializable]';
}

/**
 * Slash commands and diagnostics for VPE embedded terminal IPC.
 * Managed-project **dev** auto-install (`npm install && npm run dev`) is implemented in **`project-runner.startDev`**
 * (see **v1.2.3**), not in this handler — keep terminal slash-commands separate from the dev pipeline.
 * @param {unknown} payload
 */
async function msc_executeTerminalCommandInner(store, payload) {
  const { execSync } = require('child_process');
  const commandRaw = typeof payload === 'string' ? payload : payload?.command;
  if (typeof commandRaw !== 'string') {
    return { ok: false, output: 'Missing command string.' };
  }
  const command = commandRaw;
  const trimmed = command.trim().toLowerCase();

  if (trimmed === '/clean') {
    try {
      const stalePorts = [3000, 3001];
      const debugPorts = [9222];
      let output = 'Vader: Initiating port cleanup...\n';

      const killPidOnPort = (port, pid, aggressive) => {
        let processInfo = '';
        try {
          processInfo = execSync(`tasklist /FI "PID eq ${pid}" /NH`).toString().trim();
        } catch {
          return `PID ${pid} on port ${port}: tasklist failed (skipped)\n`;
        }
        const exe = (processInfo.split(/\s+/)[0] || '').toLowerCase();
        const isNodeLike = /node\.exe|electron\.exe/i.test(processInfo);
        if (aggressive) {
          if (isNodeLike) {
            execSync(`taskkill /F /PID ${pid}`);
            return `Killed ${exe || 'process'} PID ${pid} on port ${port}\n`;
          }
          return `Skipped PID ${pid} on port ${port} (${exe || 'non-node'}) — not Node/Electron\n`;
        }
        const isVpeProcess = /node\.exe|electron\.exe|Vader-Project-Engine\.exe/i.test(processInfo);
        if (!isVpeProcess) {
          return `Non-VPE process (${exe}) on port ${port}. Skipped. Use /clean again after closing external debug tools.\n`;
        }
        execSync(`taskkill /F /PID ${pid}`);
        return `Killed process ${pid} on port ${port}\n`;
      };

      const sweepPort = (port, aggressive) => {
        try {
          const netstat = execSync(`netstat -ano | findstr :${port}`).toString();
          const pids = new Set(
            netstat
              .split('\n')
              .map((l) => l.trim().split(/\s+/).pop())
              .filter((p) => p && !Number.isNaN(Number(p)) && p !== '0'),
          );
          if (pids.size === 0) {
            output += `Port ${port} already clear.\n`;
            return;
          }
          for (const pid of pids) {
            output += killPidOnPort(port, pid, aggressive);
          }
        } catch {
          output += `Port ${port} already clear.\n`;
        }
      };

      for (const p of stalePorts) sweepPort(p, true);
      for (const p of debugPorts) sweepPort(p, false);

      return { ok: true, output: output + 'Cleanup complete.' };
    } catch (err) {
      return { ok: false, output: `Cleanup failed: ${msc_formatCaughtForTerminal(err)}` };
    }
  }

  if (trimmed === '/ports') {
    try {
      const output = execSync('netstat -ano | findstr LISTENING').toString();
      return { ok: true, output };
    } catch (err) {
      return { ok: false, output: `Failed to list ports: ${msc_formatCaughtForTerminal(err)}` };
    }
  }

  if (trimmed === '/vpe') {
    try {
      const output = execSync('tasklist /FI "IMAGENAME eq Vader-Project-Engine.exe"').toString();
      return { ok: true, output };
    } catch (err) {
      return { ok: false, output: `Failed to check VPE: ${msc_formatCaughtForTerminal(err)}` };
    }
  }

  if (trimmed === '/diag') {
    try {
      const ping = execSync('ping 8.8.8.8 -n 1').toString();
      const nodeVer = execSync('node -v').toString().trim();
      const output = `VPE Diagnostic:\n- Node Version: ${nodeVer}\n- Network: ${ping.includes('TTL=') ? 'ONLINE' : 'OFFLINE'}\n- Time: ${new Date().toLocaleString()}`;
      return { ok: true, output };
    } catch (err) {
      return { ok: false, output: `Diagnostic failed: ${msc_formatCaughtForTerminal(err)}` };
    }
  }

  if (trimmed === '/vader') {
    const vaderAscii = `
   _________________
  < DARK SIDE ONLINE >
   -----------------
          \\
           \\    ___
               /   \\
              |  O  |
              \\ ___ /
               |   |
              /|   |\\
             / |___| \\
    `;
    const stats = execSync('powershell -Command "Get-CimInstance Win32_OperatingSystem | Select-Object -ExpandProperty Caption"').toString().trim();
    return { ok: true, output: `${vaderAscii}\nSystem: ${stats}` };
  }

  if (trimmed === '/repair') {
    try {
      const activeProjectId = payload?.activeProjectId;
      const project = activeProjectId ? store.getProject(activeProjectId) : null;
      if (project && project.path) {
        execSync('npm cache clean --force', { cwd: project.path });
        return { ok: true, output: `Vader: npm cache purged for ${project.name}. Deep repair initiated.` };
      }
      execSync('npm cache clean --force');
      return { ok: true, output: 'Vader: global npm cache purged. Deep repair initiated.' };
    } catch (err) {
      return { ok: false, output: `Repair failed: ${msc_formatCaughtForTerminal(err)}` };
    }
  }

  return { ok: false, output: 'Unknown slash command.' };
}

function msc_emitRepairRunsChanged() {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win?.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
      win.webContents.send('vpe:repair-runs-changed');
    }
  }
}

/**
 * Port "healthy for VPE" if free, or only node/electron LISTEN (normal dev stack).
 * @returns {Promise<{ inUse: boolean, ok: boolean }>}
 */
async function msc_launcherPortRowHealthInner(port) {
  const inUse = await msc_tcpPortHasListener(port);
  if (!inUse) return { inUse: false, ok: true };
  const pids = msc_netstatListeningPidsOnPort(port);
  if (!pids.length) return { inUse: true, ok: true };
  for (const pid of pids) {
    const img = msc_tasklistImageName(pid);
    if (img && img !== 'node.exe' && img !== 'electron.exe') {
      return { inUse: true, ok: false };
    }
  }
  return { inUse: true, ok: true };
}

const MSC_PORT_HEALTH_RACE_MS = 500;
/** CDP bridge: bounded probe before optional targeted purge (v1.1.8). */
const MSC_PORT9222_FORGIVENESS_MS = 400;

function msc_purgeProtectedPids() {
  const mainPid = String(process.pid);
  const parentPid =
    typeof process.ppid === 'number' && process.ppid > 0 ? String(process.ppid) : null;
  const protectedPids = new Set([mainPid]);
  if (parentPid) protectedPids.add(parentPid);
  return protectedPids;
}

/**
 * @param {Set<string>} protectedPids
 * @param {string | number} pid
 * @param {number} port
 * @param {boolean} aggressive
 * @param {Array<{ pid: string, port: number, img: string }> | null} killed
 */
function msc_purgeTryKillListeningPid(protectedPids, pid, port, aggressive, killed) {
  const ps = String(pid);
  if (protectedPids.has(ps)) return;
  if (process.platform !== 'win32') return;
  const { execSync } = require('child_process');
  const img = msc_tasklistImageName(ps);
  if (!aggressive && img !== 'node.exe' && img !== 'electron.exe') return;
  try {
    execSync(`taskkill /F /PID ${ps}`, { windowsHide: true, stdio: 'ignore' });
    if (killed) killed.push({ pid: ps, port, img: img || (aggressive ? 'aggressive-9222' : '') });
  } catch (_) {
    /* Process may already be gone */
  }
}

/** Kill listeners on 9222 only (no IPC health re-check — avoids recursion with port-health). */
async function msc_purgeListenersOnPort9222() {
  const { setTimeout: delay } = require('timers/promises');
  const protectedPids = msc_purgeProtectedPids();
  for (const pid of msc_netstatListeningPidsOnPort(9222)) {
    msc_purgeTryKillListeningPid(protectedPids, pid, 9222, false, null);
  }
  if (process.platform === 'win32') {
    for (const pid of msc_netstatListeningPidsOnPort(9222)) {
      msc_purgeTryKillListeningPid(protectedPids, pid, 9222, true, null);
    }
  }
  await delay(300);
}

/**
 * v1.1.8: On quit under `VPE_LAUNCHER_FORGE`, sweep renderer/managed dev ports synchronously so
 * `concurrently` can finish without zombies. Does **not** use `taskkill /IM node.exe` (that would kill
 * the parent `npm` and abort `vader:post-dev-forge`).
 */
function msc_onDevExitCompanionSweep() {
  if (process.platform !== 'win32') return;
  const protectedPids = msc_purgeProtectedPids();

  // Always clear launcher-managed listeners in dev quit paths.
  for (const port of [3000, 3001, 9222]) {
    for (const pid of msc_netstatListeningPidsOnPort(port)) {
      msc_purgeTryKillListeningPid(protectedPids, pid, port, false, null);
    }
  }

  msc_killNodeProcessesOwnedByRepoRoot(protectedPids);

  // Companion MCP ghost sweep: target known sidecar command lines.
  try {
    const { execSync } = require('child_process');
    const probe = execSync(
      'powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match \'postgres-mcp|browser-tools-server|@agentdeskai/browser-tools-server\' } | Select-Object -ExpandProperty ProcessId"',
      { windowsHide: true, stdio: 'pipe' },
    )
      .toString()
      .split(/\r?\n/)
      .map((v) => v.trim())
      .filter((v) => /^\d+$/.test(v));
    for (const pid of probe) {
      if (protectedPids.has(pid)) continue;
      try {
        execSync(`taskkill /F /PID ${pid}`, { windowsHide: true, stdio: 'ignore' });
      } catch (_) {
        /* process may already be gone */
      }
    }
  } catch (_) {
    /* ignore companion sweep failures */
  }
}

/** v1.2.0: kill `node.exe` whose command line mentions this repo (`process.cwd`), never launcher PIDs. */
function msc_killNodeProcessesOwnedByRepoRoot(protectedPids) {
  if (process.platform !== 'win32') return;
  let rootResolved = '';
  try {
    rootResolved = path.resolve(process.cwd()).replace(/\r|\n|\x00/g, '');
  } catch (_) {
    return;
  }
  if (!rootResolved) return;

  const { spawnSync } = require('child_process');
  const guardCsv = [...protectedPids].join(',');

  const ps = [
    `$rootRaw = $env:VPE_REPO_ROOT_KILL`,
    `if (-not $rootRaw) { exit 0 }`,
    `$needle = ($rootRaw -replace '\\', '/')`,
    `$guards = @{}`,
    `foreach ($g in (($env:VPE_GUARD_PIDS -split ',') | ForEach-Object { $_.Trim() })) {`,
    `  if ($g -match '^\\d+$') { $guards[$g] = $true }`,
    `}`,
    `Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | ForEach-Object {`,
    `  $pidStr = \"$($_.ProcessId)\"`,
    `  if ($guards.ContainsKey($pidStr)) { return }`,
    `  $cmd = $_.CommandLine`,
    `  if (-not $cmd) { return }`,
    `  $hay = ($cmd -replace '\\', '/')`,
    `  if ($hay.IndexOf($needle, [StringComparison]::OrdinalIgnoreCase) -lt 0) { return }`,
    `  Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue`,
    `}`,
  ].join('; ');

  const encoded = Buffer.from(ps, 'utf16le').toString('base64');
  try {
    spawnSync(
      'powershell.exe',
      ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
      {
        windowsHide: true,
        stdio: 'ignore',
        env: { ...process.env, VPE_REPO_ROOT_KILL: rootResolved, VPE_GUARD_PIDS: guardCsv },
      },
    );
  } catch (_) {
    /* best-effort */
  }
}

/** Same as inner, but never hangs the UI: on timeout assume port free (forge-friendly). */
async function msc_launcherPortRowHealth(port) {
  // v1.2.0: zero-wait dev override — NET always green in dev; real cleanup happens on quit-sweep / purge.
  if (isDev && [3000, 3001, 9222].includes(port)) {
    return { inUse: false, ok: true, forced: true };
  }
  if (port === 9222) {
    let row = null;
    try {
      row = await Promise.race([
        msc_launcherPortRowHealthInner(9222),
        new Promise((resolve) => {
          setTimeout(() => resolve(null), MSC_PORT9222_FORGIVENESS_MS);
        }),
      ]);
    } catch {
      row = null;
    }
    if (row == null || row.inUse) {
      await msc_purgeListenersOnPort9222();
    }
    return { inUse: false, ok: true };
  }
  return await Promise.race([
    msc_launcherPortRowHealthInner(port),
    new Promise((resolve) => {
      setTimeout(() => resolve({ inUse: false, ok: true }), MSC_PORT_HEALTH_RACE_MS);
    }),
  ]);
}

/**
 * Purge orphan TCP listeners on 3000 / 3001 / 9222. Never targets the main app (`process.pid`)
 * or `process.ppid`. Uses `taskkill /F /PID` only (no `/T`) so the Electron tree is not torn down.
 */
async function msc_purgeLauncherPorts() {
  const { execSync } = require('child_process');
  const { setTimeout: delay } = require('timers/promises');
  const protectedPids = msc_purgeProtectedPids();
  const killed = [];

  if (process.platform === 'win32') {
    try {
      execSync('taskkill /F /IM chrome.exe /FI "WINDOWTITLE eq VPE*"', {
        windowsHide: true,
        stdio: 'ignore',
      });
    } catch (_) {
      /* No matching Chrome window */
    }
  }

  const ports = [3000, 3001, 9222];
  for (const port of ports) {
    for (const pid of msc_netstatListeningPidsOnPort(port)) {
      msc_purgeTryKillListeningPid(protectedPids, pid, port, false, killed);
    }
  }

  if (process.platform === 'win32') {
    for (const pid of msc_netstatListeningPidsOnPort(9222)) {
      msc_purgeTryKillListeningPid(protectedPids, pid, 9222, true, killed);
    }
  }

  await delay(500);
  const ph3000 = await msc_launcherPortRowHealth(3000);
  const ph3001 = await msc_launcherPortRowHealth(3001);
  const ph9222 = await msc_launcherPortRowHealth(9222);
  const stackOk = ph3000.ok && ph3001.ok;
  const forgeReady = !ph3000.inUse && !ph3001.inUse;
  return {
    ok: true,
    killed,
    p3000: ph3000.inUse,
    p3001: ph3001.inUse,
    p9222: ph9222.inUse,
    healthy: stackOk,
    forgeReady,
  };
}

function msc_rowToCatalogPayload(row) {
  return {
    id: row.id,
    name: row.name,
    path: row.path,
    port: Number(row.port),
    thumbnail_url: row.thumbnail_url ?? null,
    start_script: row.start_script,
    build_script: row.build_script,
    pkg_manager: row.pkg_manager,
    node_modules_missing: row.node_modules_missing ?? null,
  };
}

function msc_parseCatalogJson(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('VPE: Catalog file is not valid JSON.');
  }
  const ver = data.vpe_catalog_version;
  if (ver != null && Number(ver) !== VPE_CATALOG_VERSION) {
    throw new Error(
      `VPE: Unsupported catalog version (expected ${VPE_CATALOG_VERSION}).`,
    );
  }
  if (!Array.isArray(data.projects)) {
    throw new Error('VPE: Catalog file has no projects array.');
  }
  return data.projects;
}

function msc_safeExportBasename(name) {
  const s = String(name || 'project')
    .replace(/[<>:"/\\|?*]+/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 80);
  return s || 'project';
}

/** Host CPU tick snapshot for `os.cpus()` delta math (ASAR-safe; no external packages). */
/** @type {{ idle: number, total: number } | null} */
let msc_vpeLastCpuSnapshot = null;
/** @type {number | null} */
let msc_vpeLastCpuPercent = null;

function msc_vpeSumCpuTicks() {
  let user = 0;
  let nice = 0;
  let sys = 0;
  let idle = 0;
  let irq = 0;
  const cpus = os.cpus();
  if (!cpus?.length) return { idle: 0, total: 0 };

  for (const cpu of cpus) {
    const t = cpu.times;
    user += t.user;
    nice += t.nice;
    sys += t.sys;
    idle += t.idle;
    irq += t.irq || 0;
  }
  const total = user + nice + sys + idle + irq;
  return { idle, total };
}

/** @returns {number | null} */
function msc_vpeHostCpuPercentSinceLastPoll() {
  const cur = msc_vpeSumCpuTicks();

  if (!msc_vpeLastCpuSnapshot) {
    msc_vpeLastCpuSnapshot = cur;
    return null;
  }

  const idleDiff = cur.idle - msc_vpeLastCpuSnapshot.idle;
  const totalDiff = cur.total - msc_vpeLastCpuSnapshot.total;
  msc_vpeLastCpuSnapshot = cur;

  if (totalDiff <= 0) {
    return msc_vpeLastCpuPercent;
  }

  const busyRatio = 1 - idleDiff / totalDiff;
  const pct = Math.round(busyRatio * 100);
  if (!Number.isFinite(pct)) {
    return msc_vpeLastCpuPercent;
  }
  msc_vpeLastCpuPercent = Math.max(0, Math.min(100, pct));
  return msc_vpeLastCpuPercent;
}

function msc_formatProcessUptime(sec) {
  const s = Math.floor(Number(sec) || 0);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${Math.max(0, m)}m`;
}

function msc_bytesToGbLabel(bytes) {
  return `${(Number(bytes) / (1024 ** 3)).toFixed(2)} GB`;
}

/** @param {number | string | null | undefined} bytes */
function msc_bytesToGbNumber(bytes) {
  const b = Number(bytes);
  if (!Number.isFinite(b) || b < 0) return 0;
  return Math.round((b / (1024 ** 3)) * 100) / 100;
}

/**
 * Plain JSON-serializable snapshot for `vpe:get-system-stats` (structured clone / IPC safe).
 * PM2 daemon line uses a live resolver when provided (never a one-shot boot flag).
 * @param {{
 *   cpuPercent: number | null
 *   totalMem: number
 *   freeMem: number
 *   pm2Online?: boolean
 *   getPm2RpcConnected?: () => boolean
 *   pm2ProcessCount: number
 *   vpeUptimeSec: number
 *   vpeUptimeLabel: string
 *   projectsActive: number
 *   projectsTotal: number
 * }} p
 * `getPm2RpcConnected` (when set) wins over legacy `pm2Online`.
 */
function msc_buildSanitizedSystemStatsPayload(p) {
  const totalMem = Number(p.totalMem);
  const freeMem = Number(p.freeMem);
  const usedMem = Math.max(0, (Number.isFinite(totalMem) ? totalMem : 0) - (Number.isFinite(freeMem) ? freeMem : 0));
  const memDenom = Number.isFinite(totalMem) && totalMem > 0 ? totalMem : 0;
  const memPct = memDenom > 0 ? Math.min(100, Math.round((usedMem / memDenom) * 100)) : 0;

  const rawCpu = p.cpuPercent;
  const cpuNum =
    rawCpu != null && Number.isFinite(Number(rawCpu))
      ? Math.max(0, Math.min(100, Math.round(Number(rawCpu))))
      : -1;

  let pm2On = false;
  try {
    if (typeof p.getPm2RpcConnected === 'function') {
      pm2On = Boolean(p.getPm2RpcConnected());
    } else {
      pm2On = Boolean(p.pm2Online);
    }
  } catch (_) {
    pm2On = false;
  }

  const pm2Count = Math.max(0, Math.floor(Number(p.pm2ProcessCount) || 0));

  return {
    cpu: cpuNum,
    memory: {
      total: msc_bytesToGbNumber(totalMem),
      free: msc_bytesToGbNumber(freeMem),
      used: msc_bytesToGbNumber(usedMem),
      percentage: memPct,
    },
    pm2: {
      status: pm2On ? 'online' : 'offline',
      activeCount: pm2Count,
    },
    uptime: {
      seconds: Math.max(0, Math.floor(Number(p.vpeUptimeSec) || 0)),
      label: String(p.vpeUptimeLabel ?? '—'),
    },
    projects: {
      active: Math.max(0, Math.floor(Number(p.projectsActive) || 0)),
      total: Math.max(0, Math.floor(Number(p.projectsTotal) || 0)),
    },
  };
}

/** Writable thumbnail scratch dir (not inside read-only app.asar). */
function msc_userDataMediaThumbnailsDir() {
  try {
    if (typeof app?.getPath === 'function') {
      return path.join(app.getPath('userData'), 'media', 'thumbnails');
    }
  } catch (_) {
    /* non-Electron */
  }
  return path.join(process.cwd(), 'media', 'thumbnails');
}

/** @param {unknown} err */
function msc_fallbackSystemStats(err) {
  const msg = err && typeof err === 'object' && 'message' in err ? String(err.message) : String(err ?? '');
  console.error('[VPE get-system-stats]:', msg || err);
  try {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const vpeUptimeSec = process.uptime();
    const vpeUptimeLabel = msc_formatProcessUptime(vpeUptimeSec);
    return msc_buildSanitizedSystemStatsPayload({
      cpuPercent: null,
      totalMem,
      freeMem,
      getPm2RpcConnected: () => false,
      pm2ProcessCount: 0,
      vpeUptimeSec,
      vpeUptimeLabel,
      projectsActive: 0,
      projectsTotal: 0,
    });
  } catch {
    return msc_buildSanitizedSystemStatsPayload({
      cpuPercent: null,
      totalMem: 0,
      freeMem: 0,
      getPm2RpcConnected: () => false,
      pm2ProcessCount: 0,
      vpeUptimeSec: process.uptime(),
      vpeUptimeLabel: '—',
      projectsActive: 0,
      projectsTotal: 0,
    });
  }
}

function msc_optimizeThumbnailIfNeeded(src, fallbackDest) {
  const ext = path.extname(src).toLowerCase();
  // Preserve animated GIF behavior by skipping re-encode.
  if (ext === '.gif') {
    fs.copyFileSync(src, fallbackDest);
    return fallbackDest;
  }

  const img = nativeImage.createFromPath(src);
  if (img.isEmpty()) {
    fs.copyFileSync(src, fallbackDest);
    return fallbackDest;
  }

  const { width, height } = img.getSize();
  const largestEdge = Math.max(width || 0, height || 0);
  const srcSize = fs.statSync(src).size;
  const shouldResize = largestEdge > MAX_THUMB_EDGE;
  const shouldCompress = srcSize > MAX_THUMB_BYTES;

  if (!shouldResize && !shouldCompress) {
    fs.copyFileSync(src, fallbackDest);
    return fallbackDest;
  }

  const resized = shouldResize
    ? img.resize({
        width: width >= height ? MAX_THUMB_EDGE : undefined,
        height: height > width ? MAX_THUMB_EDGE : undefined,
        quality: 'good',
      })
    : img;

  // JPEG yields significantly smaller payloads for preview thumbnails.
  const outPath = fallbackDest.replace(/\.[^.]+$/, '.jpg');
  let quality = shouldCompress ? 78 : 84;
  let out = resized.toJPEG(quality);
  while (out.length > MAX_THUMB_BYTES && quality > 50) {
    quality -= 6;
    out = resized.toJPEG(quality);
  }
  fs.writeFileSync(outPath, out);
  return outPath;
}

/**
 * @param {import('./project-runner')} projectRunner
 * @param store SqlitePersistence | JsonPersistence
 * @param {{ pm2Manager?: import('./pm2-manager') | null }} vpeRuntime mutated after PM2 init (`pm2Manager` set on main)
 */
function msc_registerVpeIpc(projectRunner, store, vpeRuntime = {}) {
  const msc_isPortInUse = (port) =>
    new Promise((resolve) => {
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
      socket.setTimeout(250);
      socket.on('connect', () => done(true));
      socket.on('timeout', () => done(false));
      socket.on('error', () => done(false));
      socket.on('close', () => done(false));
    });

  /** First port considered for managed projects (renderer uses MSC_VPE_RENDERER_PORT). */
  const msc_managedPortFloor = () => MSC_VPE_RENDERER_PORT + 1;

  /** Next free TCP port excluding renderer and other registered projects (optionally exclude one id during reassignment). */
  const msc_findAvailablePort = async (preferred = null, excludeProjectId = null, isNextJs = false) => {
    const floor = msc_managedPortFloor();
    let candidate = preferred == null ? floor : Number(preferred);
    
    if (isNextJs && candidate === MSC_VPE_RENDERER_PORT) {
        candidate = 3001;
    } else if (candidate <= MSC_VPE_RENDERER_PORT) {
        candidate = floor;
    }

    const otherPorts = new Set(
      store
        .getProjects()
        .filter((p) => (excludeProjectId ? p.id !== excludeProjectId : true))
        .map((p) => Number(p.port))
        .filter((n) => Number.isFinite(n) && n > 0),
    );

    for (let i = 0; i < 220; i += 1) {
      const probe = candidate + i;
      if (probe <= MSC_VPE_RENDERER_PORT || otherPorts.has(probe)) continue;
      // eslint-disable-next-line no-await-in-loop
      const used = await msc_isPortInUse(probe);
      if (!used) return probe;
    }
    return floor + 200;
  };

  const msc_assertPortNotReserved = (portLike) => {
    const parsed = Number(portLike);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error('VPE: Invalid project port.');
    }
    if (parsed === MSC_VPE_RENDERER_PORT) {
      throw new Error(
        `VPE: Port ${parsed} is reserved for Node-Launcher UI (port ${MSC_VPE_RENDERER_PORT}). Managed projects must use higher ports.`,
      );
    }
    return parsed;
  };

  if (msc_vpeIpcRegistered) return;
  msc_vpeIpcRegistered = true;

  const msc_emitProjectsUpdated = () => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win?.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
        win.webContents.send('vpe:projects-updated', {
          projects: store.getProjects(),
        });
      }
    }
  };

  const msc_vpeStopAllEngines = async () => {
    const pm = vpeRuntime.pm2Manager;
    try {
      if (pm && typeof pm.stopAll === 'function') await pm.stopAll();
    } catch (_) {
      /* ignore */
    }
    try {
      if (pm && typeof pm.msc_pm2CleanupRegistered === 'function') {
        await pm.msc_pm2CleanupRegistered();
      }
    } catch (_) {
      /* ignore */
    }
    try {
      projectRunner.killAll();
    } catch (_) {
      /* ignore */
    }
    for (const p of store.listProjectsAlphabetical()) {
      if (p.status === 'running') {
        try {
          store.clearProjectHealth(p.id);
          store.setProjectStopped(p.id);
        } catch (_) {
          /* ignore */
        }
      }
    }
  };

  ipcMain.handle('vpe:getProjects', () => store.listProjectsAlphabetical().map(row => {
    const root = msc_validateProjectPath(row.path);
    const det = msc_detectProjectScripts(root);
    return {
      ...row,
      node_modules_missing: det.node_modules_missing
    };
  }));

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

  ipcMain.handle('vpe:get-system-stats', async () => {
    try {
      const projects = store.listProjectsAlphabetical();
      const projectsActive = projects.filter((p) => p && p.status === 'running').length;
      const projectsTotal = projects.length;

      const totalMem = os.totalmem();
      const freeMem = os.freemem();

      const vpeUptimeSec = process.uptime();
      const vpeUptimeLabel = msc_formatProcessUptime(vpeUptimeSec);

      let cpuPercent = null;
      try {
        cpuPercent = msc_vpeHostCpuPercentSinceLastPoll();
      } catch (cpuErr) {
        const m =
          cpuErr && typeof cpuErr === 'object' && 'message' in cpuErr
            ? String(cpuErr.message)
            : String(cpuErr ?? '');
        console.warn('[VPE get-system-stats] CPU ticks:', m || cpuErr);
      }

      let pm2Online = false;
      let pm2ProcessCount = 0;
      try {
        const pm = vpeRuntime?.pm2Manager;
        pm2Online = Boolean(
          pm && typeof pm.msc_isPm2RpcConnected === 'function' && pm.msc_isPm2RpcConnected(),
        );
        pm2ProcessCount = 0;
      } catch (pm2Err) {
        const m =
          pm2Err && typeof pm2Err === 'object' && 'message' in pm2Err
            ? String(pm2Err.message)
            : String(pm2Err ?? '');
        console.warn('[VPE get-system-stats] PM2 eval:', m || pm2Err);
        pm2Online = false;
        pm2ProcessCount = 0;
      }

      return msc_buildSanitizedSystemStatsPayload({
        cpuPercent,
        totalMem,
        freeMem,
        pm2Online,
        pm2ProcessCount,
        vpeUptimeSec,
        vpeUptimeLabel,
        projectsActive,
        projectsTotal,
      });
    } catch (err) {
      return msc_fallbackSystemStats(err);
    }
  });

  ipcMain.handle('vpe:auto-fix-port', async (_event, projectId) => {
    if (!projectId) throw new Error('VPE: Missing project id');
    const row = store.getProject(projectId);
    if (!row) throw new Error('VPE: Project not found');

    const root = msc_validateProjectPath(row.path);
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
    });
    msc_emitProjectsUpdated();
    return { ok: true, port: newPort, start_script: det.start_script };
  });

  ipcMain.handle('vpe:inspect-project', async (_event, projectPath) => {
    const root = msc_validateProjectPath(projectPath);
    const det = msc_detectProjectScripts(root);
    const suggestedPort = await msc_findAvailablePort(msc_managedPortFloor(), null, det.is_nextjs);
    return {
      ok: true,
      path: root,
      detection: det,
      suggestedPort,
      reservedPort: MSC_VPE_RENDERER_PORT,
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

  /** Same engine path as tray "Stop all (PM2 + dashboard spawns)"; updates SQLite registry. */
  ipcMain.handle('vpe:stop-all', async () => {
    await msc_vpeStopAllEngines();
    msc_emitProjectsUpdated();
    return { ok: true };
  });

  ipcMain.handle('vpe:run-build', async (event, projectId) =>
    projectRunner.runBuild(projectId),
  );

  ipcMain.handle('vpe:save-settings', (event, payload) => {
    const {
      id,
      name,
      path: projectPath,
      port,
      start_script,
      build_script,
      thumbnail_url,
    } = payload;
    if (!id) throw new Error('VPE: Missing project id');

    const root = msc_validateProjectPath(projectPath);
    const det = msc_detectProjectScripts(root);
    const start = (start_script || det.start_script || 'dev').toString();
    const build = (build_script || det.build_script || 'build').toString();

    store.updateProject({
      id,
      name,
      path: root,
      port: msc_assertPortNotReserved(port),
      thumbnail_url: thumbnail_url ?? null,
      start_script: start,
      build_script: build,
      pkg_manager: det.pkg_manager,
    });
    msc_emitProjectsUpdated();
    return { ok: true, detection: det };
  });

  ipcMain.handle('vpe:add-project', async (event, payload) => {
    const root = msc_validateProjectPath(payload.path);
    const det = msc_detectProjectScripts(root);
    const id = payload.id || randomUUID();
    const rawPort = payload.port;
    const portNum =
      rawPort != null && Number.isFinite(Number(rawPort))
        ? Number(rawPort)
        : await msc_findAvailablePort(msc_managedPortFloor(), id, det.is_nextjs);
    store.insertProject({
      id,
      name: payload.name,
      path: root,
      port: msc_assertPortNotReserved(portNum),
      status: 'stopped',
      thumbnail_url: payload.thumbnail_url ?? null,
      start_script: det.start_script,
      build_script: det.build_script,
      pkg_manager: det.pkg_manager,
    });
    msc_emitProjectsUpdated();
    return { ok: true, id };
  });

  ipcMain.handle('vpe:delete-project', (event, projectId) => {
    if (!projectId) throw new Error('VPE: Missing project id');
    projectRunner.stopProject(projectId);
    store.deleteProject(projectId);
    msc_emitProjectsUpdated();
    return { ok: true };
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

        const existing = store.getProject(id);
        if (mode === 'merge' && existing) {
          store.updateProject({
            id,
            name,
            path: root,
            port: portNum,
            thumbnail_url,
            start_script,
            build_script,
            pkg_manager,
          });
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
      title: 'Select project folder',
      properties: ['openDirectory'],
    });
    if (result.canceled || !Array.isArray(result.filePaths) || !result.filePaths[0]) {
      return null;
    }
    return result.filePaths[0];
  });

  ipcMain.handle('vpe:pick-thumbnail', async (_event, projectId) => {
    if (!projectId) throw new Error('VPE: Missing project id');
    const result = await dialog.showOpenDialog({
      title: 'Select project thumbnail image',
      properties: ['openFile'],
      filters: [
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] },
      ],
    });
    if (result.canceled || !result.filePaths?.[0]) return null;

    const src = result.filePaths[0];
    const extRaw = path.extname(src).toLowerCase().replace('.', '');
    const ok = ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(extRaw);
    const extForFile = ok ? `.${extRaw === 'jpeg' ? 'jpg' : extRaw}` : path.extname(src) || '.png';

    const destDir = msc_userDataMediaThumbnailsDir();
    fs.mkdirSync(destDir, { recursive: true });
    const fallbackDest = path.join(destDir, `${projectId}${extForFile}`);
    const dest = msc_optimizeThumbnailIfNeeded(src, fallbackDest);
    const stat = fs.statSync(dest);
    if (stat.size > 12 * 1024 * 1024) {
      throw new Error('VPE: Thumbnail file is too large (max 12 MB).');
    }
    const mimeByExt = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
    };
    const mime = mimeByExt[path.extname(dest).toLowerCase()] || 'image/png';
    const b64 = fs.readFileSync(dest).toString('base64');
    return `data:${mime};base64,${b64}`;
  });

  ipcMain.handle('vpe:open-project-url', async (_event, url) => {
    if (typeof url !== 'string' || !url.trim()) {
      throw new Error('VPE: Missing project URL.');
    }
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('VPE: Only http/https URLs are allowed.');
      }
      await shell.openExternal(parsed.toString());
      return { ok: true };
    } catch (err) {
      throw new Error(err?.message || 'VPE: Invalid project URL.');
    }
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

  ipcMain.handle('vpe:execute-terminal-command', async (_event, payload) => {
    try {
      return await msc_executeTerminalCommandInner(store, payload);
    } catch (reason) {
      const msg = msc_formatCaughtForTerminal(reason);
      console.warn('[VPE terminal IPC]', msg);
      return { ok: false, output: msg };
    }
  });

  ipcMain.handle('vpe:take-state-snapshot', async (event) => {
    const { execSync } = require('child_process');
    const win = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getFocusedWindow();
    const { canceled, filePath } = await dialog.showSaveDialog(win || undefined, {
      title: 'Save VPE State Snapshot',
      defaultPath: `vpe-snapshot-${new Date().toISOString().replace(/[:.]/g, '-')}.vader-checkpoint`,
      filters: [{ name: 'Vader Checkpoint', extensions: ['vader-checkpoint'] }],
    });

    if (canceled || !filePath) return { ok: false };

    try {
      const userData = app.getPath('userData');
      const dbPath = path.join(userData, 'vpe-db', 'database.sqlite');
      const tempDir = path.join(os.tmpdir(), `vpe-snapshot-${randomUUID()}`);
      fs.mkdirSync(tempDir, { recursive: true });

      if (fs.existsSync(dbPath)) {
        fs.copyFileSync(dbPath, path.join(tempDir, 'database.sqlite'));
      }

      const rootEnv = path.join(process.cwd(), '.env');
      const rootEnvLocal = path.join(process.cwd(), '.env.local');
      if (fs.existsSync(rootEnv)) fs.copyFileSync(rootEnv, path.join(tempDir, '.env'));
      if (fs.existsSync(rootEnvLocal)) fs.copyFileSync(rootEnvLocal, path.join(tempDir, '.env.local'));

      const zipPath = path.join(os.tmpdir(), `vpe-snapshot-${randomUUID()}.zip`);
      if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

      const srcPs = tempDir.replace(/'/g, "''");
      const zipPs = zipPath.replace(/'/g, "''");
      execSync(
        `powershell -NoProfile -Command "$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory('${srcPs}', '${zipPs}', [System.IO.Compression.CompressionLevel]::Optimal, $false)"`,
        { stdio: 'pipe', encoding: 'utf-8' },
      );

      if (!fs.existsSync(zipPath)) {
        throw new Error('VPE: Snapshot zip was not created under %TEMP%.');
      }
      const st = fs.statSync(zipPath);
      if (!st.size) throw new Error('VPE: Snapshot zip is empty.');

      const destDir = path.dirname(filePath);
      fs.mkdirSync(destDir, { recursive: true });

      fs.copyFileSync(zipPath, filePath);
      fs.unlinkSync(zipPath);

      fs.rmSync(tempDir, { recursive: true, force: true });

      return { ok: true, path: filePath };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('vpe:restore-state-snapshot', async (event) => {
    const { execSync } = require('child_process');
    const win = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getFocusedWindow();
    const { canceled, filePaths } = await dialog.showOpenDialog(win || undefined, {
      title: 'Restore VPE State Snapshot',
      filters: [{ name: 'Vader Checkpoint', extensions: ['vader-checkpoint'] }],
      properties: ['openFile'],
    });

    if (canceled || !filePaths?.[0]) return { ok: false };

    try {
      // Confirmation dialog
      const { response } = await dialog.showMessageBox(win || undefined, {
        type: 'warning',
        title: 'Restore Snapshot',
        message: 'This will overwrite your current database and settings. Continue?',
        buttons: ['Cancel', 'Restore'],
        defaultId: 0,
      });

      if (response === 0) return { ok: false };

      const filePath = filePaths[0];
      const userData = app.getPath('userData');
      const dbDir = path.join(userData, 'vpe-db');
      const tempDir = path.join(os.tmpdir(), `vpe-restore-${randomUUID()}`);
      fs.mkdirSync(tempDir, { recursive: true });

      // Stop all engines first
      await msc_vpeStopAllEngines();

      // Unzip using PowerShell
      const unzipCmd = `powershell -Command "Expand-Archive -Path """${filePath}""" -DestinationPath """${tempDir}""" -Force"`;
      execSync(unzipCmd);

      // Restore SQLite
      const restoredDb = path.join(tempDir, 'database.sqlite');
      if (fs.existsSync(restoredDb)) {
        fs.mkdirSync(dbDir, { recursive: true });
        fs.copyFileSync(restoredDb, path.join(dbDir, 'database.sqlite'));
      }

      // Restore Envs (optional, risk of breaking local paths if restored on different machine)
      const restoredEnv = path.join(tempDir, '.env');
      if (fs.existsSync(restoredEnv)) fs.copyFileSync(restoredEnv, path.join(process.cwd(), '.env'));

      // Cleanup temp
      fs.rmSync(tempDir, { recursive: true, force: true });

    // Signal reload
    app.relaunch();
    app.exit();

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('vpe:open-explorer', async (_event, folderPath) => {
  if (!folderPath) throw new Error('VPE: Missing folder path');
  try {
    if (fs.existsSync(folderPath)) {
      await shell.openPath(folderPath);
      return { ok: true };
    } else {
      return { ok: false, error: `Path does not exist: ${folderPath}` };
    }
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('vpe:open-shell', async (_event, { path: projectPath, type }) => {
  if (!projectPath) throw new Error('VPE: Missing project path');
  const { exec } = require('child_process');
  try {
    if (type === 'powershell') {
      // Use PowerShell 7 (pwsh.exe) with RunAs Admin and explicit working directory
      const pwshPath = 'C:\\Program Files\\PowerShell\\7\\pwsh.exe';
      const usePwsh = fs.existsSync(pwshPath);
      const shellCmd = usePwsh ? pwshPath : 'powershell.exe';
      
      exec(`start powershell -Command "Start-Process \\"${shellCmd}\\" -ArgumentList \\"-WorkingDirectory \\"\\"${projectPath}\\"\\"\\" -Verb RunAs"`);
    } else {
      exec(`start powershell -Command "Start-Process cmd -ArgumentList \\"/K cd /d \\"\\"${projectPath}\\"\\"\\" -Verb RunAs"`);
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

  ipcMain.handle('vpe:launcher-port-health', async () => {
    const r3000 = await msc_launcherPortRowHealth(3000);
    const r3001 = await msc_launcherPortRowHealth(3001);
    const r9222 = await msc_launcherPortRowHealth(9222);
    const stackOk = r3000.ok && r3001.ok;
    const forgeReady = !r3000.inUse && !r3001.inUse;
    return {
      p3000: r3000.inUse,
      p3001: r3001.inUse,
      p9222: r9222.inUse,
      ok: stackOk,
      forgeReady,
    };
  });

  ipcMain.handle('vpe:purge-launcher-ports', () => msc_purgeLauncherPorts());

  ipcMain.handle('vpe:prompt-vault-read', () => {
    const filePath = msc_promptVaultPath();
    const dir = path.dirname(filePath);

    const writeVault = (data) => {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    };

    if (!fs.existsSync(filePath)) {
      const data = { v: 1, items: msc_promptVaultMasterItems() };
      writeVault(data);
      return { ok: true, data };
    }

    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      const { data, injected } = msc_mergePromptVaultMasters(parsed);
      if (injected) writeVault(data);
      return { ok: true, data };
    } catch (err) {
      const rebuilt = { v: 1, items: msc_promptVaultMasterItems() };
      try {
        writeVault(rebuilt);
      } catch (_) {
        /* disk error — still return rebuilt for UI */
      }
      const m = err && typeof err === 'object' && 'message' in err ? String(err.message) : String(err);
      return { ok: true, data: rebuilt, repairedFromCorruptVault: true, note: m };
    }
  });

  ipcMain.handle('vpe:prompt-vault-write', (_event, data) => {
    if (!data || typeof data !== 'object') throw new Error('VPE: Invalid prompt vault payload');
    const dir = path.dirname(msc_promptVaultPath());
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(msc_promptVaultPath(), JSON.stringify(data, null, 2), 'utf8');
    return { ok: true };
  });

  ipcMain.handle('vpe:kill-process-on-port', async (_event, port) => {
    const { execSync } = require('child_process');
    const mainPid = String(process.pid);
    const parentPid =
      typeof process.ppid === 'number' && process.ppid > 0 ? String(process.ppid) : null;
    const protectedPids = new Set([mainPid]);
    if (parentPid) protectedPids.add(parentPid);
    try {
      const netstat = execSync(`netstat -ano | findstr :${port}`).toString();
      const pids = new Set(netstat.split('\n').map(l => l.trim().split(/\s+/).pop()).filter(p => p && !isNaN(p) && p !== '0'));
      for (const pid of pids) {
        if (protectedPids.has(String(pid))) continue;
        try {
          execSync(`taskkill /F /PID ${pid}`, { windowsHide: true, stdio: 'ignore' });
        } catch (_) {
          /* */
        }
      }
      return { ok: true, message: `Killed listeners on port ${port} (launcher PIDs excluded).` };
    } catch (err) {
      return { ok: false, message: `Failed to clear port ${port}: ${err.message}` };
    }
  });
}

module.exports = { msc_registerVpeIpc, msc_onDevExitCompanionSweep };
