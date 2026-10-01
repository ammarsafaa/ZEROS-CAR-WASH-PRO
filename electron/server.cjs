// ZEROS CAR WASH PRO — LAN server (runs inside the main device's Electron process).
// Serves the app UI to other devices on the local network and holds the master
// database file. Fully offline — no internet involved, only the local router.
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

const PORT = 8787;
const COLLECTIONS = [
  "users", "customers", "vehicles", "services", "orders", "invoices",
  "workers", "shifts", "expenses", "items", "suppliers", "purchases",
  "packages", "subscriptions", "bookings", "coupons", "oilChanges", "dayCloses",
];

function localIPs() {
  const out = [];
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const n of nets[name] || []) {
      if (n.family === "IPv4" && !n.internal) out.push(n.address);
    }
  }
  return out;
}

// Merge two DB snapshots record-by-record: union by id; on conflict the record
// from the snapshot with the newer meta.savedAt wins. settings/counters too.
function mergeDB(a, b) {
  const aNewer = String((a.meta && a.meta.savedAt) || "") >= String((b.meta && b.meta.savedAt) || "");
  const newer = aNewer ? a : b;
  const older = aNewer ? b : a;
  const out = { ...older, ...newer };
  for (const key of COLLECTIONS) {
    const map = new Map();
    for (const r of older[key] || []) if (r && r.id != null) map.set(r.id, r);
    for (const r of newer[key] || []) if (r && r.id != null) map.set(r.id, r);
    out[key] = [...map.values()];
  }
  // audit log: union, newest first, capped
  const seen = new Set();
  const audit = [];
  for (const e of [...(newer.audit || []), ...(older.audit || [])]) {
    const k = `${e.at}|${e.user}|${e.action}|${e.details}`;
    if (!seen.has(k)) { seen.add(k); audit.push(e); }
  }
  audit.sort((x, y) => String(y.at).localeCompare(String(x.at)));
  out.audit = audit.slice(0, 2000);
  out.meta = { savedAt: new Date().toISOString() };
  return out;
}

function startServer(uiRoot, dbFile) {
  const readDB = () => {
    try { return JSON.parse(fs.readFileSync(dbFile, "utf8")); } catch { return null; }
  };
  const writeDB = (db) => {
    const tmp = dbFile + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, dbFile);
  };

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }

    if (url.pathname === "/api/ping") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: true, name: "ZEROS CAR WASH PRO", at: new Date().toISOString() }));
    }
    if (url.pathname === "/api/db" && req.method === "GET") {
      const db = readDB();
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(db || { empty: true }));
    }
    if (url.pathname === "/api/db" && req.method === "POST") {
      let body = "";
      req.on("data", (c) => { body += c; if (body.length > 50 * 1024 * 1024) req.destroy(); });
      req.on("end", () => {
        try {
          const incoming = JSON.parse(body);
          const current = readDB();
          const merged = current && !current.empty ? mergeDB(current, incoming) : incoming;
          merged.meta = { savedAt: new Date().toISOString() };
          writeDB(merged);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true, savedAt: merged.meta.savedAt }));
        } catch (e) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: String((e && e.message) || e) }));
        }
      });
      return;
    }

    // Static UI (other devices open the full app in their browser)
    let p = decodeURIComponent(url.pathname);
    if (p === "/") p = "/index.html";
    let file = path.normalize(path.join(uiRoot, p));
    if (!file.startsWith(uiRoot) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      file = path.join(uiRoot, "index.html"); // SPA fallback
    }
    const ext = path.extname(file).toLowerCase();
    const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2" };
    res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });

  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(PORT, "0.0.0.0", () => resolve(server));
  });
}

module.exports = { startServer, localIPs, PORT };
