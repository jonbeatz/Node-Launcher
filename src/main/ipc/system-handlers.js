'use strict';

const { msc_logInfo, msc_logError } = require('../lib/logger');
const { msc_generateSupportBundle } = require('../lib/support-bundle');
const { msc_vpePortableBackupFromStore, msc_getStorePaths } = require('../db/persistent-store');

/**
 * Best-effort removal of leftover VPE dirs/zips under OS temp (snapshots / restore scratch).
 * @param {typeof import('fs')} fs
 * @param {typeof import('path')} path
 * @param {typeof import('os')} os
 * @returns {string[]}
 */
function msc_softPurgeVpeTempScratch(fs, path, os) {
  /** @type {string[]} */
  const log = [];
  let tmp;
  try {
    tmp = os.tmpdir();
    const entries = fs.readdirSync(tmp, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(tmp, ent.name);
      if (ent.isDirectory()) {
        if (!/^vpe-(snapshot|restore)-/i.test(ent.name)) continue;
        try {
          fs.rmSync(full, { recursive: true, force: true });
          log.push(`temp_removed_dir:${ent.name}`);
        } catch (e) {
          log.push(`temp_dir_skip:${ent.name}:${e && e.message ? String(e.message) : String(e)}`);
        }
        continue;
      }
      if (/^vpe-snapshot-.*\.zip$/i.test(ent.name)) {
        try {
          fs.unlinkSync(full);
          log.push(`temp_removed_zip:${ent.name}`);
        } catch (e) {
          log.push(`temp_zip_skip:${ent.name}`);
        }
      }
    }
  } catch (e) {
    log.push(`temp_scan_error:${e && e.message ? String(e.message) : String(e)}`);
  }
  return log;
}

/**
 * IPC domain: diagnostics, PM2 stop-all, terminal, snapshots, launcher ports, media purge.
 *
 * @typedef {import('../../renderer/types/vpe-ipc.ts').VpeProjectRow} VpeProjectRow
 * @typedef {import('../../renderer/types/vpe-ipc.ts').Project} Project
 */

/**
 * @param {import('electron').IpcMain} ipcMain
 * @param {Record<string, unknown>} c
 */
