// ZEROS CAR WASH PRO — SQL Server storage (main process).
// Every collection is a real SQL Server table: cw_<name>(id PK, data JSON, updated_at).
// settings / counters live in cw_kv. Several devices may share one SQL Server.
const sql = require("mssql");
const fs = require("fs");

const COLLECTIONS = ["users","customers","vehicles","services","orders","invoices","audit","workers","shifts","expenses","items","suppliers","purchases","packages","subscriptions","bookings","coupons","oilChanges","dayCloses"];
const tname = (c) => "cw_" + c.toLowerCase();

let pool = null;
let cfg = null;
let last = null; // { [collection]: Map<id, json> } — what this device last saw on the server

function readCfg(file) { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return null; } }
function writeCfg(file, c) { fs.writeFileSync(file, JSON.stringify(c, null, 2)); }

function toMssql(c, database) {
  const o = {
    server: c.server || "localhost",
    database,
    options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
    connectionTimeout: 8000,
    requestTimeout: 30000,
  };
  if (c.instance) o.options.instanceName = c.instance;
  if (c.port) o.port = Number(c.port);
  if (c.auth === "windows") {
    o.authentication = { type: "ntlm", options: { domain: c.domain || "", userName: c.user || "", password: c.password || "" } };
  } else { o.user = c.user; o.password = c.password; }
  return o;
}

const safeDb = (n) => String(n || "ZerosCarWash").replace(/[^A-Za-z0-9_]/g, "");

async function connect(c) {
  const dbName = safeDb(c.database);
  // 1) make sure the database exists
  const master = await new sql.ConnectionPool(toMssql(c, "master")).connect();
  try {
    await master.request().query(`IF DB_ID(N'${dbName}') IS NULL CREATE DATABASE [${dbName}]`);
  } finally { await master.close(); }
  // 2) open the app pool and create tables
  const p = await new sql.ConnectionPool(toMssql(c, dbName)).connect();
  for (const col of COLLECTIONS) {
    const t = tname(col);
    await p.request().query(`IF OBJECT_ID(N'dbo.${t}', N'U') IS NULL CREATE TABLE dbo.${t} (id NVARCHAR(200) NOT NULL PRIMARY KEY, data NVARCHAR(MAX) NOT NULL, updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME())`);
  }
  await p.request().query(`IF OBJECT_ID(N'dbo.cw_kv', N'U') IS NULL CREATE TABLE dbo.cw_kv (k NVARCHAR(100) NOT NULL PRIMARY KEY, v NVARCHAR(MAX) NOT NULL, updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME())`);
  return p;
}

function auditId(a) {
  const s = JSON.stringify(a); let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return "a" + (h >>> 0).toString(36) + "_" + String(a.at || "");
}
const rowId = (col, r) => (col === "audit" ? (r.id || auditId(r)) : String(r.id));

async function load() {
  if (!pool) throw new Error("not-connected");
  const db = {}; const snap = {};
  for (const col of COLLECTIONS) {
    const r = await pool.request().query(`SELECT id, data FROM dbo.${tname(col)}`);
    const m = new Map(); const arr = [];
    for (const row of r.recordset) { m.set(row.id, row.data); try { arr.push(JSON.parse(row.data)); } catch { /* skip bad row */ } }
    if (col === "audit") arr.sort((a, b) => String(a.at).localeCompare(String(b.at)));
    db[col] = arr; snap[col] = m;
  }
  const kv = await pool.request().query("SELECT k, v FROM dbo.cw_kv");
  const map = Object.fromEntries(kv.recordset.map((x) => [x.k, x.v]));
  const empty = !map.settings;
  if (map.settings) db.settings = JSON.parse(map.settings);
  db.counters = map.counters ? JSON.parse(map.counters) : {};
  db.meta = { savedAt: map.savedAt || "" };
  last = snap;
  return { empty, db };
}

async function save(db) {
  if (!pool) throw new Error("not-connected");
  if (!last) await load();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    for (const col of COLLECTIONS) {
      const prev = last[col] || new Map();
      const next = new Map();
      for (const r of db[col] || []) next.set(rowId(col, r), JSON.stringify(r));
      for (const [id, json] of next) {
        if (prev.get(id) === json) continue;
        await tx.request().input("id", sql.NVarChar(200), id).input("d", sql.NVarChar(sql.MAX), json)
          .query(`MERGE dbo.${tname(col)} AS t USING (SELECT @id AS id) AS s ON t.id = s.id
                  WHEN MATCHED THEN UPDATE SET data = @d, updated_at = SYSUTCDATETIME()
                  WHEN NOT MATCHED THEN INSERT (id, data) VALUES (@id, @d);`);
      }
      if (col !== "audit") {
        for (const id of prev.keys()) if (!next.has(id)) {
          await tx.request().input("id", sql.NVarChar(200), id).query(`DELETE FROM dbo.${tname(col)} WHERE id = @id`);
        }
      }
      last[col] = next;
    }
    // counters only grow: keep the max of server and this device (safe with many devices)
    const cur = await tx.request().query("SELECT v FROM dbo.cw_kv WITH (UPDLOCK) WHERE k = 'counters'");
    const server = cur.recordset[0] ? JSON.parse(cur.recordset[0].v) : {};
    const merged = { ...server };
    for (const [k, v] of Object.entries(db.counters || {})) merged[k] = Math.max(Number(v) || 0, Number(server[k]) || 0);
    const kv = { settings: JSON.stringify(db.settings || {}), counters: JSON.stringify(merged), savedAt: String((db.meta && db.meta.savedAt) || new Date().toISOString()) };
    for (const [k, v] of Object.entries(kv)) {
      await tx.request().input("k", sql.NVarChar(100), k).input("v", sql.NVarChar(sql.MAX), v)
        .query(`MERGE dbo.cw_kv AS t USING (SELECT @k AS k) AS s ON t.k = s.k
                WHEN MATCHED THEN UPDATE SET v = @v, updated_at = SYSUTCDATETIME()
                WHEN NOT MATCHED THEN INSERT (k, v) VALUES (@k, @v);`);
    }
    await tx.commit();
    return { ok: true, counters: merged };
  } catch (e) {
    try { await tx.rollback(); } catch { /* ignore */ }
    last = null; // force a fresh read next time
    throw e;
  }
}

async function open(c) {
  if (pool) { try { await pool.close(); } catch { /* ignore */ } pool = null; }
  pool = await connect(c); cfg = c; last = null;
}

async function test(c) {
  const p = await connect(c);
  const r = await p.request().query("SELECT @@VERSION AS v");
  await p.close();
  return String(r.recordset[0].v).split("\n")[0];
}

module.exports = { readCfg, writeCfg, open, test, load, save, connected: () => !!pool, config: () => cfg };
