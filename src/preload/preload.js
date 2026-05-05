const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vpeAPI', {
  getProjects: () => ipcRenderer.invoke('vpe:getProjects'),
  getLogs: (projectId) => ipcRenderer.invoke('vpe:getLogs', projectId),
  toggleStatus: (projectId) => ipcRenderer.invoke('vpe:toggle-status', projectId),
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
});

contextBridge.exposeInMainWorld('vpeInfo', {
  platform: process.platform,
  version: '1.0.0',
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
