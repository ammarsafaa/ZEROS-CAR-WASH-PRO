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
  workerId?: string;
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
}

export interface Settings {
  businessName: string;
  phone: string;
  address: string;
  currency: string;
  taxEnabled: boolean;
  taxRate: number;
}

export interface AuditEntry {
  at: string;
  user: string;
  action: string;
  details: string;
}

export interface DB {
  users: User[];
  customers: Customer[];
  vehicles: Vehicle[];
  services: Service[];
  orders: Order[];
  invoices: Invoice[];
  settings: Settings;
  counters: Record<string, number>;
  audit: AuditEntry[];
}

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

function seed(): DB {
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
      businessName: "CAR WASH PRO",
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
    if (raw) return JSON.parse(raw) as DB;
  } catch {
    /* corrupted -> reseed */
  }
  const db = seed();
  localStorage.setItem(KEY, JSON.stringify(db));
  return db;
}

export function saveDB(db: DB): void {
  localStorage.setItem(KEY, JSON.stringify(db));
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
