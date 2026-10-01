// ZEROS CAR WASH PRO — SQL Server sync (renderer side).
// On the desktop program the master data lives in SQL Server (via the Electron main
// process). localStorage is only a working copy refreshed from SQL Server every 3s.
import { getDB, type DB } from "./db";

export interface SqlConfig { server: string; instance?: string; port?: string; database: string; auth: "sql" | "windows"; user: string; password: string; domain?: string; }
type Res<T = object> = Promise<{ ok: boolean; error?: string } & Partial<T>>;
export interface NativeSql {
  sqlGetConfig(): Promise<{ config: Omit<SqlConfig, "password"> | null; connected: boolean }>;
  sqlTest(c: SqlConfig): Res<{ version: string }>;
  sqlConnect(c?: SqlConfig): Res;
  sqlLoad(): Res<{ empty: boolean; db: DB }>;
  sqlSave(db: DB): Res<{ counters: Record<string, number> }>;
}
export const nativeSql = (): NativeSql | null => {
  if (typeof window === "undefined") return null;
  const n = (window as unknown as { cwpNative?: Partial<NativeSql> }).cwpNative;
  return n && typeof n.sqlLoad === "function" ? (n as NativeSql) : null;
};

const KEY = "cwp_db_v1";
let timer: ReturnType<typeof setInterval> | null = null;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pending = false;
let pushing = false;
let lastError = "";
let lastSyncAt = "";

export function syncStatus() { return { connected: !!timer, lastError, lastSyncAt }; }

function applyRemote(remote: DB): void {
  localStorage.setItem(KEY, JSON.stringify(remote));
  window.dispatchEvent(new Event("cwp-sync"));
}

async function pull(): Promise<void> {
  const n = nativeSql();
  if (!n || pending || pushing) return; // never overwrite unsaved local changes
  const r = await n.sqlLoad();
  if (!r.ok || !r.db) throw new Error(r.error || "load failed");
  if (pending || pushing) return;
  const local = getDB();
  if (String(r.db.meta?.savedAt || "") !== String(local.meta?.savedAt || "")) applyRemote(r.db);
  lastError = ""; lastSyncAt = new Date().toISOString();
}

export async function pushNow(): Promise<boolean> {
  const n = nativeSql();
  if (!n) return false;
  pushing = true; pending = false;
  try {
    const db = getDB();
    const r = await n.sqlSave(db);
    if (!r.ok) throw new Error(r.error || "save failed");
    if (r.counters) { const cur = getDB(); cur.counters = { ...cur.counters, ...r.counters }; localStorage.setItem(KEY, JSON.stringify(cur)); }
    lastError = ""; lastSyncAt = new Date().toISOString();
    return true;
  } catch (e) {
    lastError = String((e as Error)?.message || e); pending = true; // retry on next save/tick
    return false;
  } finally { pushing = false; }
}

/** Called by saveDB — debounced write to SQL Server. */
export function schedulePush(): void {
  if (!nativeSql()) return;
  pending = true;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => { void pushNow(); }, 400);
}

function startLoop(): void {
  if (timer) return;
  timer = setInterval(() => {
    if (pending && !pushing) { void pushNow(); return; }
    void pull().catch((e) => { lastError = String((e as Error)?.message || e); });
  }, 3000);
}

/**
 * Desktop start-up: connect to SQL Server and load the data.
 * First connection to an empty SQL database uploads this device's existing data.
 * Returns "web" when not running in the desktop program.
 */
export async function bootSql(c?: SqlConfig): Promise<"web" | "ok" | "setup" | string> {
  const n = nativeSql();
  if (!n) return "web";
  const st = await n.sqlGetConfig();
  if (!c && !st.config) return "setup";
  const con = await n.sqlConnect(c);
  if (!con.ok) return con.error || "connect failed";
  const r = await n.sqlLoad();
  if (!r.ok || !r.db) return r.error || "load failed";
  if (r.empty) {
    const s = await n.sqlSave(getDB()); // migrate local data (or fresh defaults) into SQL Server
    if (!s.ok) return s.error || "save failed";
  } else applyRemote(r.db);
  startLoop();
  lastSyncAt = new Date().toISOString();
  return "ok";
}

/** Kept for compatibility with the root component. */
export function initSync(): void { /* boot is handled by SqlGate */ }
