const { contextBridge, ipcRenderer } = require('electron');
const cfg = ipcRenderer.sendSync('get-config');
if (cfg) contextBridge.exposeInMainWorld('OX_CONFIG', cfg);
contextBridge.exposeInMainWorld('oxDesktop', {
  openExternal: url => ipcRenderer.invoke('open-external', url),
  openSettings: () => ipcRenderer.invoke('open-settings'),
  getSettings: () => ipcRenderer.sendSync('get-settings'),
  saveSettings: s => ipcRenderer.invoke('save-settings', s)
});
