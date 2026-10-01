import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { requireAuth } from "./index";
import { newId, logAudit, saveDB, fmt, todayStr } from "@/lib/db";
import { useDB, Modal, Field, Table, inputCls, btnPrimary, btnGhost, btnDanger, td } from "@/components/kit";

export const Route = createFileRoute("/coupons")({
  beforeLoad: () => requireAuth(),
  head: () => ({ meta: [{ title: "الكوبونات — ZEROS CAR WASH PRO" }, { name: "description", content: "إنشاء كوبونات الخصم ومتابعة استخدامها" }] }),
  component: CouponsPage,
});

function CouponsPage() {
  const [db, refresh, user] = useDB();
  const [f, setF] = useState<{ code: string; type: "pct" | "amount"; value: number; minTotal: number; maxUses: number; expiresAt: string } | null>(null);
  const save = () => {
    const code = f!.code.trim().toUpperCase();
    if (db.coupons.some((c) => c.code === code)) return alert("الرمز موجود مسبقاً");
    if (f!.type === "pct" && f!.value > 100) return alert("النسبة لا تتجاوز 100%");
    db.coupons.unshift({ id: newId(), ...f!, code, used: 0, active: true });
    logAudit(db, user, "ADD_COUPON", code); saveDB(db); setF(null); refresh();
  };
  const gen = () => "CW" + Math.random().toString(36).slice(2, 8).toUpperCase();

  return (
    <AppLayout title="الكوبونات">
      <div className="mb-3 flex justify-end"><button className={btnPrimary} onClick={() => setF({ code: gen(), type: "pct", value: 10, minTotal: 0, maxUses: 100, expiresAt: todayStr() })}><Plus className="h-4 w-4" /> كوبون جديد</button></div>
      <Table head={["الرمز", "الخصم", "حد أدنى", "الاستخدام", "ينتهي", "الحالة", ""]} empty={!db.coupons.length}>
        {db.coupons.map((c) => {
          const expired = c.expiresAt < todayStr() || c.used >= c.maxUses;
          return (
            <tr key={c.id} className={c.active && !expired ? "" : "opacity-50"}>
              <td className={td + " font-mono font-bold"} dir="ltr">{c.code}</td>
              <td className={td + " font-bold text-primary"}>{c.type === "pct" ? `${c.value}%` : fmt(c.value)}</td>
              <td className={td}>{fmt(c.minTotal)}</td>
              <td className={td}>{c.used} / {c.maxUses}</td>
              <td className={td}>{c.expiresAt}</td>
              <td className={td}>{expired ? "منتهي" : c.active ? "فعّال" : "موقوف"}</td>
              <td className={td}><div className="flex gap-1">
                <button className={btnGhost} onClick={() => { c.active = !c.active; saveDB(db); refresh(); }}>{c.active ? "إيقاف" : "تفعيل"}</button>
                {c.used === 0 && <button className={btnDanger} onClick={() => { db.coupons = db.coupons.filter((x) => x.id !== c.id); saveDB(db); refresh(); }}><Trash2 className="h-3.5 w-3.5" /></button>}
              </div></td>
            </tr>
          );
        })}
      </Table>
      {f && (
        <Modal title="كوبون جديد" onClose={() => setF(null)} onSubmit={save}>
          <Field label="رمز الكوبون"><input required dir="ltr" className={inputCls} value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="نوع الخصم"><select className={inputCls} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as "pct" | "amount" })}><option value="pct">نسبة %</option><option value="amount">مبلغ ثابت</option></select></Field>
            <Field label="القيمة"><input type="number" min={1} required className={inputCls} value={f.value} onChange={(e) => setF({ ...f, value: +e.target.value })} /></Field>
            <Field label="الحد الأدنى للفاتورة"><input type="number" min={0} className={inputCls} value={f.minTotal} onChange={(e) => setF({ ...f, minTotal: +e.target.value })} /></Field>
            <Field label="أقصى عدد استخدام"><input type="number" min={1} className={inputCls} value={f.maxUses} onChange={(e) => setF({ ...f, maxUses: +e.target.value })} /></Field>
          </div>
          <Field label="تاريخ الانتهاء"><input type="date" required className={inputCls} value={f.expiresAt} onChange={(e) => setF({ ...f, expiresAt: e.target.value })} /></Field>
        </Modal>
      )}
    </AppLayout>
  );
}
