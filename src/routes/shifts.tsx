import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { requireAuth } from "./index";
import { newId, nextCode, logAudit, saveDB, fmt, openShift, type DB, type Shift } from "@/lib/db";
import { useDB, Field, Table, Stat, inputCls, btnPrimary, td } from "@/components/kit";

export const Route = createFileRoute("/shifts")({
  beforeLoad: () => requireAuth(),
  head: () => ({ meta: [{ title: "الورديات والصندوق — CAR WASH PRO" }, { name: "description", content: "فتح وإغلاق الورديات وجرد الصندوق" }] }),
  component: ShiftsPage,
});

function shiftTotals(db: DB, s: Shift) {
  const end = s.closedAt ?? new Date(Date.now() + 1000).toISOString();
  const inv = db.invoices.filter((i) => !i.voided && i.createdAt >= s.openedAt && i.createdAt <= end);
  const by = (m: string) => inv.filter((i) => i.method === m).reduce((a, i) => a + i.total, 0);
  const exp = db.expenses.filter((e) => e.method === "cash" && e.date >= s.openedAt && e.date <= end).reduce((a, e) => a + e.amount, 0);
  const cash = by("cash");
  return { count: inv.length, cash, card: by("card"), credit: by("credit"), other: by("other"), exp, expected: s.openingCash + cash - exp };
}

function ShiftsPage() {
  const [db, refresh, user] = useDB();
  const cur = openShift(db);
  const [opening, setOpening] = useState(0);
  const [counted, setCounted] = useState(0);
  const [notes, setNotes] = useState("");

  const start = () => {
    db.shifts.unshift({ id: newId(), code: nextCode(db, "SH", true), user, openedAt: new Date().toISOString(), openingCash: opening });
    logAudit(db, user, "OPEN_SHIFT", `افتتاحي ${opening}`); saveDB(db); refresh();
  };
  const close = () => {
    if (!cur) return;
    const t = shiftTotals(db, cur);
    if (!confirm(`إغلاق الوردية؟ الفرق: ${fmt(counted - t.expected)}`)) return;
    Object.assign(cur, { closedAt: new Date().toISOString(), countedCash: counted, expectedCash: t.expected, notes });
    logAudit(db, user, "CLOSE_SHIFT", `${cur.code} فرق ${counted - t.expected}`); saveDB(db); setCounted(0); setNotes(""); refresh();
  };

  const t = cur && shiftTotals(db, cur);

  return (
    <AppLayout title="الورديات والصندوق">
      {!cur ? (
        <div className="mb-6 max-w-md space-y-3 rounded-xl border border-border bg-card p-5">
          <h2 className="font-bold">لا توجد وردية مفتوحة</h2>
          <Field label="المبلغ الافتتاحي في الصندوق"><input type="number" min={0} className={inputCls} value={opening} onChange={(e) => setOpening(+e.target.value)} /></Field>
          <button className={btnPrimary} onClick={start}>فتح وردية</button>
        </div>
      ) : (
        <div className="mb-6 space-y-4 rounded-xl border border-primary/40 bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold">الوردية الحالية <span className="font-mono text-sm" dir="ltr">{cur.code}</span></h2>
            <span className="text-sm text-muted-foreground">{cur.user} • منذ {new Date(cur.openedAt).toLocaleString("ar-IQ")}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="افتتاحي" value={fmt(cur.openingCash)} />
            <Stat label="نقدي" value={fmt(t!.cash)} tone="good" />
            <Stat label="بطاقة" value={fmt(t!.card)} />
            <Stat label="آجل" value={fmt(t!.credit)} />
            <Stat label="مصروفات نقدية" value={fmt(t!.exp)} tone="bad" />
            <Stat label="المتوقع بالصندوق" value={fmt(t!.expected)} tone="good" />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="النقد الفعلي (الجرد)"><input type="number" min={0} className={inputCls} value={counted} onChange={(e) => setCounted(+e.target.value)} /></Field>
            <Field label="ملاحظات"><input className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
            <div className="flex items-end gap-3">
              <span className={`text-sm font-bold ${counted - t!.expected < 0 ? "text-destructive" : "text-primary"}`}>الفرق: {fmt(counted - t!.expected)}</span>
              <button className={btnPrimary} onClick={close}>إغلاق الوردية</button>
            </div>
          </div>
        </div>
      )}
      <h3 className="mb-2 font-bold">سجل الورديات</h3>
      <Table head={["الرمز", "المستخدم", "الفتح", "الإغلاق", "افتتاحي", "المتوقع", "الفعلي", "الفرق"]} empty={!db.shifts.length}>
        {db.shifts.map((s) => (
          <tr key={s.id}>
            <td className={td + " font-mono text-xs"} dir="ltr">{s.code}</td>
            <td className={td}>{s.user}</td>
            <td className={td + " text-xs"}>{new Date(s.openedAt).toLocaleString("ar-IQ")}</td>
            <td className={td + " text-xs"}>{s.closedAt ? new Date(s.closedAt).toLocaleString("ar-IQ") : <span className="text-primary">مفتوحة</span>}</td>
            <td className={td}>{fmt(s.openingCash)}</td>
            <td className={td}>{s.expectedCash != null ? fmt(s.expectedCash) : "—"}</td>
            <td className={td}>{s.countedCash != null ? fmt(s.countedCash) : "—"}</td>
            <td className={td + " font-bold"}>{s.countedCash != null ? fmt(s.countedCash - (s.expectedCash ?? 0)) : "—"}</td>
          </tr>
        ))}
      </Table>
    </AppLayout>
  );
}
