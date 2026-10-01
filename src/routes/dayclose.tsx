import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { requireAuth } from "./index";
import { newId, logAudit, saveDB, fmt, todayStr, inRange, makeAutoBackup, getSession } from "@/lib/db";
import { useDB, Table, Stat, btnPrimary, btnGhost, td } from "@/components/kit";

export const Route = createFileRoute("/dayclose")({
  beforeLoad: () => requireAuth(),
  head: () => ({ meta: [{ title: "إغلاق اليوم — ZEROS CAR WASH PRO" }, { name: "description", content: "ملخص وإغلاق اليوم مع نسخة احتياطية" }] }),
  component: DayClosePage,
});

function DayClosePage() {
  const [db, refresh, user] = useDB();
  const today = todayStr();
  const isMgr = ["admin", "manager"].includes(getSession()?.role ?? "");
  const inv = db.invoices.filter((i) => !i.voided && i.total > 0 && inRange(i.createdAt, today, today));
  const sales = inv.reduce((a, i) => a + i.total, 0);
  const cash = inv.filter((i) => i.method.toLowerCase() === "cash").reduce((a, i) => a + i.total, 0);
  const exp = db.expenses.filter((e) => inRange(e.date, today, today)).reduce((a, e) => a + e.amount, 0);
  const pending = db.orders.filter((o) => !["DELIVERED", "CANCELLED"].includes(o.status));
  const openShifts = db.shifts.filter((s) => !s.closedAt);
  const closed = db.dayCloses.find((d) => d.date === today);
  const lowStock = db.items.filter((i) => i.qty <= i.minQty);

  const close = () => {
    if (openShifts.length) return alert("أغلق جميع الورديات المفتوحة أولاً");
    if (pending.length && !confirm(`يوجد ${pending.length} سيارة لم تُسلّم بعد. متابعة الإغلاق؟`)) return;
    db.dayCloses.unshift({ id: newId(), date: today, user, sales, invoices: inv.length, expenses: exp, cash, at: new Date().toISOString() });
    logAudit(db, user, "DAY_CLOSE", `${today} مبيعات ${sales}`);
    makeAutoBackup(db);
    refresh();
    alert("تم إغلاق اليوم وأُخذت نسخة احتياطية تلقائية.");
  };

  return (
    <AppLayout title="إغلاق اليوم">
      <div className="mb-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="مبيعات اليوم" value={fmt(sales)} tone="good" />
        <Stat label="عدد الفواتير" value={inv.length} />
        <Stat label="النقدي" value={fmt(cash)} />
        <Stat label="المصروفات" value={fmt(exp)} tone="bad" />
        <Stat label="الصافي" value={fmt(sales - exp)} tone="good" />
        <Stat label="سيارات غير مسلّمة" value={pending.length} tone={pending.length ? "bad" : undefined} />
      </div>
      <div className="mb-5 space-y-2 rounded-xl border border-border bg-card p-4 text-sm">
        <div className={openShifts.length ? "text-destructive" : "text-primary"}>{openShifts.length ? `● ورديات مفتوحة: ${openShifts.length} — يجب إغلاقها` : "● كل الورديات مغلقة"}</div>
        <div className={lowStock.length ? "text-destructive" : "text-primary"}>{lowStock.length ? `● مواد ناقصة: ${lowStock.map((i) => i.name).join("، ")}` : "● المخزون سليم"}</div>
        <div className="flex gap-2 pt-2">
          {closed ? <span className="font-bold text-primary">تم إغلاق هذا اليوم بواسطة {closed.user}</span> : <button disabled={!isMgr} className={btnPrimary} onClick={close}>إغلاق اليوم</button>}
          <button className={btnGhost} onClick={() => window.print()}>طباعة الملخص</button>
        </div>
        {!isMgr && <div className="text-xs text-muted-foreground">إغلاق اليوم للمدير فقط.</div>}
      </div>
      <h3 className="mb-2 font-bold">الأيام المغلقة</h3>
      <Table head={["التاريخ", "المبيعات", "الفواتير", "النقدي", "المصروفات", "بواسطة"]} empty={!db.dayCloses.length}>
        {db.dayCloses.map((d) => <tr key={d.id}><td className={td + " font-mono"}>{d.date}</td><td className={td + " font-bold"}>{fmt(d.sales)}</td><td className={td}>{d.invoices}</td><td className={td}>{fmt(d.cash)}</td><td className={td}>{fmt(d.expenses)}</td><td className={td}>{d.user}</td></tr>)}
      </Table>
    </AppLayout>
  );
}
