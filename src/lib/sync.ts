// ZEROS CAR WASH PRO — LAN sync client (renderer side).
// Modes: "off" (single device, default) | "server" (this device is the main one,
// talks to its own Electron LAN server) | "client" (talks to the main device's IP).
// localStorage stays the fast local cache; the server holds the master copy.
import { getDB, type DB } from "./db";

export type SyncMode = "off" | "server" | "client";
export interface SyncConfig { mode: SyncMode; url?: string | undefined; }

const CFG_KEY = "cwp_sync_cfg";
const PORT = 8787;
let timer: ReturnType<typeof setInterval> | null = null;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pushing = false;
let lastError = "";
let lastSyncAt = "";

export function getSyncConfig(): SyncConfig {
  try {
    const raw = JSON.parse(localStorage.getItem(CFG_KEY) || "{}") as Partial<SyncConfig>;
    return { mode: raw.mode ?? "off", url: raw.url };
  } catch { return { mode: "off" }; }
}
export function setSyncConfig(cfg: SyncConfig): void {
  localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
  stopSync();
  if (cfg.mode !== "off") startSync();
}
export function syncStatus(): { mode: SyncMode; lastError: string; lastSyncAt: string } {
  return { mode: getSyncConfig().mode, lastError, lastSyncAt };
}

function serverURL(): string {
  const cfg = getSyncConfig();
  if (cfg.mode === "server") return `http://127.0.0.1:${PORT}`;
  return (cfg.url || "").replace(/\/+$/, "");
}

async function pull(): Promise<void> {
  const base = serverURL();
  if (!base) return;
  const res = await fetch(`${base}/api/db`, { cache: "no-store" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const remote = (await res.json()) as DB & { empty?: boolean };
  if (!remote || remote.empty || !remote.settings) return; // server fresh, keep local
  const local = getDB();
  const rAt = String(remote.meta?.savedAt || "");
  const lAt = String(local.meta?.savedAt || "");
  if (rAt && rAt !== lAt) {
    localStorage.setItem("cwp_db_v1", JSON.stringify(remote));
    window.dispatchEvent(new Event("cwp-sync"));
  }
  lastError = "";
  lastSyncAt = new Date().toISOString();
}

export async function pushNow(): Promise<boolean> {
  const base = serverURL();
  if (!base || getSyncConfig().mode === "off") return false;
  try {
    const res = await fetch(`${base}/api/db`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(getDB()),
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    lastError = "";
    lastSyncAt = new Date().toISOString();
    return true;
  } catch (e) {
    lastError = String((e as Error)?.message || e);
    return false;
  }
}

/** Called by saveDB — debounced push of the local DB to the server. */
export function schedulePush(): void {
  if (getSyncConfig().mode === "off") return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => { if (!pushing) { pushing = true; void pushNow().finally(() => { pushing = false; }); } }, 700);
}

export async function testConnection(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${url.replace(/\/+$/, "")}/api/ping`, { cache: "no-store" });
    const j = (await res.json()) as { ok?: boolean };
    return !!j.ok;
  } catch { return false; }
}

export function startSync(): void {
  if (timer || getSyncConfig().mode === "off") return;
  void pull().catch((e) => { lastError = String((e as Error)?.message || e); });
  timer = setInterval(() => {
    void pull().catch((e) => { lastError = String((e as Error)?.message || e); });
  }, 3000);
}
export function stopSync(): void {
  if (timer) { clearInterval(timer); timer = null; }
}

/** Call once at app start. */
export function initSync(): void {
  if (getSyncConfig().mode !== "off") startSync();
}
