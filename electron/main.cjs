// CAR WASH PRO — Electron desktop shell. Serves the bundled app from disk over a
// private app:// scheme (stable origin => local data persists). Fully offline.
const { app, BrowserWindow, protocol, net, Menu, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");

const ROOT = path.join(__dirname, "..", "dist", "client");
protocol.registerSchemesAsPrivileged([{ scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);

if (!app.requestSingleInstanceLock()) app.quit();

function createWindow() {
  const win = new BrowserWindow({
    width: 1366, height: 820, minWidth: 1024, minHeight: 640,
    title: "CAR WASH PRO", backgroundColor: "#0b1220", autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.maximize();
  win.loadURL("app://carwash/");
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url === "" || url === "about:blank") return { action: "allow" }; // print popups
    if (url.startsWith("http")) shell.openExternal(url);
    return { action: "deny" };
  });
}

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
