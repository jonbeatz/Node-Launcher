const { ipcMain, BrowserWindow, dialog, shell, nativeImage, app } = require('electron');
const { randomUUID } = require('crypto');
const fs = require('fs');
const path = require('path');
const net = require('net');
const os = require('os');
const { msc_launcherRendererPort } = require('./launcher-port');
const {
  msc_detectProjectScripts,
  msc_classifyProjectType,
  msc_allowedShieldType,
  msc_ipcEnrichProjectsRow,
} = require('./project-detection');
const { msc_validateProjectPath, msc_validateProjectPathForSave } = require('./path-guard');
const {
  VPE_VAULT_INTERNAL_THUMB,
  VPE_VAULT_KEEP_FILE,
  msc_isVaultInternalThumbBase,
  msc_isVaultKeepFile,
  msc_isVaultNonUserNoiseFile,
  msc_safeVaultFolderName,
  msc_projectVaultRootDir,
  msc_projectVaultSovereignInternalThumbAbs,
  msc_projectVaultProjectDir,
  msc_vaultRenameProjectFolder,
} = require('./vpe-vault-paths');
const {
  msc_internalVaultThumbAbsForRow,
  msc_rowUsesInternalVaultThumbnail,
  msc_bumpVaultThumbPulse,
  msc_rendererVaultThumbnailHref,
  msc_normalizeThumbnailUrlForPersistence,
} = require('./vpe-thumbnail-url');
const { pathToFileURL, fileURLToPath } = require('node:url');
const { msc_patchPackageJsonStripScriptPorts } = require('./package-json-script-patch');
const { msc_logInfo } = require('./lib/logger');

/** Align with `system-handlers` / `vpe:scorched-earth`. Override: `VPE_FORCE_DEV_PORT_PURGE_SAFE=1` / `VPE_FORCE_PROD_PORT_PURGE=1`. */
function msc_isActuallyDevEnvironment() {
  if (process.env.VPE_FORCE_PROD_PORT_PURGE === '1') return false;
  if (process.env.VPE_FORCE_DEV_PORT_PURGE_SAFE === '1') return true;
  return !app.isPackaged || process.env.NODE_ENV === 'development';
}

let msc_vpeIpcRegistered = false;
/** Node-Launcher UI port; managed projects must avoid this port. */
const MSC_VPE_RENDERER_PORT = msc_launcherRendererPort();

/** v1.6.0 — sync Windows login-item with persisted `launch_at_login`. */
function msc_applyLoginStartupFromStore(store) {
  try {
    if (typeof store.getSettings !== 'function') return;
    const s = store.getSettings();
    const open = s.launch_at_login === true || s.launch_at_login === 1;
    app.setLoginItemSettings({ openAtLogin: Boolean(open) });
  } catch (e) {
    console.warn('[VPE ERROR]', 'setLoginItemSettings', e?.message ?? e);
  }
}

/** v1.8.4 — human-readable font_style labels for contextual toasts. */
function msc_fontStyleLabel(key) {
  const k = String(key == null ? '' : key).trim();
  const m = {
    vpe_classic: 'VPE Classic',
    mulish_studio: 'Mulish Studio',
    google_sans_modern: 'Google Sans (Modern)',
    noto_sans: 'Noto Sans',
    poppins: 'Poppins',
  };
  return m[k] || k || 'default';
}

/**
 * v1.8.5 — summarize app settings patch for renderer toasts (keys present in `patch` only).
 * @param {Record<string, unknown>} before
 * @param {Record<string, unknown>} after
 * @param {Record<string, unknown>} patch
 */
function msc_summarizeAppSettingsChanges(before, after, patch) {
  if (!before || !after || !patch || typeof patch !== 'object') return 'Preferences saved';
  const keys = Object.keys(patch);
  if (!keys.length) return 'Preferences saved';
  const parts = [];
  const PREFIX = 'Settings Saved: ';
  if (
    keys.includes('launch_at_login') &&
    Boolean(before.launch_at_login === true || before.launch_at_login === 1) !==
      Boolean(after.launch_at_login === true || after.launch_at_login === 1)
  ) {
    parts.push(
      after.launch_at_login === true || after.launch_at_login === 1
        ? 'Launch at login enabled.'
        : 'Launch at login disabled.',
    );
  }
  if (
    keys.includes('minimize_to_tray') &&
    Boolean(before.minimize_to_tray === true || before.minimize_to_tray === 1) !==
      Boolean(after.minimize_to_tray === true || after.minimize_to_tray === 1)
  ) {
    parts.push(
      after.minimize_to_tray === true || after.minimize_to_tray === 1
        ? 'Minimize to tray enabled.'
        : 'Minimize to tray disabled.',
    );
  }
  if (
    keys.includes('auto_start_projects') &&
    Boolean(before.auto_start_projects === true || before.auto_start_projects === 1) !==
      Boolean(after.auto_start_projects === true || after.auto_start_projects === 1)
  ) {
    parts.push(
      after.auto_start_projects === true || after.auto_start_projects === 1
        ? 'Auto-start on launch enabled.'
        : 'Auto-start on launch disabled.',
    );
  }
  if (
    keys.includes('default_view') &&
    String(before.default_view || '') !== String(after.default_view || '')
  ) {
    parts.push(`Default view set to ${String(after.default_view || '').toUpperCase()}.`);
  }
  if (keys.includes('font_style') && String(before.font_style || '') !== String(after.font_style || '')) {
    parts.push(`Font Theme updated to ${msc_fontStyleLabel(after.font_style)}.`);
  }
  if (
    (keys.includes('port_range_start') || keys.includes('port_range_end')) &&
    (Number(before.port_range_start) !== Number(after.port_range_start) ||
      Number(before.port_range_end) !== Number(after.port_range_end))
  ) {
    parts.push(
      `Port Range set to ${Number(after.port_range_start)}-${Number(after.port_range_end)}.`,
    );
  }
  if (
    keys.includes('auto_sync_db_on_close') &&
    Boolean(before.auto_sync_db_on_close === true || before.auto_sync_db_on_close === 1) !==
      Boolean(after.auto_sync_db_on_close === true || after.auto_sync_db_on_close === 1)
  ) {
    parts.push(
      after.auto_sync_db_on_close === true || after.auto_sync_db_on_close === 1
        ? 'Auto-sync DB on close enabled.'
        : 'Auto-sync DB on close disabled.',
    );
  }
  if (!parts.length) return 'No field changes (values already matched)';
  return PREFIX + parts.join(' ');
}

