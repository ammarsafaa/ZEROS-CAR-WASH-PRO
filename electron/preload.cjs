const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("cwpNative", {
  appVersion: () => ipcRenderer.sendSync("app-version"),
  checkUpdate: () => ipcRenderer.invoke("update-check"),
  downloadUpdate: () => ipcRenderer.invoke("update-download"),
  installUpdate: () => ipcRenderer.send("update-install"),
  onUpdateStatus: (cb) => {
    const h = (_e, s) => cb(s);
    ipcRenderer.on("update-status", h);
    return () => ipcRenderer.removeListener("update-status", h);
  },
});
