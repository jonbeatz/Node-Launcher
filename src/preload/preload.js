const { contextBridge, ipcRenderer } = require('electron');

/** v1.6.0 — preload bridge (IPC formatting + ghost watcher subscribe). */
function msc_formatCaughtForPreload(reason) {
  if (reason == null) return 'Unknown failure';
  if (typeof reason === 'string') {
    if (reason === '[object Event]') return 'IPC/Event-style failure ([object Event])';
    return reason;
  }
  if (typeof reason !== 'object') return String(reason);
  if (reason instanceof Error) return reason.message || reason.name || '[Error]';
  const o = reason;
  if (typeof o.message === 'string' && o.message.trim()) return o.message;
  if (typeof Event !== 'undefined' && reason instanceof Event) {
    const t = typeof o.type === 'string' ? o.type : 'unknown';
    return o.message ? `DOM Event (${t}): ${o.message}` : `DOM Event (${t})`;
  }
  try {
    const s = JSON.stringify(o);
    if (s && s !== '{}' && s !== '[]') return s;
  } catch (_) {
    /* fall through */
  }
  return o?.constructor?.name ? `[${o.constructor.name}]` : '[unserializable]';
}

/** All renderer IPC rejects become `Error` with a readable message (never raw DOM Event). */
function msc_invoke(channel, ...args) {
  return ipcRenderer.invoke(channel, ...args).catch((reason) => {
    throw new Error(msc_formatCaughtForPreload(reason));
  });
}