/**
 * v1.8.5 — diff SQLite project row before/after save for contextual toasts (`vpe:save-settings`).
 * @param {Record<string, unknown>|null|undefined} before
 * @param {Record<string, unknown>|null|undefined} after
 */
function msc_summarizeProjectSettingsRowDiff(before, after) {
  if (!after) return 'Registry synchronized';
  if (!before) return 'Project configuration stored';
  const PREFIX = 'Settings Saved: ';
  const parts = [];
  const scriptChanged =
    String(before.start_script || '') !== String(after.start_script || '') ||
    String(before.build_script || '') !== String(after.build_script || '');
  if (String(before.name || '') !== String(after.name || '')) {
    parts.push(`Display name → "${after.name}"`);
  }
  if (String(before.path || '') !== String(after.path || '')) {
    parts.push('Project folder path updated');
  }
  if (Number(before.port) !== Number(after.port)) {
    parts.push(`Port ${after.port} assigned`);
  }
  if (scriptChanged) {
    parts.push('Build Actions updated.');
  }
  const bt = before.thumbnail_url == null ? '' : String(before.thumbnail_url);
  const at = after.thumbnail_url == null ? '' : String(after.thumbnail_url);
  if (bt !== at) {
    parts.push('Thumbnail reference updated');
  }
  const bpt =
    before.project_type == null || String(before.project_type).trim() === ''
      ? 'auto'
      : String(before.project_type);
  const apt =
    after.project_type == null || String(after.project_type).trim() === ''
      ? 'auto'
      : String(after.project_type);
  if (bpt !== apt) {
    parts.push(`Project type → ${apt}`);
  }
  const ba = !!(before.is_archived === true || before.is_archived === 1);
  const aa = !!(after.is_archived === true || after.is_archived === 1);
  if (ba !== aa) {
    parts.push(aa ? 'Marked archived in registry' : 'Removed from archive flag');
  }
  const bn = before.notes == null ? '' : String(before.notes);
  const an = after.notes == null ? '' : String(after.notes);
  if (bn !== an) {
    parts.push('Project journal updated');
  }
  if (String(before.pkg_manager || '') !== String(after.pkg_manager || '')) {
    parts.push(`Package manager → ${after.pkg_manager}`);
  }
  if (!parts.length) return 'Registry synchronized (detection refreshed)';
  return PREFIX + parts.join(' ');
}

/**
 * After boot reconcile, optionally start dev for rows still marked `running` when the user enabled auto-start.
 * @param {import('./db/persistent-store').SqlitePersistence | import('./db/persistent-store').JsonPersistence} store
 * @param {import('./project-runner')} projectRunner
 */
/**
 * After reconcile: restore dev for projects that were `running` at boot but became `stopped`
 * (no HTTP on port). Skips rows still `running` (external server already listening).
 * @param {any} store
 * @param {import('./project-runner')} projectRunner
 * @param {string[]} priorRunningProjectIds IDs with `status === 'running'` before reconcile
 */
async function msc_runAutoStartProjectsIfEnabled(store, projectRunner, priorRunningProjectIds) {
  if (!projectRunner || typeof store.getSettings !== 'function') return;
  const s = store.getSettings();
  if (!(s.auto_start_projects === true || s.auto_start_projects === 1)) return;
  const ids = Array.isArray(priorRunningProjectIds) ? priorRunningProjectIds : [];
  if (!ids.length) return;
  for (const id of ids) {
    if (id == null || String(id).trim() === '') continue;
    let row;
    try {
      row = typeof store.getProject === 'function' ? store.getProject(String(id)) : null;
    } catch (_) {
      row = null;
    }
    if (!row) continue;
    if (row.status === 'running') continue;
    try {
      await projectRunner.startDev(row);
    } catch (e) {
      console.warn('[VPE ERROR]', `auto-start skipped for ${id}`, e?.message ?? e);
    }
  }
}
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

