'use strict';

/** Windows file dialog: Electron skips a lone `*.*` row when picking a default type, so multi-row lists default to the second row; one combined row fixes “All Files” as the active filter. */
const MSC_WIN32 = process.platform === 'win32';

/** @type {{ name: string; extensions: string[] }[]} */
const MSC_VAULT_ADD_FILTERS_STANDARD = [
  { name: 'All Files', extensions: ['*'] },
  { name: 'Archives', extensions: ['zip', 'rar', '7z', 'tar', 'gz'] },
  { name: 'Documents', extensions: ['pdf', 'md', 'txt', 'html', 'exe'] },
];

/** @type {{ name: string; extensions: string[] }[]} */
const MSC_VAULT_ADD_FILTERS_WIN32 = [
  {
    name: 'All Files',
    extensions: [
      '*',
      'zip',
      'rar',
      '7z',
      'tar',
      'gz',
      'pdf',
      'md',
      'txt',
      'html',
      'htm',
      'exe',
      'msi',
    ],
  },
];

/** @type {{ name: string; extensions: string[] }[]} */
const MSC_THUMB_FILTERS_STANDARD = [
  { name: 'All Files', extensions: ['*'] },
  { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] },
];

/** @type {{ name: string; extensions: string[] }[]} */
const MSC_THUMB_FILTERS_WIN32 = [
  { name: 'All Files', extensions: ['*', 'png', 'jpg', 'jpeg', 'webp', 'gif'] },
];

/**
 * IPC domain: per-project vault files, thumbnails, prompt vault JSON, external URLs.
 *
 * @typedef {import('../../renderer/types/vpe-ipc.ts').VpeProjectRow} VpeProjectRow
 * @typedef {import('../../renderer/types/vpe-ipc.ts').Project} Project
 */

/**
 * @param {import('electron').IpcMain} ipcMain
 * @param {Record<string, unknown>} c
 */
