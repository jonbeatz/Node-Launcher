const { contextBridge, ipcRenderer } = require('electron');

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
  addProject: (payload) => ipcRenderer.invoke('vpe:add-project', payload),
  autoFixProjectPort: (projectId) =>
    ipcRenderer.invoke('vpe:auto-fix-port', projectId),
  deleteProject: (projectId) => ipcRenderer.invoke('vpe:delete-project', projectId),
  openDirectory: () => ipcRenderer.invoke('vpe:open-directory'),
  inspectProject: (projectPath) =>
    ipcRenderer.invoke('vpe:inspect-project', projectPath),
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
  getUnifiedLogs: (limit) =>
    ipcRenderer.invoke('vpe:get-unified-logs', limit),
  patchStartScript: (projectId) =>
    ipcRenderer.invoke('vpe:patch-start-script', projectId),
  takeStateSnapshot: () => ipcRenderer.invoke('vpe:take-state-snapshot'),
  restoreStateSnapshot: () => ipcRenderer.invoke('vpe:restore-state-snapshot'),
  executeTerminalCommand: (command, activeProjectId) =>
    ipcRenderer.invoke('vpe:execute-terminal-command', { command, activeProjectId }),
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
  promptVaultRead: () => ipcRenderer.invoke('vpe:prompt-vault-read'),
  promptVaultWrite: (data) => ipcRenderer.invoke('vpe:prompt-vault-write', data),
  subscribeRepairRunsChanged: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('vpe:repair-runs-changed', listener);
    return () => ipcRenderer.removeListener('vpe:repair-runs-changed', listener);
  },
});

contextBridge.exposeInMainWorld('vpeInfo', {
  platform: process.platform,
  version: '1.1.7',
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