/** v1.2.2+ — stable-id master Prompt Vault rows (merged on read / seeded on empty file). v1.3.3+: `type` for UI badges; v1.6.0: master `versionLabel` MSC line. */
function msc_promptVaultMasterItems() {
  const updatedAt = new Date().toISOString();
  return [
    {
      id: 'vpe-master-vader-sync',
      title: 'Vader Sync',
      type: 'Command',
      versionLabel: 'MSC Media Engine v1.6.0',
      description: 'Full production build: wipe dist, verify dev, ship the Windows installer.',
      updatedAt,
      bodyMd:
        '**Command:** `npm run vader:clean-sync`\n\n' +
        '**Full Production Build:** Wipes `dist`, runs a fresh Dev App, then makes the `.exe`.',
    },
    {
      id: 'vpe-master-rapid-prototype',
      title: 'Rapid Prototype',
      type: 'Command',
      versionLabel: 'MSC Media Engine v1.6.0',
      description: 'Everyday Electron + Next stack; closes clean when you quit the window.',
      updatedAt,
      bodyMd:
        '**Command:** `npm run vader:dev`\n\n' +
        '**Speed prototyping:** Starts Next.js and Electron; both stop when you close the window.',
    },
    {
      id: 'vpe-master-validation-forge',
      title: 'Validation & Forge',
      type: 'Command',
      versionLabel: 'MSC Media Engine v1.6.0',
      description: 'Block until dev exits, then run forge chain (snapshot → guard → build).',
      updatedAt,
      bodyMd:
        '**Command:** `npm run vader:sync`\n\n' +
        '**Verify then ship:** Validates the update in dev, then builds the `.exe` once the dev window is closed.',
    },
    {
      id: 'vpe-master-version-bump-sync',
      title: 'Version Bump Sync',
      type: 'Command',
      versionLabel: 'MSC Media Engine v1.6.0',
      description: 'Version bump path with dist reset before dev + forge.',
      updatedAt,
      bodyMd:
        '**Command:** `npm run vader:clean-sync`\n\n' +
        '**Version bump path:** Wipes `dist`, verifies dev, and creates a fresh release build.',
    },
    {
      id: 'vpe-master-scorched-earth',
      title: 'Scorched Earth',
      type: 'Command',
      versionLabel: 'MSC Media Engine v1.6.0',
      description: 'Heavy Node purge + launcher port recovery (use from System Health when stuck).',
      updatedAt,
      bodyMd:
        '**npm (filter):** `npm run vpe:force-clear`\n\n' +
        '**In-app:** System Health → Scorched Earth (`vpe:scorched-earth`) for global cleanup / `0x2740` socket recovery. **Use with care.**',
    },
    {
      id: 'vpe-master-electron-e2e',
      title: 'Electron E2E Suite',
      type: 'Snippet',
      versionLabel: 'v1.2.8',
      description: 'Builds renderer and runs Playwright smoke tests for Vault/Notes.',
      updatedAt,
      bodyMd: 'npm run test:e2e:electron',
    },
    {
      id: 'vpe-master-playwright-manual',
      title: 'Playwright Manual',
      type: 'Snippet',
      versionLabel: 'v1.2.8',
      description: 'Directly triggers the E2E test runner with process-kill teardown.',
      updatedAt,
      bodyMd: 'npx playwright test --config=playwright.electron.config.ts',
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
 * @param {boolean} [killNodeListenersOnly] Dev footer purge: only `node.exe` — never kill `electron.exe` on 3000/3001 (avoids app exit).
 */
function msc_purgeTryKillListeningPid(
  protectedPids,
  pid,
  port,
  aggressive,
  killed,
  killNodeListenersOnly,
) {
  const ps = String(pid);
  if (protectedPids.has(ps)) return;
  if (process.platform !== 'win32') return;
  const { execSync } = require('child_process');
  const img = msc_tasklistImageName(ps);
  if (killNodeListenersOnly) {
    if (img !== 'node.exe') return;
  } else if (!aggressive && img !== 'node.exe' && img !== 'electron.exe') {
    return;
  }
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
  if (msc_isActuallyDevEnvironment() && [3000, 3001, 9222].includes(port)) {
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
 * Purge orphan TCP listeners on 3000 / 3001 / (9222 production only). Never targets the main app (`process.pid`)
 * or `process.ppid`. Uses `taskkill /F /PID` only (no `/T`) so the Electron tree is not torn down.
 * Dev / unpackaged: **no listener taskkill** on 3000/3001 — those are almost always this repo's Next + managed
 * dev stack; killing `node.exe` there stops `npm run dev:renderer` and can end the whole `concurrently` session.
 * Also **never** touches **9222** in dev (Electron CDP). Set `VPE_FORCE_PROD_PORT_PURGE=1` to restore kills.
 */
async function msc_purgeLauncherPorts() {
  const { execSync } = require('child_process');
  const { setTimeout: delay } = require('timers/promises');
  const protectedPids = msc_purgeProtectedPids();
  const killed = [];
  const devUnpackaged = msc_isActuallyDevEnvironment();

  msc_logInfo(
    `[VPE purge-launcher-ports] devSafe=${devUnpackaged} isPackaged=${app.isPackaged} NODE_ENV=${process.env.NODE_ENV ?? ''}`,
  );

  if (process.platform === 'win32' && !devUnpackaged) {
    try {
      execSync('taskkill /F /IM chrome.exe /FI "WINDOWTITLE eq VPE*"', {
        windowsHide: true,
        stdio: 'ignore',
      });
    } catch (_) {
      /* No matching Chrome window */
    }
  }

  if (!devUnpackaged) {
    const ports = [3000, 3001, 9222];
    for (const port of ports) {
      for (const pid of msc_netstatListeningPidsOnPort(port)) {
        msc_purgeTryKillListeningPid(protectedPids, pid, port, false, killed, false);
      }
    }

    if (process.platform === 'win32') {
      for (const pid of msc_netstatListeningPidsOnPort(9222)) {
        msc_purgeTryKillListeningPid(protectedPids, pid, 9222, true, killed);
      }
    }
  } else {
    msc_logInfo(
      '[VPE purge-launcher-ports] dev-safe: skip 3000/3001/9222 taskkill (use VPE_FORCE_PROD_PORT_PURGE=1 to force)',
    );
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

function msc_normalizeCatalogProjectType(raw) {
  if (raw == null || raw === '') return undefined;
  const s = String(raw).trim().toLowerCase();
  return msc_allowedShieldType(s) ? s : undefined;
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
    /** User override persisted in SQLite; omit on older exports (null → auto-detect). */
    project_type: row.project_type ?? null,
    is_archived:
      row.is_archived === true || row.is_archived === 1 ? true : false,
    notes: row.notes == null || typeof row.notes === 'undefined' ? null : String(row.notes),
    node_modules_missing: row.node_modules_missing ?? null,
  };
}

function msc_normalizeCatalogArchived(raw) {
  if (raw == null || raw === '') return false;
  if (typeof raw === 'boolean') return raw;
  const n = Number(raw);
  if (n === 1) return true;
  const s = String(raw).trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes';
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
 * When `getPm2RpcConnected` is set, its result takes precedence over `pm2Online` for the badge.
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
    id: 'system',
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
    status: pm2On ? 'online' : 'offline'
  };
}

/** @param {string} destDir @param {string} filename */
function msc_vault_destPathNoCollision(destDir, filename) {
  const base = path.basename(filename) || 'file';
  let dest = path.join(destDir, base);
  let i = 1;
  const ext = path.extname(base);
  const stem = path.basename(base, ext) || 'file';
  while (fs.existsSync(dest)) {
    dest = path.join(destDir, `${stem}_${i}${ext}`);
    i += 1;
  }
  return dest;
}

/**
 * Secure copy of an arbitrary file into the project vault directory.
 * @param {string} projectDisplayName Registry `name` (folder key)
 * @param {string} srcPath Absolute source file path
 * @param {string | null | undefined} [projectId] Registry id for vault path fallback
 * @returns {string} Absolute destination path
 */
function msc_vault_copyFile(projectDisplayName, srcPath, projectId) {
  const abs = path.resolve(srcPath);
  if (!fs.existsSync(abs)) throw new Error('VPE: Source file does not exist.');
  const st = fs.statSync(abs);
  if (!st.isFile()) throw new Error('VPE: Vault accepts files only.');
  const destDir = msc_projectVaultProjectDir(projectDisplayName, projectId);
  fs.mkdirSync(destDir, { recursive: true });
  let fname = path.basename(abs);
  if (msc_isVaultInternalThumbBase(fname)) {
    const ext = path.extname(fname) || '';
    fname = `user_ref_${Date.now()}${ext}`;
  }
  const dest = msc_vault_destPathNoCollision(destDir, fname);
  fs.copyFileSync(abs, dest);
  return dest;
}

/**
 * Whether this project's vault has at least one user reference file
 * (excludes internal thumbs, `.vpe_keep`, `_vpe_thumb*`, OS noise). Thumbnail-only or
 * `.vpe_keep`-only folders do **not** enable the paperclip.
 * @param {string} projectDisplayName Registry `name`
 * @param {string | null | undefined} [projectId] Registry id — must match `vpe:getProjects` / vault IPC resolution
 */
function msc_vaultDirHasUserReferenceFiles(projectDisplayName, projectId) {
  try {
    const dir = msc_projectVaultProjectDir(projectDisplayName, projectId);
    if (!fs.existsSync(dir)) return false;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    return entries.some((e) => {
      if (!e.isFile()) return false;
      const nm = e.name;
      if (msc_isVaultKeepFile(nm)) return false;
      if (msc_isVaultNonUserNoiseFile(nm)) return false;
      const lower = String(nm).toLowerCase();
      if (lower.startsWith('_vpe_thumb')) return false;
      return true;
    });
  } catch (_) {
    return false;
  }
}

/** v1.7.1 — previous thumb sidelined before atomic swap. */
const VPE_VAULT_INTERNAL_THUMB_OLD = '_vpe_thumb_OLD.png';
/** v1.7.3 — full PNG written here first, then fsync + rename into `_vpe_thumb.png`. */
const VPE_VAULT_INTERNAL_THUMB_TEMP = '_vpe_thumb_TEMP.png';

function msc_isThumbnailEBUSY(err) {
  if (!err || typeof err !== 'object') return false;
  const code = 'code' in err ? String(err.code) : '';
  if (code === 'EBUSY' || code === 'EPERM' || code === 'EACCES') return true;
  const msg = 'message' in err && typeof err.message === 'string' ? err.message : String(err);
  return /\bEBUSY\b/i.test(msg) || /\bresource busy\b/i.test(msg) || /\blocked\b/i.test(msg);
}

function msc_sleepMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * v1.7.3 — Atomic swap: write `_vpe_thumb_TEMP.png` + fsync, rename current → OLD, rename TEMP → final,
 * then remove OLD. `_vpe_thumb.png` is never a partial write. EBUSY retries (50ms × 3) on rename chain.
 * @param {string} vaultDir
 * @param {Buffer} pngBuffer
 * @returns {Promise<string>} Absolute path to `_vpe_thumb.png`
 */
async function msc_safeWriteThumbnail(vaultDir, pngBuffer) {
  fs.mkdirSync(vaultDir, { recursive: true });
  const outPath = path.join(vaultDir, VPE_VAULT_INTERNAL_THUMB);
  const oldPath = path.join(vaultDir, VPE_VAULT_INTERNAL_THUMB_OLD);
  const tempPath = path.join(vaultDir, VPE_VAULT_INTERNAL_THUMB_TEMP);

  try {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
  } catch (_) {
    /* */
  }

  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await msc_sleepMs(50);
    try {
      const fd = fs.openSync(tempPath, 'w');
      try {
        fs.writeSync(fd, pngBuffer, 0, pngBuffer.length, 0);
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }

      if (fs.existsSync(outPath)) {
        if (fs.existsSync(oldPath)) {
          try {
            fs.unlinkSync(oldPath);
          } catch (e) {
            if (msc_isThumbnailEBUSY(e) && attempt < 2) {
              lastErr = e;
              try {
                if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
              } catch (_) {
                /* */
              }
              continue;
            }
            throw e;
          }
        }
        fs.renameSync(outPath, oldPath);
      }

      fs.renameSync(tempPath, outPath);

      if (fs.existsSync(oldPath)) {
        try {
          fs.unlinkSync(oldPath);
        } catch (_) {
          /* best-effort */
        }
      }
      console.log('[VPE THUMBNAIL LOCK RELEASED]');
      try {
        const t = new Date();
        fs.utimesSync(outPath, t, t);
      } catch (_) {
        /* mtime bump is best-effort — helps renderer / disk cache see a fresh thumb */
      }
      return outPath;
    } catch (err) {
      lastErr = err;
      try {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      } catch (_) {
        /* */
      }
      if (attempt < 2 && msc_isThumbnailEBUSY(err)) {
        continue;
      }
      throw err;
    }
  }
  const m =
    lastErr && typeof lastErr === 'object' && 'message' in lastErr
      ? String(lastErr.message)
      : String(lastErr);
  throw new Error(`VPE: Thumbnail write failed after retries (${m})`);
}

/**
 * v1.6.6 — Card thumbnail stored only under `media/vault/<sanitizedName>/VPE_VAULT_INTERNAL_THUMB` (PNG).
 * JEDI_MOD_124 — Atomic physical write: force resolved vault path on D: + terminal proof.
 * @returns {Promise<{ ok: true, file: string, url: string }>}
 */
async function msc_writeVaultInternalThumbnail(srcImagePath, projectDisplayName, projectId) {
  const targetPath = msc_projectVaultSovereignInternalThumbAbs(projectDisplayName, projectId);
  const vaultDir = path.dirname(targetPath);
  fs.mkdirSync(vaultDir, { recursive: true });

  ['_vpe_thumb.jpg', '_vpe_thumb.jpeg'].forEach((leaf) => {
    try {
      const p = path.join(vaultDir, leaf);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch (_) {
      /* */
    }
  });

  const img = nativeImage.createFromPath(srcImagePath);
  if (img.isEmpty()) {
    throw new Error('VPE: Could not load image for thumbnail.');
  }

  let srcStat;
  try {
    srcStat = fs.statSync(srcImagePath);
  } catch (_) {
    srcStat = null;
  }
  if (srcStat && srcStat.isFile() && srcStat.size > 12 * 1024 * 1024) {
    throw new Error('VPE: Thumbnail file is too large (max 12 MB).');
  }

  if (fs.existsSync(targetPath)) {
    try {
      fs.unlinkSync(targetPath);
    } catch (e) {
      console.warn(`[VAULT] Could not unlink existing thumbnail: ${e?.message ?? e}`);
    }
  }

  try {
    fs.copyFileSync(srcImagePath, targetPath);
    console.log('!!! CRITICAL SUCCESS: FILE PHYSICALLY WRITTEN TO:', targetPath);
  } catch (err) {
    console.error('!!! CRITICAL FAIL: Physical write failed at OS level:', err);
    throw err;
  }

  console.log(`[VAULT] Thumbnail locked to physical storage for Project: ${projectDisplayName}`);
  return { ok: true, file: targetPath, url: `${pathToFileURL(targetPath).href}?t=${Date.now()}` };
}

/** After vault folder rename, fix `file://` thumbnail URLs that pointed at `_vpe_thumb.*` in the moved folder. */
function msc_remapVaultThumbAfterProjectRename(thumbUrl, oldDisplayName, newDisplayName) {
  if (thumbUrl == null || thumbUrl === '') return thumbUrl ?? null;
  const s = String(thumbUrl);
  const oldLeaf = msc_safeVaultFolderName(oldDisplayName);
  const newLeaf = msc_safeVaultFolderName(newDisplayName);
  if (oldLeaf === newLeaf) return thumbUrl ?? null;
  if (!s.startsWith('file:')) return thumbUrl ?? null;

  try {
    const root = path.resolve(msc_projectVaultRootDir());
    const oldVault = path.resolve(path.join(root, oldLeaf));
    const newVault = path.resolve(path.join(root, newLeaf));
    const abs = path.resolve(fileURLToPath(s));
    const rel = path.relative(oldVault, abs);
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
      return thumbUrl ?? null;
    }
    if (!msc_isVaultInternalThumbBase(path.basename(abs))) {
      return thumbUrl ?? null;
    }
    const nextAbs = path.resolve(path.join(newVault, path.basename(abs)));
    const relInto = path.relative(newVault, nextAbs);
    if (relInto.startsWith('..') || path.isAbsolute(relInto)) {
      return thumbUrl ?? null;
    }
    if (fs.existsSync(nextAbs)) {
      return pathToFileURL(nextAbs).href;
    }
    const fallback = path.resolve(path.join(newVault, VPE_VAULT_INTERNAL_THUMB));
    if (fs.existsSync(fallback)) {
      return pathToFileURL(fallback).href;
    }
    return pathToFileURL(nextAbs).href;
  } catch (_) {
    return thumbUrl ?? null;
  }
}

/**
 * Scorched Earth (Windows): clear ghost Node + orphaned Electron shells outside our PID tree.
 * Step 1: `taskkill /F /IM node.exe /T` (Forge protocol). Step 2: kill electron.exe NOT in subtree of `process.pid`.
 * Wrapped in exec try/catch; ignores "process not found" failures.
 */
function msc_utf16LeBase64ForPs(script) {
  return Buffer.from(script, 'utf16le').toString('base64');
}

/**
 * Full scorched earth (Windows production): `taskkill` Node tree + orphan Electron sweep.
 * Dev “soft purge” lives in `system-handlers.js` (`vpe:scorched-earth` when `electron-is-dev`).
 */
async function msc_scorchedEarthWin32Steps() {
  const { exec } = require('child_process');
  const execIgnore = (cmd) =>
    new Promise((resolve) => {
      exec(cmd, { windowsHide: true, maxBuffer: 4 * 1024 * 1024 }, (err) => resolve({ err }));
    });

  /** @type {string[]} */
  const log = [];
  const r1 = await execIgnore('taskkill /F /IM node.exe /T');
  log.push(`node_exe_tree: ${r1.err ? String(r1.err.message || r1.err) : 'ok'}`);

  const rootPid = process.pid;
  const ps = `
$procsList = @(Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId, Name)
$root = ${rootPid}
$keep = [System.Collections.Generic.HashSet[int]]::new()
[void]$keep.Add([int]$root)
$dirty = $true
while ($dirty) {
  $dirty = $false
  foreach ($x in $procsList) {
    $pidVal = [int]$x.ProcessId
    $ppidVal = [int]$x.ParentProcessId
    if ($keep.Contains($ppidVal) -and -not $keep.Contains($pidVal)) {
      [void]$keep.Add($pidVal)
      $dirty = $true
    }
  }
}
Get-CimInstance Win32_Process -Filter "Name='electron.exe'" | ForEach-Object {
  $ePid = [int]$_.ProcessId
  if (-not $keep.Contains($ePid)) { $ePid }
}
`.trim();
  const encoded = msc_utf16LeBase64ForPs(ps);

  /** @type {number[]} */
  const orphanElectronPids = [];
  await new Promise((resolve) => {
    exec(
      `powershell.exe -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encoded}`,
      { windowsHide: true, maxBuffer: 8 * 1024 * 1024 },
      (err, stdout) => {
        if (stdout) {
          const lines = String(stdout).split(/\r?\n/);
          for (const ln of lines) {
            const t = ln.trim();
            if (/^\d+$/.test(t)) orphanElectronPids.push(Number(t));
          }
        }
        if (err && !stdout) log.push(`ps_orphan_scan:${String(err.message || err)}`);
        resolve(undefined);
      },
    );
  });

  let killedElectron = 0;
  for (const pidVal of orphanElectronPids) {
    if (!Number.isFinite(pidVal) || pidVal <= 0) continue;
    await execIgnore(`taskkill /F /PID ${pidVal} /T`);
    killedElectron += 1;
  }
  log.push(`orphan_electron_attempted: ${orphanElectronPids.length}`);
  log.push(`orphan_electron_taskkills: ${killedElectron}`);

  return { ok: true, mode: 'full', log };
}

/** @param {unknown} err */
function msc_fallbackSystemStats(err) {
  const msg = err && typeof err === 'object' && 'message' in err ? String(err.message) : String(err ?? '');
  console.error('[VPE ERROR]', 'get-system-stats', msg || err);
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

/** Legacy scratch thumbnails under repo or userData (pre–Omni-Vault). */
function msc_isLegacyMediaThumbnailsUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase();
  if (
    lower.includes('/media/thumbnails/') ||
    lower.includes('\\media\\thumbnails\\')
  ) {
    return true;
  }
  try {
    const dec = decodeURIComponent(url).toLowerCase();
    return (
      dec.includes('/media/thumbnails/') || dec.includes('\\media\\thumbnails\\')
    );
  } catch (_) {
    return false;
  }
}

/** @param {unknown} row */
function msc_projectRowToUpdatePayload(row, thumbnail_url) {
  const pt =
    row.project_type == null || String(row.project_type).trim() === ''
      ? null
      : String(row.project_type).trim();

  const portNum =
    row.port != null && Number.isFinite(Number(row.port)) ? Number(row.port) : row.port;

  return {
    id: row.id,
    name: row.name,
    path: row.path,
    port: portNum,
    thumbnail_url: thumbnail_url ?? null,
    start_script: row.start_script,
    build_script: row.build_script,
    pkg_manager: row.pkg_manager,
    project_type: pt,
    is_archived: row.is_archived === true || row.is_archived === 1,
    notes: row.notes != null ? String(row.notes) : null,
  };
}

function msc_storeListProjectsAlphabetical(store) {
  if (typeof store.listProjectsAlphabetical === 'function') {
    return store.listProjectsAlphabetical();
  }
  return typeof store.getProjects === 'function' ? store.getProjects() : [];
}

/** Drop thumbnail_url when it points inside this project vault but file is gone. */
function msc_coerceThumbnailVaultFilePresence(row) {
  const tu = row.thumbnail_url;
  if (!tu || typeof tu !== 'string') {
    return tu ?? null;
  }
  if (tu.startsWith('vpe-vault:')) {
    const abs = msc_internalVaultThumbAbsForRow(row);
    if (!abs || !fs.existsSync(abs)) return null;
    return pathToFileURL(abs).href;
  }
  if (!tu.startsWith('file:')) {
    return tu ?? null;
  }
  try {
    const fp = path.resolve(fileURLToPath(tu));
    const vdir = path.resolve(msc_projectVaultProjectDir(row.name, row.id));
    const rel = path.relative(vdir, fp);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      return tu;
    }
    if (!fs.existsSync(fp)) return null;
    return tu;
  } catch (_) {
    return tu;
  }
}

/**
 * v1.6.6 Great Purge — registry alignment (legacy media/thumbnails → vault file URL or NULL).
 * @returns {{ migratedLegacy: number; nulledMissingVault: number; rowsTouched: number }}
 */
function msc_greatPurgeThumbnailMigration(store) {
  /** @type {unknown[]} */
  const rows = msc_storeListProjectsAlphabetical(store);
  let migratedLegacy = 0;
  let nulledMissingVault = 0;
  let rowsTouched = 0;

  for (const row of rows) {
    if (!row?.id) continue;

    let next = row.thumbnail_url ?? null;

    if (typeof next === 'string' && msc_isLegacyMediaThumbnailsUrl(next)) {
      const vaultPng = path.join(
        msc_projectVaultProjectDir(row.name, row.id),
        VPE_VAULT_INTERNAL_THUMB,
      );
      next = fs.existsSync(vaultPng) ? pathToFileURL(vaultPng).href : null;
      migratedLegacy += 1;
    }

    next = msc_coerceThumbnailVaultFilePresence({ ...row, thumbnail_url: next });

    const prevNorm = row.thumbnail_url ?? null;
    const nextNorm = next ?? null;
    if (prevNorm !== nextNorm) {
      store.updateProject(msc_projectRowToUpdatePayload(row, nextNorm));
      rowsTouched += 1;
      if (nextNorm === null && prevNorm != null) nulledMissingVault += 1;
    }
  }

  return { migratedLegacy, nulledMissingVault, rowsTouched };
}

function msc_normalizeResolvedPath(p) {
  try {
    return path.normalize(path.resolve(p));
  } catch (_) {
    return '';
  }
}

/** True if `entryAbs` is a file/dir path strictly inside `containerDirAbs` (not the dir path alone). */
function msc_fsPathIsStrictlyInsideDir(entryAbs, containerDirAbs) {
  const dir = msc_normalizeResolvedPath(containerDirAbs);
  const ent = msc_normalizeResolvedPath(entryAbs);
  if (!dir || !ent) return false;
  const rel = path.relative(dir, ent);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

/** `thumbnail_url` resolves to a path under this exact legacy directory (local disk). */
function msc_rowThumbnailPointsUnderDir(thumbnailUrl, legacyDirAbs) {
  if (!thumbnailUrl || typeof thumbnailUrl !== 'string' || !legacyDirAbs) return false;
  const base = msc_normalizeResolvedPath(legacyDirAbs);
  if (!base) return false;

  if (thumbnailUrl.startsWith('file:')) {
    try {
      const fp = msc_normalizeResolvedPath(fileURLToPath(thumbnailUrl));
      return msc_fsPathIsStrictlyInsideDir(fp, base) || fp === base;
    } catch (_) {
      return false;
    }
  }

  if (/^[a-zA-Z][a-zA-Z0-9+\-.]*:/.test(thumbnailUrl.trim())) return false;

  try {
    const cand = thumbnailUrl.trim();
    if (!path.isAbsolute(cand)) return false;
    const fp = msc_normalizeResolvedPath(cand);
    return msc_fsPathIsStrictlyInsideDir(fp, base) || fp === base;
  } catch (_) {
    return false;
  }
}

function msc_registryPointsAtFilesystemDir(store, dirAbs) {
  return msc_storeListProjectsAlphabetical(store).some((row) =>
    msc_rowThumbnailPointsUnderDir(row?.thumbnail_url, dirAbs),
  );
}

/** Recursive byte size (used before rm/unlink). */
function msc_sumPathBytesSync(targetPath) {
  try {
    if (!fs.existsSync(targetPath)) return 0;
    const st = fs.statSync(targetPath);
    if (st.isFile()) return st.size;
    if (!st.isDirectory()) return 0;
    let total = 0;
    for (const ent of fs.readdirSync(targetPath, { withFileTypes: true })) {
      const p = path.join(targetPath, ent.name);
      if (ent.isDirectory()) total += msc_sumPathBytesSync(p);
      else if (ent.isFile()) {
        try {
          total += fs.statSync(p).size;
        } catch (_) {
          /* */
        }
      }
    }
    return total;
  } catch (_) {
    return 0;
  }
}

/**
 * v1.6.7 — Orphan `_vpe_thumb*` files inside **registered** vault dirs may be unlinked when not the
 * approved thumbnail. Legacy `media/thumbnails` dirs and vault folders missing from the DB are
 * never auto-deleted (orphans are left on disk for manual reconcile / UI flags).
 */
function msc_purgeUnusedMediaScrub(store) {
  /** @type {unknown[]} */
  const rows = msc_storeListProjectsAlphabetical(store);

  /** @type {Record<string,string>} sanitized leaf → normalized approved thumb path or '' */
  const approvedThumbPathByLeaf = Object.create(null);
  for (const row of rows) {
    const leaf = msc_safeVaultFolderName(row.name);
    let approved = '';
    const tu = row.thumbnail_url;
    if (tu && typeof tu === 'string' && msc_rowUsesInternalVaultThumbnail(row)) {
      const abs = msc_internalVaultThumbAbsForRow(row);
      approved = abs && fs.existsSync(abs) ? abs : '';
    } else if (tu && typeof tu === 'string' && tu.startsWith('file:')) {
      try {
        approved = path.resolve(fileURLToPath(tu));
      } catch (_) {
        approved = '';
      }
    }
    approvedThumbPathByLeaf[leaf] = approved;
  }

  let deletedOrphanThumbFiles = 0;
  let bytesFreed = 0;

  for (const row of rows) {
    if (!row?.name) continue;
    const dir = msc_projectVaultProjectDir(row.name, row.id);
    if (!fs.existsSync(dir)) continue;

    const leaf = msc_safeVaultFolderName(row.name);
    const approvedNorm = approvedThumbPathByLeaf[leaf]
      ? path.normalize(approvedThumbPathByLeaf[leaf])
      : '';

    /** @type {import('fs').Dirent[]} */
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_) {
      /* */
    }

    for (const e of entries) {
      if (!e.isFile()) continue;
      const nm = e.name;
      if (!nm.toLowerCase().startsWith('_vpe_thumb')) continue;

      const fullPath = path.join(dir, nm);
      let resolved;
      try {
        resolved = path.normalize(path.resolve(fullPath));
      } catch (_) {
        continue;
      }

      if (approvedNorm && resolved === approvedNorm) continue;

      try {
        bytesFreed += msc_sumPathBytesSync(fullPath);
        fs.unlinkSync(fullPath);
        deletedOrphanThumbFiles += 1;
      } catch (_) {
        /* */
      }
    }
  }

  /**
   * v1.6.7 — legacy `media/thumbnails` dirs and orphan vault folders are **not** auto-deleted:
   * only explicit project Delete may remove vault trees. Count eligible dirs for diagnostics.
   */
  let legacyThumbnailDirsRemoved = 0;
  let legacyThumbnailDirsEligible = 0;
  const legacyRepoThumbnails = msc_normalizeResolvedPath(
    path.join(process.cwd(), 'media', 'thumbnails'),
  );
  const legacyUserDataThumbnails = (() => {
    try {
      return msc_normalizeResolvedPath(path.join(app.getPath('userData'), 'media', 'thumbnails'));
    } catch (_) {
      return '';
    }
  })();

  for (const legacyPath of new Set(
    [legacyRepoThumbnails, legacyUserDataThumbnails].filter(Boolean),
  )) {
    if (!legacyPath || !fs.existsSync(legacyPath)) continue;
    if (msc_registryPointsAtFilesystemDir(store, legacyPath)) continue;
    legacyThumbnailDirsEligible += 1;
  }

  /** Vault folders on disk without a registry project (sanitized display `name`) — detect only. */
  /** @type {Set<string>} */
  const legitLeaves = new Set(
    rows
      .filter((r) => r?.name != null && String(r.name).trim() !== '')
      .map((r) => msc_safeVaultFolderName(String(r.name))),
  );

  let orphanVaultDirsRemoved = 0;
  let orphanVaultDirsDetected = 0;
  const vaultRootResolved = path.resolve(msc_projectVaultRootDir());

  try {
    fs.mkdirSync(vaultRootResolved, { recursive: true });
  } catch (_) {
    /* */
  }

  /** @type {import('fs').Dirent[]} */
  let rootEntries = [];
  try {
    rootEntries = fs.readdirSync(vaultRootResolved, { withFileTypes: true });
  } catch (_) {
    /* */
  }

  for (const d of rootEntries) {
    if (!d.isDirectory()) continue;
    const leaf = d.name;
    if (legitLeaves.has(leaf)) continue;

    const target = path.resolve(path.join(vaultRootResolved, leaf));
    const relTop = path.relative(vaultRootResolved, target);
    if (relTop.startsWith('..') || path.isAbsolute(relTop)) continue;

    orphanVaultDirsDetected += 1;
  }

  if (orphanVaultDirsDetected > 0) {
    console.log(
      '[VPE] Orphan vault directories on disk (not auto-deleted; reconcile manually if needed):',
      orphanVaultDirsDetected,
    );
  }
  if (legacyThumbnailDirsEligible > 0) {
    console.log(
      '[VPE] Legacy media/thumbnails dirs present with no DB pointer (not auto-deleted):',
      legacyThumbnailDirsEligible,
    );
  }

  const mbFreed = Math.round((bytesFreed / (1024 * 1024)) * 100) / 100;

  return {
    deletedOrphanThumbFiles,
    legacyThumbnailDirsRemoved,
    orphanVaultDirsRemoved,
    orphanVaultDirsDetected,
    legacyThumbnailDirsEligible,
    legacyScratchRemoved: false,
    bytesFreed,
    mbFreed,
  };
}

function msc_vaultDirTopLevelHasAnyFile(absDir) {
  try {
    return fs.readdirSync(absDir, { withFileTypes: true }).some((e) => e.isFile());
  } catch (_) {
    return true;
  }
}

function msc_trySetWindowsHiddenFile(absPath) {
  if (process.platform !== 'win32') return;
  try {
    const { execFileSync } = require('child_process');
    execFileSync('attrib', ['+h', absPath], { windowsHide: true, stdio: 'ignore' });
  } catch (_) {
    /* */
  }
}

/**
 * Ensure every registry project has a physical folder under the vault root (`msc_projectVaultProjectDir`).
 * Adds `.vpe_keep` (+h on Windows) when the folder has no files yet.
 * @returns {{ foldersCreated: string[]; keepFilesWritten: string[]; projectsSynced: number }}
 */
function msc_syncVaultPhysicalFolders(store) {
  /** @type {unknown[]} */
  const rows = msc_storeListProjectsAlphabetical(store);
  /** @type {string[]} */
  const foldersCreated = [];
  /** @type {string[]} */
  const keepFilesWritten = [];
  let projectsSynced = 0;

  fs.mkdirSync(msc_projectVaultRootDir(), { recursive: true });

  for (const row of rows) {
    if (!row?.id || row.name == null || String(row.name).trim() === '') continue;

    const dir = msc_projectVaultProjectDir(String(row.name), row.id);
    let existedBefore = false;
    try {
      existedBefore = fs.existsSync(dir) && fs.statSync(dir).isDirectory();
    } catch (_) {
      existedBefore = false;
    }

    fs.mkdirSync(dir, { recursive: true });
    if (!existedBefore) foldersCreated.push(dir);
    projectsSynced += 1;

    if (!msc_vaultDirTopLevelHasAnyFile(dir)) {
      const keep = path.join(dir, VPE_VAULT_KEEP_FILE);
      if (!fs.existsSync(keep)) {
        fs.writeFileSync(
          keep,
          'VPE vault placeholder - keeps empty project folders materialized. Do not delete.\n',
          'utf8',
        );
        msc_trySetWindowsHiddenFile(keep);
        keepFilesWritten.push(keep);
      }
    }
  }

  if (foldersCreated.length > 0) {
    console.log('[VPE VAULT SYNC] Folders created:', foldersCreated);
  }

  return { foldersCreated, keepFilesWritten, projectsSynced };
}

/**
 * IPC manager: builds shared context, registers **`./ipc/project-handlers`**, **`./ipc/vault-handlers`**,
 * and **`./ipc/system-handlers`**. Most `ipcMain.handle` paths return domain payloads for preload/renderer parity.
 * High-risk flows (e.g. `vpe:stop-all`) use `{ ok: boolean, error?: string, ... }`. Migrating every
 * handler to `{ ok, data, error }` requires coordinated preload + `vpe-bridge` changes.
 *
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
      // v1.8.0 — Windows fast I/O: space TCP probes to reduce port-lock races (Ryzen / 25H2).
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 2000));
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
          projects: store.listProjectsAlphabetical().map((row) => msc_ipcEnrichProjectsRow(row)),
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

  const { msc_registerProjectIpc } = require('./ipc/project-handlers');
  const { msc_registerVaultIpc } = require('./ipc/vault-handlers');
  const { msc_registerSystemIpc } = require('./ipc/system-handlers');

  const ipcCtx = {
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
    VPE_SYSTEM_REPAIR_PROJECT_ID,
    VPE_CATALOG_VERSION,
    msc_rowToCatalogPayload,
    msc_safeExportBasename,
    msc_parseCatalogJson,
    msc_normalizeCatalogProjectType,
    msc_normalizeCatalogArchived,
    fs,
    path,
    os,
    process,
    app,
    BrowserWindow,
    dialog,
    shell,
    randomUUID,
    pathToFileURL,
    msc_writeVaultInternalThumbnail,
    msc_vault_copyFile,
    msc_projectVaultProjectDir,
    msc_isVaultInternalThumbBase,
    msc_isVaultKeepFile,
    msc_isVaultNonUserNoiseFile,
    msc_promptVaultPath,
    msc_promptVaultMasterItems,
    msc_mergePromptVaultMasters,
    msc_scorchedEarthWin32Steps,
    msc_formatProcessUptime,
    msc_vpeHostCpuPercentSinceLastPoll,
    msc_buildSanitizedSystemStatsPayload,
    msc_fallbackSystemStats,
    msc_executeTerminalCommandInner,
    msc_formatCaughtForTerminal,
    msc_launcherPortRowHealth,
    msc_purgeLauncherPorts,
    msc_greatPurgeThumbnailMigration,
    msc_purgeUnusedMediaScrub,
    msc_syncVaultPhysicalFolders,
  };

  msc_registerProjectIpc(ipcMain, ipcCtx);
  msc_registerVaultIpc(ipcMain, ipcCtx);
  msc_registerSystemIpc(ipcMain, ipcCtx);

  /** v1.6.7 Hard Scrub — registry remap + aggressive media/vault cleanup once per process. */
  if (!global.__vpeHardScrubV167BootDone) {
    global.__vpeHardScrubV167BootDone = true;
    try {
      msc_greatPurgeThumbnailMigration(store);
      msc_purgeUnusedMediaScrub(store);
    } catch (e) {
      console.warn('[VPE BOOT] Hard Scrub v1.6.7 failed', e?.message ?? e);
    }
    try {
      msc_syncVaultPhysicalFolders(store);
    } catch (e2) {
      console.warn('[VPE BOOT] Vault physical sync failed', e2?.message ?? e2);
    }
    msc_emitProjectsUpdated();
  }

  console.log('[VPE SUCCESS]', 'VPE IPC handlers registered');
}

module.exports = {
  msc_registerVpeIpc,
  msc_onDevExitCompanionSweep,
  msc_applyLoginStartupFromStore,
  msc_runAutoStartProjectsIfEnabled,
};
