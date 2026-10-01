import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { requireAuth } from "./index";
import { newId, nextCode, logAudit, saveDB, fmt, inRange, todayStr, getSession } from "@/lib/db";
import { useDB, Modal, Field, Table, DateRange, Stat, inputCls, btnPrimary, btnDanger, td } from "@/components/kit";

export const Route = createFileRoute("/expenses")({
  beforeLoad: () => requireAuth(),
  head: () => ({ meta: [{ title: "المصروفات — CAR WASH PRO" }, { name: "description", content: "تسجيل ومتابعة مصروفات المغسلة" }] }),
  component: ExpensesPage,
});

const CATS = ["إيجار", "كهرباء", "ماء", "رواتب", "صيانة", "مواد", "وقود", "نثرية", "أخرى"];
const METHODS: Record<string, string> = { cash: "نقدي من الصندوق", bank: "تحويل/بنك" };

function ExpensesPage() {
  const [db, refresh, user] = useDB();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ category: "نثرية", amount: 0, method: "cash", note: "" });
  const [from, setFrom] = useState(todayStr().slice(0, 8) + "01");
  const [to, setTo] = useState(todayStr());
  const canDelete = ["admin", "manager"].includes(getSession()?.role ?? "");

  const rows = db.expenses.filter((e) => inRange(e.date, from, to));
  const save = () => {
    if (form.amount <= 0) return alert("أدخل مبلغاً صحيحاً");
    db.expenses.unshift({ id: newId(), code: nextCode(db, "EXP", true), ...form, date: new Date().toISOString(), user });
    logAudit(db, user, "ADD_EXPENSE", `${form.category} ${form.amount}`); saveDB(db); setOpen(false); refresh();
  };

  return (
    <AppLayout title="المصروفات">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} />
        <button className={btnPrimary} onClick={() => { setForm({ category: "نثرية", amount: 0, method: "cash", note: "" }); setOpen(true); }}><Plus className="h-4 w-4" /> مصروف جديد</button>
      </div>
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <Stat label="إجمالي المصروفات" value={fmt(rows.reduce((a, e) => a + e.amount, 0))} tone="bad" />
        {CATS.map((c) => ({ c, v: rows.filter((e) => e.category === c).reduce((a, e) => a + e.amount, 0) })).filter((x) => x.v).sort((a, b) => b.v - a.v).slice(0, 3).map((x) => <Stat key={x.c} label={x.c} value={fmt(x.v)} />)}
      </div>
      <Table head={["الرمز", "التاريخ", "التصنيف", "المبلغ", "الدفع", "ملاحظة", "المستخدم", ""]} empty={!rows.length}>
        {rows.map((e) => (
          <tr key={e.id}>
            <td className={td + " font-mono text-xs"} dir="ltr">{e.code}</td>
            <td className={td + " text-xs"}>{new Date(e.date).toLocaleString("ar-IQ")}</td>
            <td className={td}>{e.category}</td>
            <td className={td + " font-bold text-destructive"}>{fmt(e.amount)}</td>
            <td className={td}>{METHODS[e.method]}</td>
            <td className={td}>{e.note}</td>
            <td className={td}>{e.user}</td>
            <td className={td}>{canDelete && <button className={btnDanger} onClick={() => { if (!confirm("حذف المصروف؟")) return; db.expenses = db.expenses.filter((x) => x.id !== e.id); logAudit(db, user, "DELETE_EXPENSE", e.code); saveDB(db); refresh(); }}><Trash2 className="h-3.5 w-3.5" /></button>}</td>
          </tr>
        ))}
      </Table>
      {open && (
        <Modal title="مصروف جديد" onClose={() => setOpen(false)} onSubmit={save}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="التصنيف"><select className={inputCls} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></Field>
            <Field label="المبلغ"><input type="number" min={1} required className={inputCls} value={form.amount} onChange={(e) => setForm({ ...form, amount: +e.target.value })} /></Field>
          </div>
          <Field label="طريقة الدفع"><select className={inputCls} value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>{Object.entries(METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="ملاحظة"><input className={inputCls} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
        </Modal>
      )}
    </AppLayout>
  );
}
