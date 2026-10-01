import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { requireAuth } from "./index";
import { logAudit, saveDB, fmt, getSession } from "@/lib/db";
import { useDB, Field, Table, Stat, inputCls, btnPrimary, btnGhost, td } from "@/components/kit";

export const Route = createFileRoute("/loyalty")({
  beforeLoad: () => requireAuth(),
  head: () => ({ meta: [{ title: "برنامج الولاء — ZEROS CAR WASH PRO" }, { name: "description", content: "نقاط الولاء للعملاء وإعدادات الاستبدال" }] }),
  component: LoyaltyPage,
});

function LoyaltyPage() {
  const [db, refresh, user] = useDB();
  const isMgr = ["admin", "manager"].includes(getSession()?.role ?? "");
  const [s, setS] = useState({ pointsPer1000: db.settings.pointsPer1000 ?? 1, pointValue: db.settings.pointValue ?? 100, oilIntervalKm: db.settings.oilIntervalKm ?? 5000 });
  const rows = [...db.customers].sort((a, b) => b.points - a.points);
  const tier = (p: number) => (p >= 500 ? "ذهبي" : p >= 150 ? "فضي" : "برونزي");

  return (
    <AppLayout title="برنامج الولاء">
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Stat label="إجمالي النقاط القائمة" value={fmt(rows.reduce((a, c) => a + c.points, 0))} />
        <Stat label="قيمتها" value={fmt(rows.reduce((a, c) => a + c.points, 0) * s.pointValue)} tone="good" />
        <Stat label="عملاء ذهبيون (500+)" value={rows.filter((c) => c.points >= 500).length} />
      </div>
      <div className="mb-5 grid max-w-3xl gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-4">
        <Field label="نقاط لكل 1000 دينار"><input type="number" min={0} step="0.5" disabled={!isMgr} className={inputCls} value={s.pointsPer1000} onChange={(e) => setS({ ...s, pointsPer1000: +e.target.value })} /></Field>
        <Field label="قيمة النقطة عند الاستبدال"><input type="number" min={0} disabled={!isMgr} className={inputCls} value={s.pointValue} onChange={(e) => setS({ ...s, pointValue: +e.target.value })} /></Field>
        <Field label="فترة تبديل الزيت (كم)"><input type="number" min={500} disabled={!isMgr} className={inputCls} value={s.oilIntervalKm} onChange={(e) => setS({ ...s, oilIntervalKm: +e.target.value })} /></Field>
        <div className="flex items-end"><button disabled={!isMgr} className={btnPrimary} onClick={() => { Object.assign(db.settings, s); logAudit(db, user, "LOYALTY_SETTINGS", JSON.stringify(s)); saveDB(db); refresh(); alert("تم الحفظ"); }}>حفظ</button></div>
      </div>
      <Table head={["العميل", "الهاتف", "الفئة", "النقاط", "القيمة", "رصيد آجل", ""]} empty={!rows.length}>
        {rows.map((c) => (
          <tr key={c.id}>
            <td className={td + " font-bold"}>{c.name}</td>
            <td className={td} dir="ltr">{c.phone}</td>
            <td className={td}><span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-bold text-primary">{tier(c.points)}</span></td>
            <td className={td + " font-bold"}>{c.points}</td>
            <td className={td}>{fmt(c.points * s.pointValue)}</td>
            <td className={td + (c.balance > 0 ? " text-destructive" : "")}>{fmt(c.balance)}</td>
            <td className={td}><div className="flex gap-1">
              {isMgr && <button className={btnGhost} onClick={() => { const n = Number(prompt(`تعديل نقاط ${c.name} (+/-):`)); if (!n) return; c.points = Math.max(0, c.points + n); logAudit(db, user, "POINTS_ADJUST", `${c.name} ${n}`); saveDB(db); refresh(); }}>تعديل النقاط</button>}
              {c.balance > 0 && <button className={btnGhost} onClick={() => {
                if (!db.shifts.some((x) => !x.closedAt)) return alert("افتح وردية أولاً");
                const n = Number(prompt(`تحصيل دين ${c.name} (المستحق ${fmt(c.balance)}):`)); if (!n || n <= 0) return;
                const amt = Math.min(n, c.balance); c.balance -= amt;
                db.invoices.push({ id: crypto.randomUUID(), code: `PAY-${Date.now()}`, orderId: "", subtotal: 0, discount: 0, tax: 0, total: 0, method: "Cash", cashier: user, createdAt: new Date().toISOString(), customerId: c.id, paid: amt });
                logAudit(db, user, "COLLECT_DEBT", `${c.name} ${amt}`); saveDB(db); refresh();
              }}>تحصيل دين</button>}
            </div></td>
          </tr>
        ))}
      </Table>
    </AppLayout>
  );
}
