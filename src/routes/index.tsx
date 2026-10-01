import { createFileRoute, redirect } from "@tanstack/react-router";
import { getSession } from "@/lib/db";

// Client-side auth guard: redirect to /login when no offline session exists.
export function requireAuth() {
  if (typeof window !== "undefined" && !getSession()) {
    throw redirect({ to: "/login" });
  }
}

export const Route = createFileRoute("/")({
  beforeLoad: () => requireAuth(),
  head: () => ({
    meta: [
      { title: "لوحة التحكم — CAR WASH PRO" },
      { name: "description", content: "لوحة تحكم نظام إدارة مغسلة السيارات: مبيعات اليوم، الطابور، والإحصائيات" },
      { property: "og:title", content: "CAR WASH PRO — لوحة التحكم" },
      { property: "og:description", content: "نظام إدارة مغسلة سيارات يعمل بدون إنترنت" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

import { Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import {
  Banknote,
  Car,
  Clock,
  Droplets,
  CheckCircle2,
  Users,
  PlusCircle,
  Receipt,
  ListOrdered,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { getDB, fmt, isToday } from "@/lib/db";

function Dashboard() {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const db = useMemo(() => getDB(), []);

  const todayOrders = db.orders.filter((o) => isToday(o.createdAt) && o.status !== "CANCELLED");
  const todayInvoices = db.invoices.filter((i) => isToday(i.createdAt) && !i.voided);
  const todaySales = todayInvoices.reduce((s, i) => s + i.total, 0);
  const waiting = db.orders.filter((o) => o.status === "WAITING").length;
  const inWash = db.orders.filter((o) => o.status === "IN_WASH" || o.status === "DETAILING").length;
  const ready = db.orders.filter((o) => o.status === "READY").length;

  const byMethod = ["Cash", "Card", "Credit", "Other"].map((m) => ({
    m,
    v: todayInvoices.filter((i) => i.method === m).reduce((s, i) => s + i.total, 0),
  }));
  const maxMethod = Math.max(1, ...byMethod.map((x) => x.v));

  const serviceCount = new Map<string, number>();
  todayOrders.forEach((o) =>
    o.items.forEach((it) => serviceCount.set(it.name, (serviceCount.get(it.name) ?? 0) + 1)),
  );
  const topServices = [...serviceCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxSvc = Math.max(1, ...topServices.map(([, c]) => c));

  const cards = [
    { label: "مبيعات اليوم", value: `${fmt(todaySales)} ${db.settings.currency}`, icon: Banknote, color: "text-primary" },
    { label: "سيارات اليوم", value: todayOrders.length, icon: Car, color: "text-info" },
    { label: "قيد الانتظار", value: waiting, icon: Clock, color: "text-warning" },
    { label: "قيد الغسيل", value: inWash, icon: Droplets, color: "text-info" },
    { label: "جاهزة للتسليم", value: ready, icon: CheckCircle2, color: "text-success" },
    { label: "عدد العملاء", value: db.customers.length, icon: Users, color: "text-foreground" },
  ];

  return (
    <AppLayout title="لوحة التحكم">
      {/* Quick actions */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Link to="/checkin" className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-sm font-bold text-primary-foreground shadow-sm transition-opacity hover:opacity-90">
          <PlusCircle className="h-5 w-5" /> استقبال سيارة جديدة
        </Link>
        <Link to="/queue" className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3.5 text-sm font-bold hover:bg-muted">
          <ListOrdered className="h-5 w-5" /> الطابور
        </Link>
        <Link to="/pos" className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3.5 text-sm font-bold hover:bg-muted">
          <Receipt className="h-5 w-5" /> فاتورة / دفع
        </Link>
        <Link to="/customers" className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3.5 text-sm font-bold hover:bg-muted">
          <Users className="h-5 w-5" /> عميل جديد
        </Link>
      </div>

      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="rounded-xl border border-border bg-card p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{c.label}</span>
                <Icon className={`h-4 w-4 ${c.color}`} />
              </div>
              <div className="text-xl font-bold">{c.value}</div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Sales by method */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 text-sm font-bold">مبيعات اليوم حسب طريقة الدفع</h2>
          <div className="space-y-3">
            {byMethod.map((x) => (
              <div key={x.m}>
                <div className="mb-1 flex justify-between text-xs">
                  <span>{x.m}</span>
                  <span className="font-semibold">{fmt(x.v)}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(x.v / maxMethod) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top services */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 text-sm font-bold">الخدمات الأكثر طلباً اليوم</h2>
          {topServices.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">لا توجد طلبات اليوم بعد</p>
          ) : (
            <div className="space-y-3">
              {topServices.map(([name, count]) => (
                <div key={name}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span>{name}</span>
                    <span className="font-semibold">{count}</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-info" style={{ width: `${(count / maxSvc) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
