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
  // LAN main-device mode
  lanStart: () => ipcRenderer.invoke("lan-start"),
  lanStop: () => ipcRenderer.invoke("lan-stop"),
  lanStatus: () => ipcRenderer.invoke("lan-status"),
  // SQL Server storage
  sqlGetConfig: () => ipcRenderer.invoke("sql-get-config"),
  sqlTest: (c) => ipcRenderer.invoke("sql-test", c),
  sqlConnect: (c) => ipcRenderer.invoke("sql-connect", c),
  sqlLoad: () => ipcRenderer.invoke("sql-load"),
  sqlSave: (db) => ipcRenderer.invoke("sql-save", db),
});
