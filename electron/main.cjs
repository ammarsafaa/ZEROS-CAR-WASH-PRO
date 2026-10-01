// CAR WASH PRO — Electron desktop shell. Serves the bundled app from disk over a
// private app:// scheme (stable origin => local data persists). Fully offline;
// internet is only used when the user checks for an update.
const { app, BrowserWindow, protocol, net, Menu, shell, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");

// Installed build: UI is copied to resources/app. Dev/portable: normal Vite output.
const PACKED_UI = path.join(process.resourcesPath || "", "app");
const ROOT = app.isPackaged && fs.existsSync(path.join(PACKED_UI, "index.html"))
  ? PACKED_UI
  : path.join(__dirname, "..", "dist", "client");
protocol.registerSchemesAsPrivileged([{ scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);

if (!app.requestSingleInstanceLock()) app.quit();

let mainWin = null;
function createWindow() {
  const win = new BrowserWindow({
    width: 1366, height: 820, minWidth: 1024, minHeight: 640,
    title: "CAR WASH PRO", backgroundColor: "#0b1220", autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: false, preload: path.join(__dirname, "preload.cjs") },
  });
  mainWin = win;
  win.maximize();
  win.loadURL("app://carwash/");
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url === "" || url === "about:blank") return { action: "allow" }; // print popups
    if (url.startsWith("http")) shell.openExternal(url);
    return { action: "deny" };
  });
}

// ---- Updates (GitHub Releases). Only needs internet while updating; data is untouched ----
let updater = null;
try { updater = require("electron-updater").autoUpdater; updater.autoDownload = false; } catch { updater = null; }
function sendUpd(s) { if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send("update-status", s); }
if (updater) {
  updater.on("update-available", (i) => sendUpd({ state: "available", version: i.version }));
  updater.on("update-not-available", () => sendUpd({ state: "none" }));
  updater.on("download-progress", (p) => sendUpd({ state: "downloading", percent: Math.round(p.percent) }));
  updater.on("update-downloaded", (i) => sendUpd({ state: "ready", version: i.version }));
  updater.on("error", (e) => sendUpd({ state: "error", error: String((e && e.message) || e) }));
}
ipcMain.on("app-version", (e) => { e.returnValue = app.getVersion(); });
ipcMain.handle("update-check", async () => {
  if (!updater || !app.isPackaged) return { ok: false, error: "no-updater" };
  try { await updater.checkForUpdates(); return { ok: true }; } catch (e) { return { ok: false, error: String(e.message || e) }; }
});
ipcMain.handle("update-download", async () => {
  try { await updater.downloadUpdate(); return { ok: true }; } catch (e) { return { ok: false, error: String(e.message || e) }; }
});
ipcMain.on("update-install", () => { if (updater) updater.quitAndInstall(false, true); });

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  protocol.handle("app", (req) => {
    const p = decodeURIComponent(new URL(req.url).pathname);
    let file = path.normalize(path.join(ROOT, p));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(ROOT, "index.html");
    return net.fetch(pathToFileURL(file).toString());
  });
  createWindow();
});
app.on("second-instance", () => { const w = BrowserWindow.getAllWindows()[0]; if (w) { if (w.isMinimized()) w.restore(); w.focus(); } });
app.on("window-all-closed", () => app.quit());
