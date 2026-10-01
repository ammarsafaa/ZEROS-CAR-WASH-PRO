import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { requireAuth } from "./index";
import { fmt, inRange, todayStr, orderCommission } from "@/lib/db";
import { useDB, Table, DateRange, Stat, btnGhost, td } from "@/components/kit";

export const Route = createFileRoute("/reports")({
  beforeLoad: () => requireAuth(),
  head: () => ({ meta: [{ title: "التقارير — CAR WASH PRO" }, { name: "description", content: "تقارير المبيعات والمصروفات والأرباح" }] }),
  component: ReportsPage,
});

const M: Record<string, string> = { cash: "نقدي", card: "بطاقة", credit: "آجل", other: "أخرى" };

function ReportsPage() {
  const [db] = useDB();
  const [from, setFrom] = useState(todayStr());
  const [to, setTo] = useState(todayStr());
  const preset = (days: number) => { const d = new Date(Date.now() - days * 86400000); setFrom(d.toISOString().slice(0, 10)); setTo(todayStr()); };

  const inv = db.invoices.filter((i) => !i.voided && inRange(i.createdAt, from, to));
  const voided = db.invoices.filter((i) => i.voided && inRange(i.createdAt, from, to));
  const sales = inv.reduce((a, i) => a + i.total, 0);
  const discount = inv.reduce((a, i) => a + i.discount, 0);
  const tax = inv.reduce((a, i) => a + i.tax, 0);
  const exp = db.expenses.filter((e) => inRange(e.date, from, to)).reduce((a, e) => a + e.amount, 0);
  const orders = db.orders.filter((o) => o.status === "DELIVERED" && inRange(o.createdAt, from, to));
  const comm = orders.reduce((a, o) => a + orderCommission(db, o), 0);
  const purchases = db.purchases.filter((p) => inRange(p.date, from, to)).reduce((a, p) => a + p.total, 0);
  const net = sales - tax - exp - comm;

  const svc = new Map<string, { n: number; v: number }>();
  orders.forEach((o) => o.items.forEach((it) => { const r = svc.get(it.name) ?? { n: 0, v: 0 }; r.n++; r.v += it.price; svc.set(it.name, r); }));
  const byDay = new Map<string, number>();
  inv.forEach((i) => byDay.set(i.createdAt.slice(0, 10), (byDay.get(i.createdAt.slice(0, 10)) ?? 0) + i.total));
  const maxDay = Math.max(1, ...byDay.values());

  return (
    <AppLayout title="التقارير">
      <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
        <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} />
        <button className={btnGhost} onClick={() => preset(0)}>اليوم</button>
        <button className={btnGhost} onClick={() => preset(6)}>7 أيام</button>
        <button className={btnGhost} onClick={() => preset(29)}>30 يوم</button>
        <div className="flex-1" />
        <button className={btnGhost} onClick={() => window.print()}>طباعة التقرير</button>
      </div>
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="صافي المبيعات" value={fmt(sales)} tone="good" />
        <Stat label="عدد الفواتير" value={inv.length} />
        <Stat label="السيارات المسلّمة" value={orders.length} />
        <Stat label="متوسط الفاتورة" value={fmt(inv.length ? Math.round(sales / inv.length) : 0)} />
        <Stat label="الخصومات" value={fmt(discount)} />
        <Stat label="الضريبة" value={fmt(tax)} />
        <Stat label="المصروفات" value={fmt(exp)} tone="bad" />
        <Stat label="العمولات" value={fmt(comm)} tone="bad" />
        <Stat label="المشتريات" value={fmt(purchases)} />
        <Stat label="فواتير ملغاة" value={`${voided.length} (${fmt(voided.reduce((a, i) => a + i.total, 0))})`} />
        <Stat label="صافي الربح التقديري" value={fmt(net)} tone={net >= 0 ? "good" : "bad"} />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 font-bold">المبيعات حسب طريقة الدفع</h3>
          <Table head={["الطريقة", "العدد", "المبلغ"]} empty={!inv.length}>
            {Object.keys(M).map((m) => { const r = inv.filter((i) => i.method === m); return r.length ? <tr key={m}><td className={td}>{M[m]}</td><td className={td}>{r.length}</td><td className={td + " font-bold"}>{fmt(r.reduce((a, i) => a + i.total, 0))}</td></tr> : null; })}
          </Table>
        </div>
        <div>
          <h3 className="mb-2 font-bold">الخدمات</h3>
          <Table head={["الخدمة", "العدد", "القيمة"]} empty={!svc.size}>
            {[...svc.entries()].sort((a, b) => b[1].v - a[1].v).map(([k, r]) => <tr key={k}><td className={td}>{k}</td><td className={td}>{r.n}</td><td className={td + " font-bold"}>{fmt(r.v)}</td></tr>)}
          </Table>
        </div>
        <div className="lg:col-span-2">
          <h3 className="mb-2 font-bold">المبيعات اليومية</h3>
          <div className="space-y-1.5 rounded-xl border border-border bg-card p-4">
            {[...byDay.entries()].sort().map(([d, v]) => (
              <div key={d} className="flex items-center gap-3 text-sm">
                <span className="w-24 font-mono text-xs" dir="ltr">{d}</span>
                <div className="h-5 flex-1 rounded bg-muted"><div className="h-5 rounded bg-primary" style={{ width: `${(v / maxDay) * 100}%` }} /></div>
                <span className="w-28 text-end font-bold">{fmt(v)}</span>
              </div>
            ))}
            {!byDay.size && <div className="text-center text-sm text-muted-foreground">لا توجد مبيعات في هذه الفترة</div>}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
