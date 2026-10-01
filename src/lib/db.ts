// Car Wash Pro — local offline data layer (localStorage-backed)
// All data stays on the device. No network, no cloud.

export type Role = "admin" | "manager" | "cashier" | "supervisor" | "worker";

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  name: string;
  role: Role;
  active: boolean;
}

export interface Customer {
  id: string;
  code: string;
  name: string;
  phone: string;
  address?: string;
  notes?: string;
  createdAt: string;
  points: number;
  balance: number;
}

export interface Vehicle {
  id: string;
  code: string;
  customerId: string;
  plate: string;
  make: string;
  model: string;
  year?: string;
  color?: string;
  type: string;
  notes?: string;
}

export interface Service {
  id: string;
  nameAr: string;
  nameEn: string;
  category: string;
  price: number;
  cost: number;
  minutes: number;
  active: boolean;
  commission: number;
}

export type OrderStatus =
  | "WAITING"
  | "IN_WASH"
  | "DETAILING"
  | "QUALITY"
  | "READY"
  | "DELIVERED"
  | "CANCELLED";

export interface OrderItem {
  serviceId: string;
  name: string;
  price: number;
}

export interface Order {
  id: string;
  code: string;
  customerId: string;
  vehicleId: string;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  createdAt: string;
  history: { status: OrderStatus; at: string }[];
  workerId?: string | undefined;
}

export interface Invoice {
  id: string;
  code: string;
  orderId: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  method: string;
  cashier: string;
  createdAt: string;
  voided?: boolean;
  voidReason?: string;
  lines?: InvoiceLine[] | undefined;
  customerId?: string | undefined;
  vehicleId?: string | undefined;
  couponCode?: string | undefined;
  pointsUsed?: number | undefined;
  paid?: number | undefined;
}
export interface InvoiceLine { kind: "service" | "product"; refId: string; name: string; qty: number; price: number; }

export interface Settings {
  businessName: string;
  phone: string;
  address: string;
  currency: string;
  taxEnabled: boolean;
  taxRate: number;
  pointsPer1000?: number;
  pointValue?: number;
  oilIntervalKm?: number;
  autoBackup?: boolean;
  lastBackupAt?: string;
}

export interface AuditEntry {
  at: string;
  user: string;
  action: string;
  details: string;
}

export interface DB {
  meta?: { savedAt: string };
  users: User[];
  customers: Customer[];
  vehicles: Vehicle[];
  services: Service[];
  orders: Order[];
  invoices: Invoice[];
  settings: Settings;
  counters: Record<string, number>;
  audit: AuditEntry[];
  workers: Worker[];
  shifts: Shift[];
  expenses: Expense[];
  items: StockItem[];
  suppliers: Supplier[];
  purchases: Purchase[];
  packages: Package[];
  subscriptions: Subscription[];
  bookings: Booking[];
  coupons: Coupon[];
  oilChanges: OilChange[];
  dayCloses: DayClose[];
}

export interface Worker { id: string; code: string; name: string; phone: string; job: string; salary: number; commissionPct: number; active: boolean; createdAt: string; }
export interface Shift { id: string; code: string; user: string; openedAt: string; openingCash: number; closedAt?: string; countedCash?: number; expectedCash?: number; notes?: string; }
export interface Expense { id: string; code: string; category: string; amount: number; method: string; note: string; date: string; user: string; }
export interface StockItem { id: string; code: string; name: string; unit: string; qty: number; minQty: number; cost: number; sellPrice?: number; barcode?: string; category?: string; sellable?: boolean; }
export interface Coupon { id: string; code: string; type: "pct" | "amount"; value: number; minTotal: number; maxUses: number; used: number; expiresAt: string; active: boolean; }
export interface OilChange { id: string; vehicleId: string; invoiceCode: string; date: string; km: number; nextKm: number; products: string; }
export interface DayClose { id: string; date: string; user: string; sales: number; invoices: number; expenses: number; cash: number; at: string; }
export interface Supplier { id: string; code: string; name: string; phone: string; address: string; balance: number; }
export interface Purchase { id: string; code: string; supplierId: string; lines: { itemId: string; qty: number; cost: number }[]; total: number; paid: number; date: string; user: string; }
export interface Package { id: string; name: string; price: number; washes: number; days: number; serviceIds: string[]; active: boolean; }
export interface Subscription { id: string; code: string; customerId: string; vehicleId?: string | undefined; packageId: string; remaining: number; startAt: string; endAt: string; usage: string[]; }
export interface Booking { id: string; code: string; customerName: string; phone: string; vehicle: string; serviceIds: string[]; date: string; status: "PENDING" | "CONFIRMED" | "DONE" | "CANCELLED"; notes: string; }