function msc_registerVaultIpc(ipcMain, c) {
  const {
    store,
    msc_emitProjectsUpdated,
    msc_writeVaultInternalThumbnail,
    msc_bumpVaultThumbPulse,
    msc_rendererVaultThumbnailHref,
    msc_vault_copyFile,
    msc_projectVaultProjectDir,
    msc_isVaultInternalThumbBase,
    msc_isVaultKeepFile,
    msc_isVaultNonUserNoiseFile,
    msc_normalizeThumbnailUrlForPersistence,
    msc_promptVaultPath,
    msc_promptVaultMasterItems,
    msc_mergePromptVaultMasters,
    fs,
    path,
    pathToFileURL,
    BrowserWindow,
    dialog,
    shell,
    process,
  } = c;

  ipcMain.handle('vpe:pick-thumbnail', async (_event, arg) => {
    /** @type {{ projectId?: string | null; draftDisplayName?: string | null }} */
    const opts =
      typeof arg === 'string'
        ? { projectId: arg, draftDisplayName: null }
        : arg && typeof arg === 'object' && !Array.isArray(arg)
          ? arg
          : {};

    const projectIdRaw = opts.projectId != null ? String(opts.projectId).trim() : '';
    const draftName =
      opts.draftDisplayName != null && String(opts.draftDisplayName).trim()
        ? String(opts.draftDisplayName).trim()
        : '';

    /** @type {ReturnType<typeof store.getProject> | null} */
    let row = projectIdRaw ? store.getProject(projectIdRaw) : null;

    const displayName = row ? String(row.name) : draftName;
    if (!displayName) {
      throw new Error(
        'VPE: Cannot store thumbnail — register the project first, or scan a folder so the vault name exists.',
      );
    }

    const win = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(win || undefined, {
      title: 'Select project thumbnail image',
      filters: MSC_WIN32 ? MSC_THUMB_FILTERS_WIN32 : MSC_THUMB_FILTERS_STANDARD,
      properties: ['openFile'],
      defaultFilterIndex: 0,
    });
    if (result.canceled || !result.filePaths?.[0]) return null;

    const src = result.filePaths[0];
    await new Promise((resolve) => setTimeout(resolve, 100));

    let outPath;
    try {
      outPath = await msc_writeVaultInternalThumbnail(src, displayName, row?.id);
    } catch (err) {
      const m =
        err && typeof err === 'object' && 'message' in err ? String(err.message) : String(err);
      throw new Error(m);
    }

    const hrefBase = pathToFileURL(outPath).href;

    if (row) {
      const pt =
        row.project_type == null || String(row.project_type).trim() === ''
          ? null
          : String(row.project_type).trim();

      const thumbnailPersist =
        typeof msc_normalizeThumbnailUrlForPersistence === 'function'
          ? msc_normalizeThumbnailUrlForPersistence(row, hrefBase)
          : hrefBase;

      store.updateProject({
        id: row.id,
        name: row.name,
        path: row.path,
        port: row.port,
        thumbnail_url: thumbnailPersist ?? hrefBase,
        start_script: row.start_script,
        build_script: row.build_script,
        pkg_manager: row.pkg_manager,
        project_type: pt,
        is_archived: row.is_archived === true || row.is_archived === 1,
        notes: row.notes != null ? String(row.notes) : null,
      });
      msc_bumpVaultThumbPulse(row.id, Date.now());
      try {
        msc_emitProjectsUpdated();
      } catch (_) {
        /* */
      }
      const merged = { ...row, thumbnail_url: thumbnailPersist ?? hrefBase };
      return msc_rendererVaultThumbnailHref(merged, Date.now());
    }

    /** Draft / add-project modal: `file:` is blocked from `http://localhost` in dev — return PNG data URL for preview only. */
    try {
      const buf = await fs.promises.readFile(outPath);
      return `data:image/png;base64,${buf.toString('base64')}`;
    } catch (_) {
      return `${hrefBase}?pulse=${encodeURIComponent(String(Date.now()))}`;
    }
  });

  ipcMain.handle('vpe:vault-add-file', async (event, projectId) => {
    const id = projectId != null ? String(projectId) : '';
    if (!id) throw new Error('VPE: Missing project id');
    const row = store.getProject(id);
    if (!row) throw new Error('VPE: Project not found');
    const win =
      BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getFocusedWindow();
    const picked = await dialog.showOpenDialog(win || undefined, {
      title: 'Add file to Project Vault — all types',
      filters: MSC_WIN32 ? MSC_VAULT_ADD_FILTERS_WIN32 : MSC_VAULT_ADD_FILTERS_STANDARD,
      properties: ['openFile'],
      defaultFilterIndex: 0,
    });
    if (picked.canceled || !picked.filePaths?.[0]) return { ok: false, canceled: true };
    const dest = msc_vault_copyFile(row.name, picked.filePaths[0], row.id);
    return { ok: true, dest, name: path.basename(dest) };
  });

  ipcMain.handle('vpe:vault-list-files', (_event, projectId) => {
    const id = projectId != null ? String(projectId) : '';
    if (!id) throw new Error('VPE: Missing project id');
    const row = store.getProject(id);
    if (!row) throw new Error('VPE: Project not found');
    const dir = msc_projectVaultProjectDir(row.name, row.id);
    if (!fs.existsSync(dir)) return { ok: true, dir, files: [] };
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files = entries
      .filter(
        (e) =>
          e.isFile() &&
          !msc_isVaultInternalThumbBase(e.name) &&
          !msc_isVaultKeepFile(e.name) &&
          !msc_isVaultNonUserNoiseFile(e.name),
      )
      .map((e) => ({
        name: e.name,
        path: path.join(dir, e.name),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { ok: true, dir, files };
  });

  ipcMain.handle('vpe:vault-open-folder', async (_event, projectId) => {
    const id = projectId != null ? String(projectId) : '';
    if (!id) throw new Error('VPE: Missing project id');
    const row = store.getProject(id);
    if (!row) throw new Error('VPE: Project not found');
    const dir = msc_projectVaultProjectDir(row.name, row.id);
    fs.mkdirSync(dir, { recursive: true });
    await shell.openPath(dir);
    return { ok: true, dir };
  });

  ipcMain.handle('vpe:vault-delete-file', (_event, payload) => {
    const id = payload?.projectId != null ? String(payload.projectId) : '';
    const raw = payload?.fileName != null ? String(payload.fileName) : '';
    if (!id) throw new Error('VPE: Missing project id');
    const base = path.basename(raw.replace(/\\/g, '/'));
    if (!base || base === '.' || base === '..') {
      throw new Error('VPE: Invalid file name');
    }
    if (msc_isVaultInternalThumbBase(base)) {
      throw new Error(
        'VPE: Internal card thumbnail (_vpe_thumb.png) cannot be deleted from the vault list — replace it via Project Settings.',
      );
    }
    if (msc_isVaultKeepFile(base)) {
      throw new Error('VPE: The .vpe_keep placeholder cannot be deleted from the vault list.');
    }
    const row = store.getProject(id);
    if (!row) throw new Error('VPE: Project not found');
    const dir = msc_projectVaultProjectDir(row.name, row.id);
    const target = path.resolve(path.join(dir, base));
    const rootResolved = path.resolve(dir);
    const rel = path.relative(rootResolved, target);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      throw new Error('VPE: Path escapes vault directory');
    }
    if (!fs.existsSync(target)) return { ok: false, error: 'File not found' };
    const st = fs.statSync(target);
    if (!st.isFile()) return { ok: false, error: 'Not a file' };
    fs.unlinkSync(target);
    return { ok: true };
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

  /** Patch one vault row by id (JSON under userData); merges masters if file missing/corrupt. */
  ipcMain.handle('vpe:update-vault-item', (_event, payload) => {
    if (!payload || typeof payload !== 'object' || !payload.id) {
      throw new Error('VPE: update-vault-item requires id');
    }
    const filePath = msc_promptVaultPath();
    const dir = path.dirname(filePath);

    let data;
    if (!fs.existsSync(filePath)) {
      data = { v: 1, items: msc_promptVaultMasterItems() };
    } else {
      let parsed = {};
      try {
        parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch (_) {
        parsed = {};
      }
      const { data: merged, injected } = msc_mergePromptVaultMasters(parsed);
      data = merged;
      if (injected) {
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      }
    }

    const id = String(payload.id);
    const idx = data.items.findIndex((i) => i && String(i.id) === id);
    if (idx < 0) throw new Error(`VPE: vault item not found: ${id}`);

    const cur = data.items[idx];
    const next = { ...cur };

    if (typeof payload.title === 'string') {
      const t = payload.title.trim();
      if (t) next.title = t;
    }
    if (typeof payload.versionLabel === 'string') {
      const v = payload.versionLabel.trim();
      if (v) next.versionLabel = v;
    }
    if (typeof payload.bodyMd === 'string') next.bodyMd = payload.bodyMd;

    if (Object.prototype.hasOwnProperty.call(payload, 'description')) {
      const d = payload.description;
      if (d == null || String(d).trim() === '') delete next.description;
      else next.description = String(d);
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'type')) {
      const t = payload.type;
      const allowed = new Set(['Command', 'Directive', 'Snippet']);
      if (t == null || t === '') delete next.type;
      else if (allowed.has(String(t))) next.type = String(t);
    }

    next.updatedAt = new Date().toISOString();
    data.items[idx] = next;

    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return { ok: true, item: next };
  });

  /** Playwright / automation only — invokes `msc_vault_copyFile` without a native file dialog */
  if (process.env.VPE_E2E === '1') {
    ipcMain.handle('vpe:e2e-vault-copy-from-path', (_event, payload) => {
      if (!payload || typeof payload !== 'object') throw new Error('VPE E2E: Invalid payload.');
      const projectId = payload.projectId != null ? String(payload.projectId) : '';
      const srcPath = payload.srcPath != null ? String(payload.srcPath) : '';
      if (!projectId) throw new Error('VPE E2E: Missing project id.');
      if (!srcPath) throw new Error('VPE E2E: Missing srcPath.');
      const row = store.getProject(projectId);
      if (!row) throw new Error('VPE: Project not found');
      const dest = msc_vault_copyFile(row.name, srcPath, row.id);
      return { ok: true, dest, name: path.basename(dest) };
    });
  }
}

module.exports = { msc_registerVaultIpc };