function msc_registerSystemIpc(ipcMain, c) {
  const {
    store,
    vpeRuntime,
    msc_emitProjectsUpdated,
    msc_vpeStopAllEngines,
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
    fs,
    path,
    os,
    process,
    app,
    BrowserWindow,
    dialog,
    shell,
    randomUUID,
  } = c;

  ipcMain.handle('vpe:run-diagnostics', () => {
    const { msc_runForgeDiagnostics } = require('../tests/forge-diagnostics');
    return msc_runForgeDiagnostics(store);
  });

  ipcMain.handle('vpe:scorched-earth', async () => {
    const isActuallyDev =
      !app.isPackaged || process.env.NODE_ENV === 'development';

    msc_logInfo(`[VPE DEBUG] app.isPackaged: ${app.isPackaged}`);
    msc_logInfo(`[VPE DEBUG] process.env.NODE_ENV: ${process.env.NODE_ENV}`);
    msc_logInfo(`[VPE DEBUG] Final Decision - isActuallyDev: ${isActuallyDev}`);

    if (process.platform !== 'win32') {
      return { ok: true, skipped: 'non_win32' };
    }

    if (isActuallyDev) {
      // Isolation: `set VPE_SCORCHED_EARTH_DEV_NOOP=1` — instant return, no cleanup (verify window stays open).
      if (process.env.VPE_SCORCHED_EARTH_DEV_NOOP === '1') {
        msc_logInfo('[VPE] DEV NOOP: instant return only (VPE_SCORCHED_EARTH_DEV_NOOP=1).');
        return { ok: true, mode: 'soft_dev', log: ['noop:isolation_instant_return'] };
      }

      msc_logInfo(
        '[VPE] Soft Purge Initiated. Sending UI response FIRST to prevent hang.',
      );

      const result = { ok: true, mode: 'soft_dev' };

      setImmediate(() => {
        void (async () => {
          try {
            msc_logInfo('[VPE] Running background cleanup...');
            if (typeof msc_vpeStopAllEngines === 'function') {
              await msc_vpeStopAllEngines();
            }
            if (typeof msc_softPurgeVpeTempScratch === 'function') {
              msc_softPurgeVpeTempScratch(fs, path, os);
            }
            msc_emitProjectsUpdated();
            msc_logInfo('[VPE] Soft Purge Background Cleanup Complete.');
          } catch (err) {
            const msg =
              err && typeof err === 'object' && 'message' in err
                ? String(err.message)
                : String(err);
            msc_logError('[VPE] Soft Purge background error: ' + msg);
          }
        })();
      });

      return result;
    }

    try {
      const r = await msc_scorchedEarthWin32Steps();
      msc_emitProjectsUpdated();
      return r;
    } catch (err) {
      const m =
        err && typeof err === 'object' && 'message' in err ? String(err.message) : String(err);
      return { ok: false, error: m };
    }
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
        console.warn('[VPE ERROR]', 'get-system-stats CPU ticks', m || cpuErr);
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
        console.warn('[VPE ERROR]', 'get-system-stats PM2 eval', m || pm2Err);
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

  /** Same engine path as tray "Stop all (PM2 + dashboard spawns)"; updates SQLite registry. */
  ipcMain.handle('vpe:stop-all', async () => {
    try {
      await msc_vpeStopAllEngines();
      msc_emitProjectsUpdated();
      return { ok: true };
    } catch (err) {
      const m =
        err && typeof err === 'object' && 'message' in err ? String(err.message) : String(err);
      console.error('[VPE ERROR]', 'vpe:stop-all', m);
      try {
        msc_emitProjectsUpdated();
      } catch (_) {
        /* */
      }
      return { ok: false, error: m };
    }
  });

  ipcMain.handle('vpe:execute-terminal-command', async (_event, payload) => {
    try {
      return await msc_executeTerminalCommandInner(store, payload);
    } catch (reason) {
      const msg = msc_formatCaughtForTerminal(reason);
      console.warn('[VPE ERROR]', 'terminal IPC', msg);
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
      const paths = msc_getStorePaths();
      const dbPath = paths.sqlitePath;
      const tempDir = path.join(os.tmpdir(), `vpe-snapshot-${randomUUID()}`);
      fs.mkdirSync(tempDir, { recursive: true });

      if (fs.existsSync(dbPath)) {
        fs.copyFileSync(dbPath, path.join(tempDir, 'vader.sqlite'));
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
      const paths = msc_getStorePaths();
      const dbDir = paths.storeDir;
      const tempDir = path.join(os.tmpdir(), `vpe-restore-${randomUUID()}`);
      fs.mkdirSync(tempDir, { recursive: true });

      // Stop all engines first
      await msc_vpeStopAllEngines();

      // Unzip using PowerShell
      const unzipCmd = `powershell -Command "Expand-Archive -Path """${filePath}""" -DestinationPath """${tempDir}""" -Force"`;
      execSync(unzipCmd);

      // Restore SQLite (vader.sqlite preferred; database.sqlite = legacy checkpoints)
      const restoredVader = path.join(tempDir, 'vader.sqlite');
      const restoredLegacy = path.join(tempDir, 'database.sqlite');
      const restoredDb = fs.existsSync(restoredVader)
        ? restoredVader
        : restoredLegacy;
      if (fs.existsSync(restoredDb)) {
        fs.mkdirSync(dbDir, { recursive: true });
        fs.copyFileSync(restoredDb, paths.sqlitePath);
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

  /** Open project folder in Cursor (Windows install path). */
  ipcMain.handle('vpe:open-cursor', async (_event, projectPath) => {
    const { spawn } = require('child_process');
    const CURSOR_EXE =
      'C:\\Users\\JONBEATZ\\AppData\\Local\\Programs\\cursor\\Cursor.exe';
    if (!projectPath) throw new Error('VPE: Missing project path');
    try {
      if (!fs.existsSync(projectPath)) {
        return { ok: false, error: `Path does not exist: ${projectPath}` };
      }
      if (!fs.existsSync(CURSOR_EXE)) {
        return { ok: false, error: `Cursor not found at ${CURSOR_EXE}` };
      }
      const child = spawn(CURSOR_EXE, [projectPath], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      });
      child.unref();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err && err.message ? String(err.message) : String(err) };
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

  /** Aligns DB thumbnail paths + prunes stray `_vpe_thumb*` files in known vault dirs only — no orphan folder deletion. */
  ipcMain.handle('vpe:purge-unused-media', async () => {
    try {
      const migration = msc_greatPurgeThumbnailMigration(store);
      const scrub = msc_purgeUnusedMediaScrub(store);
      const vaultSync = msc_syncVaultPhysicalFolders(store);
      msc_emitProjectsUpdated();
      console.log('[VPE MEDIA ALIGN]', { migration, scrub });
      console.log('[VPE VAULT SYNC COMPLETE]', vaultSync);
      console.log('[VPE STANDBY]');
      return { ok: true, migration, scrub, vaultSync };
    } catch (err) {
      const m =
        err && typeof err === 'object' && 'message' in err ? String(err.message) : String(err);
      console.warn('[VPE purge-unused-media]', m);
      return { ok: false, error: m };
    }
  });

  ipcMain.handle('vpe:generate-support-bundle', async () => {
    const pm2Manager = vpeRuntime?.pm2Manager ?? null;
    return msc_generateSupportBundle({ app, store, pm2Manager });
  });

  /** Portable vault: snapshot active catalog DB into `process.cwd()/vpe-backups/` (last 5 rotated). */
  ipcMain.handle('vpe:backup-local-db', () => {
    try {
      const cwd = typeof process.cwd === 'function' ? process.cwd() : '.';
      const result = msc_vpePortableBackupFromStore(store, cwd);
      if (result.ok) {
        msc_logInfo(`[VPE] Portable DB snapshot: ${result.path}`);
      } else {
        msc_logError(`[VPE] Portable DB snapshot failed: ${result.error}`);
      }
      return result;
    } catch (err) {
      const m = err && typeof err === 'object' && 'message' in err ? String(err.message) : String(err);
      msc_logError(`[VPE] Portable DB snapshot failed: ${m}`);
      return { ok: false, error: m };
    }
  });
}

module.exports = { msc_registerSystemIpc };