contextBridge.exposeInMainWorld('vpeAPI', {
  getProjects: () => msc_invoke('vpe:getProjects'),
  getRepairRuns: (limit) => msc_invoke('vpe:get-repair-runs', limit),
  recordRepairRun: (payload) => msc_invoke('vpe:record-repair-run', payload),
  getSystemStats: () => msc_invoke('vpe:get-system-stats'),
  getLogs: (projectId) => msc_invoke('vpe:getLogs', projectId),
  toggleStatus: (projectId) => msc_invoke('vpe:toggle-status', projectId),
  stopAllProjects: () => msc_invoke('vpe:stop-all'),
  catalogExport: (opts) => msc_invoke('vpe:catalog-export', opts),
  catalogImport: (opts) => msc_invoke('vpe:catalog-import', opts),
  clearAllProjects: () => msc_invoke('vpe:clear-all-projects'),
  runBuild: (projectId) => msc_invoke('vpe:run-build', projectId),
  nukeProject: (projectId) => msc_invoke('vpe:nuke-project', projectId),
  saveSettings: (payload) => msc_invoke('vpe:save-settings', payload),
  getAppSettings: () => msc_invoke('vpe:get-app-settings'),
  updateAppSettings: (payload) => msc_invoke('vpe:update-app-settings', payload),
  updateSettingLaunchStartup: (value) =>
    msc_invoke('vpe:update-setting-launch-startup', value),
  addProject: (payload) => msc_invoke('vpe:add-project', payload),
  autoFixProjectPort: (projectId) => msc_invoke('vpe:auto-fix-port', projectId),
  repairVaultLinks: () => msc_invoke('vpe:repair-vault-links'),
  deleteProject: (projectId) => msc_invoke('vpe:delete-project', projectId),
  openDirectory: () => msc_invoke('vpe:open-directory'),
  inspectProject: (projectPath) => msc_invoke('vpe:inspect-project', projectPath),
  vaultAddFile: (projectId) => msc_invoke('vpe:vault-add-file', projectId),
  vaultListFiles: (projectId) =>
    msc_invoke('vpe:vault-list-files', projectId),
  vaultOpenFolder: (projectId) =>
    msc_invoke('vpe:vault-open-folder', projectId),
  vaultDeleteFile: (projectId, fileName) =>
    msc_invoke('vpe:vault-delete-file', { projectId, fileName }),
  /** Only when main registers `vpe:e2e-vault-copy-from-path` (`VPE_E2E=1`). */
  e2eVaultCopyFromPath: (projectId, srcPath) =>
    msc_invoke('vpe:e2e-vault-copy-from-path', { projectId, srcPath }),
  pickThumbnail: (projectId, draftDisplayName) =>
    msc_invoke('vpe:pick-thumbnail', {
      projectId: projectId ?? '',
      draftDisplayName: draftDisplayName ?? null,
    }),
  openProjectUrl: (url) => msc_invoke('vpe:open-project-url', url),
  subscribeLogUpdate: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('vpe:log-update', listener);
    return () =>
      ipcRenderer.removeListener('vpe:log-update', listener);
  },
  subscribeProjectsUpdated: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('vpe:projects-updated', listener);
    return () =>
      ipcRenderer.removeListener('vpe:projects-updated', listener);
  },
  subscribeBootstrapDevVisible: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('vpe:bootstrap-dev-visible', listener);
    return () =>
      ipcRenderer.removeListener('vpe:bootstrap-dev-visible', listener);
  },
  /** v1.3.2 — orphan `node.exe` on catalog port while no project marked running */
  subscribeGhostPresence: (callback) => {
    const onDetected = (_event, data) =>
      callback({ active: true, ports: data?.ports ?? [], at: data?.at });
    const onCleared = () => callback({ active: false, ports: [] });
    ipcRenderer.on('vpe:ghost-detected', onDetected);
    ipcRenderer.on('vpe:ghost-cleared', onCleared);
    return () => {
      ipcRenderer.removeListener('vpe:ghost-detected', onDetected);
      ipcRenderer.removeListener('vpe:ghost-cleared', onCleared);
    };
  },
  getUnifiedLogs: (limit) => msc_invoke('vpe:get-unified-logs', limit),
  patchStartScript: (projectId) => msc_invoke('vpe:patch-start-script', projectId),
  takeStateSnapshot: () => msc_invoke('vpe:take-state-snapshot'),
  restoreStateSnapshot: () => msc_invoke('vpe:restore-state-snapshot'),
  executeTerminalCommand: async (command, activeProjectId) => {
    try {
      return await msc_invoke('vpe:execute-terminal-command', {
        command,
        activeProjectId,
      });
    } catch (reason) {
      return { ok: false, output: msc_formatCaughtForPreload(reason) };
    }
  },
  openExplorer: (folderPath) => msc_invoke('vpe:open-explorer', folderPath),
  openCursor: (projectPath) => msc_invoke('vpe:open-cursor', projectPath),
  openShell: (path, type) => msc_invoke('vpe:open-shell', { path, type }),
  killProcessOnPort: (port) => msc_invoke('vpe:kill-process-on-port', port),
  setProjectFavorite: (projectId, isFavorite) =>
    msc_invoke('vpe:set-project-favorite', { projectId, isFavorite }),
  clearRepairHistory: () => msc_invoke('vpe:clear-repair-history'),
  deleteRepairRun: (repairId) => msc_invoke('vpe:delete-repair-run', repairId),
  getLauncherPortHealth: () => msc_invoke('vpe:launcher-port-health'),
  purgeLauncherPorts: () => msc_invoke('vpe:purge-launcher-ports'),
  scorchedEarth: () => msc_invoke('vpe:scorched-earth'),
  purgeUnusedMedia: () => msc_invoke('vpe:purge-unused-media'),
  generateSupportBundle: () => msc_invoke('vpe:generate-support-bundle'),
  backupLocalDb: () => msc_invoke('vpe:backup-local-db'),
  reorderProject: (projectId, direction) =>
    msc_invoke('vpe:reorder-project', { projectId, direction }),
  readProjectDotEnv: (projectId) => msc_invoke('vpe:read-project-dotenv', projectId),
  writeProjectDotEnv: (payload) => msc_invoke('vpe:write-project-dotenv', payload),
  runForgeDiagnostics: () => msc_invoke('vpe:run-diagnostics'),
  promptVaultRead: () => msc_invoke('vpe:prompt-vault-read'),
  promptVaultWrite: (data) => msc_invoke('vpe:prompt-vault-write', data),
  updateVaultItem: (payload) => msc_invoke('vpe:update-vault-item', payload),
  subscribeRepairRunsChanged: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('vpe:repair-runs-changed', listener);
    return () => ipcRenderer.removeListener('vpe:repair-runs-changed', listener);
  },
});

contextBridge.exposeInMainWorld('vpeInfo', {
  platform: process.platform,
  version: '2.2.0',
  hardware: '9700x Tuned',
});

/** Legacy MSC channel (PM2); retained for telemetry / gradual migration */
contextBridge.exposeInMainWorld('mscLegacyAPI', {
  getProjects: () => msc_invoke('msc_getProjects'),
  startProject: (id) => msc_invoke('msc_startProject', id),
  stopProject: (id) => msc_invoke('msc_stopProject', id),
  nukeProject: (id) => msc_invoke('msc_nukeProject', id),
  onLogData: (callback) => {
    ipcRenderer.on('msc_logData', (_e, data) => callback(data));
  },
});
