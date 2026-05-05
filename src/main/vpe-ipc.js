const { ipcMain, BrowserWindow, dialog, shell, nativeImage } = require('electron');
const { randomUUID } = require('crypto');
const fs = require('fs');
const path = require('path');
const net = require('net');
const { msc_detectProjectScripts } = require('./project-detection');
const { msc_validateProjectPath } = require('./path-guard');

let msc_vpeIpcRegistered = false;
/** Node-Launcher UI port; managed projects must avoid this port. */
const MSC_VPE_RENDERER_PORT =
  parseInt(process.env.VPE_RENDERER_PORT || process.env.PORT || '3000', 10) || 3000;
const MAX_THUMB_EDGE = 1280;
const MAX_THUMB_BYTES = 900 * 1024;

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
 */
function msc_registerVpeIpc(projectRunner, store) {
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

  ipcMain.handle('vpe:toggle-status', async (event, projectId) =>
    projectRunner.toggleStatus(projectId),
  );

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

    const destDir = path.join(process.cwd(), 'media', 'thumbnails');
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

  ipcMain.handle('vpe:nuke-project', async (event, projectId) => {
    if (!projectId) throw new Error('VPE: Missing project id');
    const row = store.getProject(projectId);
    if (!row) throw new Error('VPE: Project not found');
    projectRunner.stopProject(projectId);
    store.setProjectStopped(projectId);
    msc_emitProjectsUpdated();
    return { ok: true, id: projectId };
  });
}

module.exports = { msc_registerVpeIpc };
