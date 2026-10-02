// ZEROS CAR WASH PRO — Electron desktop shell. Serves the bundled app from disk over a
// private app:// scheme (stable origin => local data persists). Fully offline;
// internet is only used when the user checks for an update.
const { app, BrowserWindow, protocol, net, Menu, shell, ipcMain, dialog } = require("electron");
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
let quitAllowed = false;
ipcMain.on("quit-confirmed", () => { quitAllowed = true; app.quit(); });
ipcMain.on("quit-cancelled", () => {});
// ---- File backups (folder chosen once; default Documents/ZEROS Backups; keep last 30) ----
const BK_CFG = () => path.join(app.getPath("userData"), "backup-config.json");
function backupDir() {
  try { const d = JSON.parse(fs.readFileSync(BK_CFG(), "utf8")).dir; if (d) return d; } catch { /* default */ }
  return path.join(app.getPath("documents"), "ZEROS Backups");
}
ipcMain.handle("backup-get-dir", () => backupDir());
ipcMain.handle("backup-pick-dir", async () => {
  const r = await dialog.showOpenDialog(mainWin, { properties: ["openDirectory", "createDirectory"] });
  if (r.canceled || !r.filePaths[0]) return null;
  fs.writeFileSync(BK_CFG(), JSON.stringify({ dir: r.filePaths[0] }));
  return r.filePaths[0];
});
ipcMain.handle("backup-write-file", (_e, json) => {
  try {
    const dir = backupDir();
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const file = path.join(dir, `zeros-backup-${stamp}.json`);
    fs.writeFileSync(file, json);
    const old = fs.readdirSync(dir).filter((f) => /^zeros-backup-.*\.json$/.test(f)).sort().reverse().slice(30);
    for (const f of old) { try { fs.unlinkSync(path.join(dir, f)); } catch { /* ignore */ } }
    return { ok: true, file };
  } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
});
function createWindow() {
  const win = new BrowserWindow({
    width: 1366, height: 820, minWidth: 1024, minHeight: 640,
    title: "ZEROS CAR WASH PRO", backgroundColor: "#0b1220", autoHideMenuBar: true,
    icon: path.join(__dirname, "icon.ico"),
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: false, preload: path.join(__dirname, "preload.cjs") },
  });
  mainWin = win;
  win.maximize();
  win.loadURL("app://carwash/");
  // Close guard: ask the UI to confirm + take a mandatory backup first.
  let asking = false;
  win.on("close", (ev) => {
    if (quitAllowed) return;
    ev.preventDefault();
    if (asking) return;
    asking = true;
    win.webContents.send("close-requested");
    setTimeout(() => { asking = false; }, 1500);
  });
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
ipcMain.handle("printers-list", async (e) => { try { return await e.sender.getPrintersAsync(); } catch { return []; } });
ipcMain.handle("print-silent", (e, deviceName) => new Promise((res) => {
  e.sender.print({ silent: true, printBackground: true, deviceName }, (ok, reason) => res({ ok, error: ok ? undefined : reason }));
}));
ipcMain.on("app-version", (e) => { e.returnValue = app.getVersion(); });
ipcMain.handle("update-check", async () => {
  if (!updater || !app.isPackaged) return { ok: false, error: "no-updater" };
  try { await updater.checkForUpdates(); return { ok: true }; } catch (e) { return { ok: false, error: String(e.message || e) }; }
});
ipcMain.handle("update-download", async () => {
  try { await updater.downloadUpdate(); return { ok: true }; } catch (e) { return { ok: false, error: String(e.message || e) }; }
});
ipcMain.on("update-install", () => { if (updater) updater.quitAndInstall(false, true); });

// ---- LAN server (main-device mode): shares the database with other devices ----
const lan = require("./server.cjs");
const LAN_CFG = path.join(app.getPath("userData"), "lan-config.json");
const LAN_DB = path.join(app.getPath("userData"), "zeros-master-db.json");
let lanServer = null;
function lanCfg() { try { return JSON.parse(fs.readFileSync(LAN_CFG, "utf8")); } catch { return { enabled: false }; } }
async function lanStart() {
  if (lanServer) return { ok: true, ips: lan.localIPs(), port: lan.PORT };
  try {
    lanServer = await lan.startServer(ROOT, LAN_DB);
    fs.writeFileSync(LAN_CFG, JSON.stringify({ enabled: true }));
    return { ok: true, ips: lan.localIPs(), port: lan.PORT };
  } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
}
function lanStop() {
  if (lanServer) { try { lanServer.close(); } catch { /* ignore */ } lanServer = null; }
  fs.writeFileSync(LAN_CFG, JSON.stringify({ enabled: false }));
  return { ok: true };
}
ipcMain.handle("lan-start", () => lanStart());
ipcMain.handle("lan-stop", () => lanStop());
ipcMain.handle("lan-status", () => ({ running: !!lanServer, ips: lan.localIPs(), port: lan.PORT }));

// ---- SQL Server storage (required) ----
const store = require("./sqlstore.cjs");
const SQL_CFG = path.join(app.getPath("userData"), "sql-config.json");
const err = (e) => String((e && e.message) || e);
ipcMain.handle("sql-get-config", () => { const c = store.readCfg(SQL_CFG); if (c) delete c.password; return { config: c, connected: store.connected() }; });
ipcMain.handle("sql-test", async (_e, c) => { try { return { ok: true, version: await store.test(c) }; } catch (e) { return { ok: false, error: err(e) }; } });
ipcMain.handle("sql-connect", async (_e, c) => {
  try { const cfg = c || store.readCfg(SQL_CFG); if (!cfg) return { ok: false, error: "no-config" };
    await store.open(cfg); if (c) store.writeCfg(SQL_CFG, c); return { ok: true }; } catch (e) { return { ok: false, error: err(e) }; }
});
ipcMain.handle("sql-load", async () => { try { return { ok: true, ...(await store.load()) }; } catch (e) { return { ok: false, error: err(e) }; } });
ipcMain.handle("sql-save", async (_e, db) => { try { return await store.save(db); } catch (e) { return { ok: false, error: err(e) }; } });

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  protocol.handle("app", (req) => {
    const p = decodeURIComponent(new URL(req.url).pathname);
    let file = path.normalize(path.join(ROOT, p));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(ROOT, "index.html");
    return net.fetch(pathToFileURL(file).toString());
  });
  createWindow();
  if (lanCfg().enabled) void lanStart(); // re-open the LAN server if it was on
});
app.on("second-instance", () => { const w = BrowserWindow.getAllWindows()[0]; if (w) { if (w.isMinimized()) w.restore(); w.focus(); } });
app.on("window-all-closed", () => app.quit());
