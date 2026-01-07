const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    minimizeWindow: () => ipcRenderer.send('minimize-window'),
    maximizeWindow: () => ipcRenderer.send('maximize-window'),
    closeWindow: () => ipcRenderer.send('close-window'),
    openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
    saveLibrary: (data) => ipcRenderer.invoke('save-library', data),
    loadLibrary: () => ipcRenderer.invoke('load-library')
});