const KEY = "cwp_db_v1";

// Simple offline hash (local desktop app; not exposed to any network)
export function hashPassword(s: string): string {
  let h1 = 0xdeadbeef ^ s.length;
  let h2 = 0x41c6ce57 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16) + (h1 >>> 0).toString(16);
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

const ARRAYS = ["workers","shifts","expenses","items","suppliers","purchases","packages","subscriptions","bookings","coupons","oilChanges","dayCloses"] as const;
function seed(): Omit<DB, (typeof ARRAYS)[number]> {
  const now = new Date().toISOString();
  const services: Service[] = [
    ["غسيل خارجي", "Exterior Wash", "غسيل", 10000, 3000, 20, 1000],
    ["غسيل داخلي", "Interior Wash", "غسيل", 12000, 3500, 25, 1000],
    ["غسيل داخلي وخارجي", "Full Wash", "غسيل", 20000, 6000, 45, 2000],
    ["غسيل VIP", "VIP Wash", "غسيل", 35000, 10000, 60, 3000],
    ["غسيل سريع", "Express Wash", "غسيل", 8000, 2500, 15, 500],
    ["تنظيف المقاعد", "Seat Cleaning", "تنظيف", 15000, 4000, 30, 1500],
    ["تنظيف السجاد", "Carpet Cleaning", "تنظيف", 10000, 3000, 25, 1000],
    ["تنظيف المحرك", "Engine Cleaning", "محرك", 15000, 4000, 30, 1500],
    ["تلميع خارجي", "Exterior Polish", "تلميع", 30000, 9000, 60, 5000],
    ["واكس", "Wax", "تلميع", 20000, 6000, 30, 3000],
    ["سيراميك", "Ceramic Coating", "تلميع", 150000, 50000, 180, 15000],
    ["تلميع إطارات", "Tire Shine", "إطارات", 5000, 1500, 10, 500],
    ["تعطير داخلي", "Interior Perfume", "أخرى", 5000, 1500, 10, 500],
  ].map(([nameAr, nameEn, category, price, cost, minutes, commission]) => ({
    id: uid(),
    nameAr: nameAr as string,
    nameEn: nameEn as string,
    category: category as string,
    price: price as number,
    cost: cost as number,
    minutes: minutes as number,
    active: true,
    commission: commission as number,
  }));

  return {
    users: [
      {
        id: uid(),
        username: "admin",
        passwordHash: hashPassword("123456"),
        name: "المدير",
        role: "admin",
        active: true,
      },
    ],
    customers: [],
    vehicles: [],
    services,
    orders: [],
    invoices: [],
    settings: {
      businessName: "ZEROS ZEROS CAR WASH PRO",
      phone: "",
      address: "",
      currency: "IQD",
      taxEnabled: false,
      taxRate: 0,
    },
    counters: {},
    audit: [{ at: now, user: "system", action: "INIT", details: "Database created" }],
  };
}

export function getDB(): DB {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return migrate(JSON.parse(raw) as DB);
  } catch {
    /* corrupted -> reseed */
  }
  const db = migrate(seed() as DB);
  localStorage.setItem(KEY, JSON.stringify(db));
  return db;
}

function migrate(db: DB): DB {
  for (const k of ARRAYS) if (!Array.isArray((db as any)[k])) (db as any)[k] = [];
  return db;
}

