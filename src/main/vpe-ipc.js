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

let msc_vpeIpcRegistered = false;
/** Node-Launcher UI port; managed projects must avoid this port. */
const MSC_VPE_RENDERER_PORT = msc_launcherRendererPort();
const MAX_THUMB_EDGE = 960;
const MAX_THUMB_BYTES = 512 * 1024;

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
 * @param {{
 *   cpuPercent: number | null
 *   totalMem: number
 *   freeMem: number
 *   pm2Online: boolean
 *   pm2ProcessCount: number
 *   vpeUptimeSec: number
 *   vpeUptimeLabel: string
 *   projectsActive: number
 *   projectsTotal: number
 * }} p
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

  const pm2On = Boolean(p.pm2Online);
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
      pm2Online: false,
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
      pm2Online: false,
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
  const msc_findAvailablePort = async (preferred = null, excludeProjectId = null) => {
    const floor = msc_managedPortFloor();
    const preferredNum = preferred == null ? floor : Number(preferred);
    let candidate = Number.isFinite(preferredNum) ? preferredNum : floor;
    if (candidate <= MSC_VPE_RENDERER_PORT) candidate = floor;

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

  ipcMain.handle('vpe:getProjects', () => store.listProjectsAlphabetical());

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
    const row = store.getProject(projectId);
    if (!row) throw new Error('VPE: Project not found');
    const name =
      typeof payload.projectName === 'string' && payload.projectName.trim()
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

      /** Avoid `pm2.list()` here — it lazy-loads optional deps that often break inside ASAR. */
      let pm2Online = false;
      try {
        const pm = vpeRuntime?.pm2Manager;
        if (pm && typeof pm.msc_isPm2RpcConnected === 'function') {
          pm2Online = Boolean(pm.msc_isPm2RpcConnected());
        }
      } catch (_) {
        pm2Online = false;
      }

      const pm2ProcessCount = 0;

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
    const newPort = await msc_findAvailablePort(msc_managedPortFloor(), projectId);

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
    const suggestedPort = await msc_findAvailablePort(msc_managedPortFloor());
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

  ipcMain.handle('vpe:toggle-status', async (event, projectId) =>
    projectRunner.toggleStatus(projectId),
  );

  /** Same engine path as tray "Stop all (PM2 + dashboard spawns)"; updates SQLite registry. */
  ipcMain.handle('vpe:stop-all', async () => {
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
        : await msc_findAvailablePort(msc_managedPortFloor(), id);
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
}

module.exports = { msc_registerVpeIpc };
