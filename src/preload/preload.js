const { contextBridge, ipcRenderer } = require('electron');

/** v1.5.0 — preload bridge (IPC formatting + ghost watcher subscribe). */
function msc_formatCaughtForPreload(reason) {
  if (reason == null) return 'Unknown failure';
  if (typeof reason === 'string') return reason;
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

contextBridge.exposeInMainWorld('vpeAPI', {
  getProjects: () => ipcRenderer.invoke('vpe:getProjects'),
  getRepairRuns: (limit) => ipcRenderer.invoke('vpe:get-repair-runs', limit),
  recordRepairRun: (payload) =>
    ipcRenderer.invoke('vpe:record-repair-run', payload),
  getSystemStats: () => ipcRenderer.invoke('vpe:get-system-stats'),
  getLogs: (projectId) => ipcRenderer.invoke('vpe:getLogs', projectId),
  toggleStatus: (projectId) => ipcRenderer.invoke('vpe:toggle-status', projectId),
  stopAllProjects: () => ipcRenderer.invoke('vpe:stop-all'),
  catalogExport: (opts) => ipcRenderer.invoke('vpe:catalog-export', opts),
  catalogImport: (opts) => ipcRenderer.invoke('vpe:catalog-import', opts),
  clearAllProjects: () => ipcRenderer.invoke('vpe:clear-all-projects'),
  runBuild: (projectId) => ipcRenderer.invoke('vpe:run-build', projectId),
  nukeProject: (projectId) => ipcRenderer.invoke('vpe:nuke-project', projectId),
  saveSettings: (payload) => ipcRenderer.invoke('vpe:save-settings', payload),
  getAppSettings: () => ipcRenderer.invoke('vpe:get-app-settings'),
  updateAppSettings: (payload) => ipcRenderer.invoke('vpe:update-app-settings', payload),
  updateSettingLaunchStartup: (value) =>
    ipcRenderer.invoke('vpe:update-setting-launch-startup', value),
  addProject: (payload) => ipcRenderer.invoke('vpe:add-project', payload),
  autoFixProjectPort: (projectId) =>
    ipcRenderer.invoke('vpe:auto-fix-port', projectId),
  deleteProject: (projectId) => ipcRenderer.invoke('vpe:delete-project', projectId),
  openDirectory: () => ipcRenderer.invoke('vpe:open-directory'),
  inspectProject: (projectPath) =>
    ipcRenderer.invoke('vpe:inspect-project', projectPath),
  vaultAddFile: (projectId) => ipcRenderer.invoke('vpe:vault-add-file', projectId),
  vaultListFiles: (projectId) =>
    ipcRenderer.invoke('vpe:vault-list-files', projectId),
  vaultOpenFolder: (projectId) =>
    ipcRenderer.invoke('vpe:vault-open-folder', projectId),
  /** Only when main registers `vpe:e2e-vault-copy-from-path` (`VPE_E2E=1`). */
  e2eVaultCopyFromPath: (projectId, srcPath) =>
    ipcRenderer.invoke('vpe:e2e-vault-copy-from-path', { projectId, srcPath }),
  pickThumbnail: (projectId) =>
    ipcRenderer.invoke('vpe:pick-thumbnail', projectId),
  openProjectUrl: (url) => ipcRenderer.invoke('vpe:open-project-url', url),
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
  getUnifiedLogs: (limit) =>
    ipcRenderer.invoke('vpe:get-unified-logs', limit),
  patchStartScript: (projectId) =>
    ipcRenderer.invoke('vpe:patch-start-script', projectId),
  takeStateSnapshot: () => ipcRenderer.invoke('vpe:take-state-snapshot'),
  restoreStateSnapshot: () => ipcRenderer.invoke('vpe:restore-state-snapshot'),
  executeTerminalCommand: async (command, activeProjectId) => {
    try {
      return await ipcRenderer.invoke('vpe:execute-terminal-command', {
        command,
        activeProjectId,
      });
    } catch (reason) {
      return { ok: false, output: msc_formatCaughtForPreload(reason) };
    }
  },
  openExplorer: (folderPath) => ipcRenderer.invoke('vpe:open-explorer', folderPath),
  openShell: (path, type) => ipcRenderer.invoke('vpe:open-shell', { path, type }),
  killProcessOnPort: (port) => ipcRenderer.invoke('vpe:kill-process-on-port', port),
  setProjectFavorite: (projectId, isFavorite) =>
    ipcRenderer.invoke('vpe:set-project-favorite', { projectId, isFavorite }),
  clearRepairHistory: () => ipcRenderer.invoke('vpe:clear-repair-history'),
  deleteRepairRun: (repairId) =>
    ipcRenderer.invoke('vpe:delete-repair-run', repairId),
  getLauncherPortHealth: () => ipcRenderer.invoke('vpe:launcher-port-health'),
  purgeLauncherPorts: () => ipcRenderer.invoke('vpe:purge-launcher-ports'),
  scorchedEarth: () => ipcRenderer.invoke('vpe:scorched-earth'),
  runForgeDiagnostics: () => ipcRenderer.invoke('vpe:run-diagnostics'),
  promptVaultRead: () => ipcRenderer.invoke('vpe:prompt-vault-read'),
  promptVaultWrite: (data) => ipcRenderer.invoke('vpe:prompt-vault-write', data),
  updateVaultItem: (payload) => ipcRenderer.invoke('vpe:update-vault-item', payload),
  subscribeRepairRunsChanged: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('vpe:repair-runs-changed', listener);
    return () => ipcRenderer.removeListener('vpe:repair-runs-changed', listener);
  },
});

contextBridge.exposeInMainWorld('vpeInfo', {
  platform: process.platform,
  version: '1.5.0',
  hardware: '9700x Tuned',
});

/** Legacy MSC channel (PM2); retained for telemetry / gradual migration */
contextBridge.exposeInMainWorld('mscLegacyAPI', {
  getProjects: () => ipcRenderer.invoke('msc_getProjects'),
  startProject: (id) => ipcRenderer.invoke('msc_startProject', id),
  stopProject: (id) => ipcRenderer.invoke('msc_stopProject', id),
  nukeProject: (id) => ipcRenderer.invoke('msc_nukeProject', id),
  onLogData: (callback) => {
    ipcRenderer.on('msc_logData', (_e, data) => callback(data));
  },
});
