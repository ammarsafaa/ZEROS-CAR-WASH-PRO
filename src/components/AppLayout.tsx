import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  Car,
  Sparkles,
  LogIn as CheckInIcon,
  ListOrdered,
  Receipt,
  Settings as SettingsIcon,
  LogOut,
  Moon,
  Sun,
  Languages,
  CarFront,
  HardHat,
  Wallet,
  TrendingDown,
  Boxes,
  Ticket,
  CalendarClock,
  BarChart3,
  ShoppingCart,
  Droplets,
  TicketPercent,
  Star,
  History,
  CalendarCheck,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import {
  getLang,
  setLang,
  getTheme,
  setTheme,
  getSession,
  logout,
  autoBackupIfDue,
  getLicense,
  trialDaysLeft,
  type Lang,
} from "@/lib/db";

const NAV = [
  { to: "/", ar: "لوحة التحكم", en: "Dashboard", icon: LayoutDashboard },
  { to: "/sales", ar: "شاشة المبيعات", en: "Sales POS", icon: ShoppingCart },
  { to: "/checkin", ar: "استقبال سيارة", en: "Check-In", icon: CheckInIcon },
  { to: "/queue", ar: "طابور السيارات", en: "Queue", icon: ListOrdered },
  { to: "/pos", ar: "الكاشير والفواتير", en: "Cashier / POS", icon: Receipt },
  { to: "/customers", ar: "العملاء", en: "Customers", icon: Users },
  { to: "/vehicles", ar: "السيارات", en: "Vehicles", icon: Car },
  { to: "/services", ar: "الخدمات", en: "Services", icon: Sparkles },
  { to: "/history", ar: "سجل السيارات", en: "Vehicle History", icon: History },
  { to: "/products", ar: "الزيوت وقطع الغيار", en: "Oils & Parts", icon: Droplets },
  { to: "/bookings", ar: "الحجوزات", en: "Bookings", icon: CalendarClock },
  { to: "/workers", ar: "العمال والعمولات", en: "Workers", icon: HardHat },
  { to: "/shifts", ar: "الورديات والصندوق", en: "Shifts & Cash", icon: Wallet },
  { to: "/expenses", ar: "المصروفات", en: "Expenses", icon: TrendingDown },
  { to: "/inventory", ar: "المخزون والمشتريات", en: "Inventory", icon: Boxes },
  { to: "/packages", ar: "الاشتراكات والباقات", en: "Packages", icon: Ticket },
  { to: "/coupons", ar: "الكوبونات", en: "Coupons", icon: TicketPercent },
  { to: "/loyalty", ar: "برنامج الولاء", en: "Loyalty", icon: Star },
  { to: "/reports", ar: "التقارير", en: "Reports", icon: BarChart3 },
  { to: "/dayclose", ar: "إغلاق اليوم", en: "Day Close", icon: CalendarCheck },
  { to: "/system", ar: "النسخ والترخيص", en: "Backup & License", icon: ShieldCheck },
  { to: "/settings", ar: "الإعدادات", en: "Settings", icon: SettingsIcon },
] as const;

export function useLang(): [Lang, () => void] {
  const [lang, setL] = useState<Lang>("ar");
  useEffect(() => {
    const l = getLang();
    setL(l);
    setLang(l);
  }, []);
  const toggle = () => {
    const next = lang === "ar" ? "en" : "ar";
    setLang(next);
    setL(next);
  };
  return [lang, toggle];
}

export function AppLayout({ children, title }: { children: ReactNode; title: string }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [lang, toggleLang] = useLang();
  const [theme, setT] = useState<"dark" | "light">("dark");
  const session = getSession();

  useEffect(() => {
    autoBackupIfDue();
    if (!getLicense() && trialDaysLeft() <= 0 && pathname !== "/system") navigate({ to: "/system" });
  }, [pathname, navigate]);

  useEffect(() => {
    const t = getTheme();
    setT(t);
    setTheme(t);
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    setT(next);
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 start-0 z-40 flex w-60 flex-col bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <CarFront className="h-6 w-6" />
          </div>
          <div>
            <div className="text-sm font-bold leading-tight">CAR WASH PRO</div>
            <div className="text-xs opacity-60">
              {lang === "ar" ? "نظام إدارة المغسلة" : "Car Wash Manager"}
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV.map((item) => {
            const active = pathname === item.to;
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-sidebar-border/50"
                }`}
              >
                <Icon className="h-4.5 w-4.5 shrink-0" />
                {lang === "ar" ? item.ar : item.en}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="mb-2 rounded-lg bg-sidebar-border/40 px-3 py-2 text-xs">
            <div className="font-semibold">{session?.name}</div>
            <div className="opacity-60">{session?.role}</div>
          </div>
          <button
            onClick={() => {
              logout();
              navigate({ to: "/login" });
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive-foreground/90 hover:bg-destructive/20"
          >
            <LogOut className="h-4 w-4" />
            {lang === "ar" ? "تسجيل الخروج" : "Logout"}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="ms-60 flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-card/80 px-6 py-3 backdrop-blur">
          <h1 className="text-lg font-bold">{title}</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleLang}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted"
            >
              <Languages className="h-4 w-4" />
              {lang === "ar" ? "EN" : "عربي"}
            </button>
            <button
              onClick={toggleTheme}
              className="rounded-lg border border-border p-2 hover:bg-muted"
              aria-label="theme"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