export function saveDB(db: DB): void {
  db.meta = { savedAt: new Date().toISOString() };
  localStorage.setItem(KEY, JSON.stringify(db));
  // LAN sync (no-op when sync is off). Dynamic import avoids a module cycle.
  void import("./sync").then((m) => m.schedulePush()).catch(() => {});
}

export function nextCode(db: DB, prefix: string, yearly = false): string {
  const year = new Date().getFullYear();
  const key = yearly ? `${prefix}-${year}` : prefix;
  const n = (db.counters[key] ?? 0) + 1;
  db.counters[key] = n;
  const num = String(n).padStart(6, "0");
  return yearly ? `${prefix}-${year}-${num}` : `${prefix}-${num}`;
}

export function logAudit(db: DB, user: string, action: string, details: string): void {
  db.audit.unshift({ at: new Date().toISOString(), user, action, details });
  if (db.audit.length > 2000) db.audit.length = 2000;
}

export function newId(): string {
  return uid();
}

export function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

export function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

// ---- session ----
export interface Session {
  userId: string;
  username: string;
  name: string;
  role: Role;
}

const SESSION_KEY = "cwp_session";

export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function login(username: string, password: string): Session | null {
  const db = getDB();
  const user = db.users.find(
    (u) => u.username === username && u.active && u.passwordHash === hashPassword(password),
  );
  if (!user) return null;
  const session: Session = {
    userId: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  logAudit(db, user.username, "LOGIN", "تسجيل دخول");
  saveDB(db);
  return session;
}

export function logout(): void {
  const s = getSession();
  if (s) {
    const db = getDB();
    logAudit(db, s.username, "LOGOUT", "تسجيل خروج");
    saveDB(db);
  }
  localStorage.removeItem(SESSION_KEY);
}

// ---- language ----
export type Lang = "ar" | "en";
const LANG_KEY = "cwp_lang";

export function getLang(): Lang {
  return (localStorage.getItem(LANG_KEY) as Lang) || "ar";
}

export function setLang(l: Lang): void {
  localStorage.setItem(LANG_KEY, l);
  document.documentElement.lang = l;
  document.documentElement.dir = l === "ar" ? "rtl" : "ltr";
}

// ---- theme ----
const THEME_KEY = "cwp_theme";
export function getTheme(): "dark" | "light" {
  return (localStorage.getItem(THEME_KEY) as "dark" | "light") || "dark";
}
export function setTheme(t: "dark" | "light"): void {
  localStorage.setItem(THEME_KEY, t);
  document.documentElement.classList.toggle("dark", t === "dark");
}

export function inRange(iso: string, from: string, to: string): boolean {
  const d = iso.slice(0, 10);
  return d >= from && d <= to;
}
export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function openShift(db: DB): Shift | undefined {
  return db.shifts.find((s) => !s.closedAt);
}
/** commission earned by a worker on an order: service commission, split equally if no pct; plus pct of total */
export function orderCommission(db: DB, o: Order): number {
  const w = db.workers.find((x) => x.id === o.workerId);
  if (!w) return 0;
  const fixed = o.items.reduce((a, it) => a + (db.services.find((s) => s.id === it.serviceId)?.commission ?? 0), 0);
  return fixed + Math.round((o.total * (w.commissionPct || 0)) / 100);
}

export const PRODUCT_CATS = ["زيوت محرك", "فلاتر", "قطع غيار", "إطارات وبطاريات", "مواد تنظيف", "إكسسوارات", "مواد استهلاكية"];
export const OIL_CATS = ["زيوت محرك", "فلاتر"];

// ---- automatic local backups (kept on this device, last 7) ----
const BK_KEY = "cwp_auto_backups";
export function listBackups(): { at: string; size: number }[] {
  try { return (JSON.parse(localStorage.getItem(BK_KEY) || "[]") as { at: string; data: string }[]).map((b) => ({ at: b.at, size: b.data.length })); } catch { return []; }
}
export function makeAutoBackup(db: DB): void {
  let arr: { at: string; data: string }[] = [];
  try { arr = JSON.parse(localStorage.getItem(BK_KEY) || "[]"); } catch { arr = []; }
  db.settings.lastBackupAt = new Date().toISOString();
  arr.unshift({ at: db.settings.lastBackupAt, data: JSON.stringify(db) });
  arr = arr.slice(0, 7);
  try { localStorage.setItem(BK_KEY, JSON.stringify(arr)); } catch { arr = arr.slice(0, 3); localStorage.setItem(BK_KEY, JSON.stringify(arr)); }
  saveDB(db);
}
export function restoreAutoBackup(at: string): boolean {
  const arr = JSON.parse(localStorage.getItem(BK_KEY) || "[]") as { at: string; data: string }[];
  const b = arr.find((x) => x.at === at);
  if (!b) return false;
  localStorage.setItem(KEY, b.data);
  return true;
}
/** daily backup on first open of the day */
export function autoBackupIfDue(): void {
  const db = getDB();
  if (db.settings.autoBackup === false) return;
  if (!db.settings.lastBackupAt || db.settings.lastBackupAt.slice(0, 10) !== new Date().toISOString().slice(0, 10)) makeAutoBackup(db);
}

// ---- offline license ----
const LIC_KEY = "cwp_license";
const MID_KEY = "cwp_machine_id";
const LIC_SALT = "CWP-OFFLINE-2026";
export function machineId(): string {
  let m = localStorage.getItem(MID_KEY);
  if (!m) {
    const raw = [navigator.userAgent, screen.width, screen.height, Intl.DateTimeFormat().resolvedOptions().timeZone, Math.random()].join("|");
    m = hashPassword(raw).slice(0, 12).toUpperCase();
    localStorage.setItem(MID_KEY, m);
  }
  return m;
}
export function expectedKey(mid: string): string {
  const h = hashPassword(LIC_SALT + mid).toUpperCase().padEnd(16, "0").slice(0, 16);
  return h.match(/.{4}/g)!.join("-");
}
export function getLicense(): { key: string; owner: string; at: string } | null {
  try { const l = JSON.parse(localStorage.getItem(LIC_KEY) || "null"); return l && l.key === expectedKey(machineId()) ? l : null; } catch { return null; }
}
export function activateLicense(key: string, owner: string): boolean {
  if (key.trim().toUpperCase() !== expectedKey(machineId())) return false;
  localStorage.setItem(LIC_KEY, JSON.stringify({ key: key.trim().toUpperCase(), owner, at: new Date().toISOString() }));
  return true;
}
const FIRST_KEY = "cwp_first_run";
export function trialDaysLeft(): number {
  let f = localStorage.getItem(FIRST_KEY);
  if (!f) { f = new Date().toISOString(); localStorage.setItem(FIRST_KEY, f); }
  return Math.max(0, 30 - Math.floor((Date.now() - new Date(f).getTime()) / 86400000));
}

// ---- role permissions (route access) ----
export const ROLE_LABEL: Record<Role, string> = { admin: "مدير النظام", manager: "مدير", cashier: "كاشير", supervisor: "مشرف", worker: "عامل" };
const ALL = "*";
export const ROLE_ROUTES: Record<Role, string[]> = {
  admin: [ALL],
  manager: ["/", "/sales", "/checkin", "/queue", "/pos", "/customers", "/vehicles", "/services", "/history", "/products", "/bookings", "/workers", "/shifts", "/expenses", "/inventory", "/packages", "/coupons", "/loyalty", "/reports", "/dayclose", "/system", "/settings"],
  cashier: ["/", "/sales", "/checkin", "/queue", "/pos", "/customers", "/vehicles", "/history", "/bookings", "/shifts", "/expenses", "/packages", "/loyalty", "/settings"],
  supervisor: ["/", "/checkin", "/queue", "/customers", "/vehicles", "/history", "/bookings", "/workers", "/inventory", "/products", "/settings"],
  worker: ["/", "/queue", "/settings"],
};
export function canAccess(role: Role | undefined, path: string): boolean {
  if (!role) return false;
  const r = ROLE_ROUTES[role];
  return r.includes(ALL) || r.includes(path);
}
