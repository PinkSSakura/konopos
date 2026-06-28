const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('posDesktop', {
  startBackend: () => ipcRenderer.invoke('backend-start'),
  stopBackend: () => ipcRenderer.invoke('backend-stop'),
  startWeb: () => ipcRenderer.invoke('web-start'),
  stopWeb: () => ipcRenderer.invoke('web-stop'),
  getStatus: () => ipcRenderer.invoke('get-status'),
  openPos: () => ipcRenderer.invoke('open-pos'),
  openCds: () => ipcRenderer.invoke('open-cds'),
  copyUrl: (url) => ipcRenderer.invoke('copy-url', url),
  openBrowser: (url) => ipcRenderer.invoke('open-browser', url),
  exit: () => ipcRenderer.invoke('app-exit'),
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  checkForUpdates: () => ipcRenderer.invoke('update-check'),
  downloadUpdate: () => ipcRenderer.invoke('update-download'),
  quitAndInstall: () => ipcRenderer.invoke('update-quit-and-install'),
  onLog: (callback) => {
    const handler = (_event, entry) => callback(entry);
    ipcRenderer.on('log', handler);
    return () => ipcRenderer.removeListener('log', handler);
  },
  onUpdateStatus: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('update-status', handler);
    return () => ipcRenderer.removeListener('update-status', handler);
  },
});
