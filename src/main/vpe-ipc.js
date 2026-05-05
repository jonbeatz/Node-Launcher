const { ipcMain, BrowserWindow, dialog, shell } = require('electron');
const { randomUUID } = require('crypto');
const fs = require('fs');
const path = require('path');
const { msc_detectProjectScripts } = require('./project-detection');
const { msc_validateProjectPath } = require('./path-guard');

let msc_vpeIpcRegistered = false;
const MSC_VPE_RENDERER_PORT =
  parseInt(process.env.VPE_RENDERER_PORT || process.env.PORT || '3001', 10) || 3001;

/**
 * @param {import('./project-runner')} projectRunner
 * @param store SqlitePersistence | JsonPersistence
 */
function msc_registerVpeIpc(projectRunner, store) {
  const msc_assertPortNotReserved = (portLike) => {
    const parsed = Number(portLike);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error('VPE: Invalid project port.');
    }
    if (parsed === MSC_VPE_RENDERER_PORT) {
      throw new Error(
        `VPE: Port ${parsed} is reserved by Node-Launcher renderer. Choose another project port.`,
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

  ipcMain.handle('vpe:add-project', (event, payload) => {
    const root = msc_validateProjectPath(payload.path);
    const det = msc_detectProjectScripts(root);
    const id = payload.id || randomUUID();
    store.insertProject({
      id,
      name: payload.name,
      path: root,
      port: msc_assertPortNotReserved(payload.port || 3000),
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
    const dest = path.join(destDir, `${projectId}${extForFile}`);
    fs.copyFileSync(src, dest);
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
    const mime = mimeByExt[extForFile.toLowerCase()] || 'image/png';
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
