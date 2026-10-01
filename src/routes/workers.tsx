import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { requireAuth } from "./index";
import { newId, nextCode, logAudit, saveDB, fmt, inRange, todayStr, orderCommission, type Worker } from "@/lib/db";
import { useDB, Modal, Field, Table, Tabs, DateRange, Stat, inputCls, btnPrimary, btnGhost, btnDanger, td } from "@/components/kit";

export const Route = createFileRoute("/workers")({
  beforeLoad: () => requireAuth(),
  head: () => ({ meta: [{ title: "العمال والعمولات — CAR WASH PRO" }, { name: "description", content: "إدارة العمال وحساب العمولات" }] }),
  component: WorkersPage,
});

const empty = { name: "", phone: "", job: "غسّال", salary: 0, commissionPct: 0 };

function WorkersPage() {
  const [db, refresh, user] = useDB();
  const [tab, setTab] = useState<"list" | "comm">("list");
  const [edit, setEdit] = useState<Worker | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [from, setFrom] = useState(todayStr().slice(0, 8) + "01");
  const [to, setTo] = useState(todayStr());

  const save = () => {
    if (edit) { Object.assign(edit, form); logAudit(db, user, "EDIT_WORKER", form.name); }
    else { db.workers.push({ id: newId(), code: nextCode(db, "EMP"), ...form, active: true, createdAt: new Date().toISOString() }); logAudit(db, user, "ADD_WORKER", form.name); }
    saveDB(db); setOpen(false); refresh();
  };
  const remove = (w: Worker) => {
    if (db.orders.some((o) => o.workerId === w.id)) { w.active = false; alert("العامل مرتبط بطلبات، تم إيقافه بدلاً من حذفه."); }
    else { if (!confirm(`حذف ${w.name}؟`)) return; db.workers = db.workers.filter((x) => x.id !== w.id); }
    logAudit(db, user, "DELETE_WORKER", w.name); saveDB(db); refresh();
  };

  const done = db.orders.filter((o) => o.status === "DELIVERED" && o.workerId && inRange(o.createdAt, from, to));
  const rows = db.workers.map((w) => {
    const os = done.filter((o) => o.workerId === w.id);
    return { w, cars: os.length, sales: os.reduce((a, o) => a + o.total, 0), comm: os.reduce((a, o) => a + orderCommission(db, o), 0) };
  });

  return (
    <AppLayout title="العمال والعمولات">
      <Tabs value={tab} onChange={setTab} tabs={[["list", "العمال"], ["comm", "العمولات"]]} />
      {tab === "list" ? (
        <>
          <div className="mb-3 flex justify-end">
            <button className={btnPrimary} onClick={() => { setEdit(null); setForm(empty); setOpen(true); }}><Plus className="h-4 w-4" /> عامل جديد</button>
          </div>
          <Table head={["الرمز", "الاسم", "الهاتف", "الوظيفة", "الراتب", "نسبة العمولة", "الحالة", ""]} empty={!db.workers.length}>
            {db.workers.map((w) => (
              <tr key={w.id} className={w.active ? "" : "opacity-50"}>
                <td className={td + " font-mono text-xs"}>{w.code}</td>
                <td className={td + " font-bold"}>{w.name}</td>
                <td className={td} dir="ltr">{w.phone}</td>
                <td className={td}>{w.job}</td>
                <td className={td}>{fmt(w.salary)}</td>
                <td className={td}>{w.commissionPct}%</td>
                <td className={td}><button className={btnGhost} onClick={() => { w.active = !w.active; saveDB(db); refresh(); }}>{w.active ? "نشط" : "موقوف"}</button></td>
                <td className={td}>
                  <div className="flex gap-1">
                    <button className={btnGhost} onClick={() => { setEdit(w); setForm({ name: w.name, phone: w.phone, job: w.job, salary: w.salary, commissionPct: w.commissionPct }); setOpen(true); }}><Pencil className="h-3.5 w-3.5" /></button>
                    <button className={btnDanger} onClick={() => remove(w)}><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
          <p className="mt-3 text-xs text-muted-foreground">العمولة = عمولة الخدمات الثابتة + نسبة العامل من قيمة الطلب. تُحسب للطلبات المسلّمة فقط. عيّن العامل من صفحة الطابور.</p>
        </>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} />
            <button className={btnGhost} onClick={() => window.print()}>طباعة</button>
          </div>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <Stat label="سيارات منجزة" value={done.length} />
            <Stat label="إجمالي المبيعات" value={fmt(rows.reduce((a, r) => a + r.sales, 0))} />
            <Stat label="إجمالي العمولات" value={fmt(rows.reduce((a, r) => a + r.comm, 0))} tone="good" />
          </div>
          <Table head={["العامل", "عدد السيارات", "قيمة الأعمال", "العمولة", "الراتب", "المستحق"]} empty={!rows.length}>
            {rows.map((r) => (
              <tr key={r.w.id}>
                <td className={td + " font-bold"}>{r.w.name}</td>
                <td className={td}>{r.cars}</td>
                <td className={td}>{fmt(r.sales)}</td>
                <td className={td + " font-bold text-primary"}>{fmt(r.comm)}</td>
                <td className={td}>{fmt(r.w.salary)}</td>
                <td className={td + " font-bold"}>{fmt(r.comm + r.w.salary)}</td>
              </tr>
            ))}
          </Table>
        </>
      )}
      {open && (
        <Modal title={edit ? "تعديل عامل" : "عامل جديد"} onClose={() => setOpen(false)} onSubmit={save}>
          <Field label="الاسم"><input required className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="الهاتف"><input dir="ltr" className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label="الوظيفة">
              <select className={inputCls} value={form.job} onChange={(e) => setForm({ ...form, job: e.target.value })}>
                {["غسّال", "ملمّع", "مشرف", "فني تنظيف داخلي", "أخرى"].map((j) => <option key={j}>{j}</option>)}
              </select>
            </Field>
            <Field label="الراتب الشهري"><input type="number" min={0} className={inputCls} value={form.salary} onChange={(e) => setForm({ ...form, salary: +e.target.value })} /></Field>
            <Field label="نسبة العمولة %"><input type="number" min={0} max={100} className={inputCls} value={form.commissionPct} onChange={(e) => setForm({ ...form, commissionPct: +e.target.value })} /></Field>
          </div>
        </Modal>
      )}
    </AppLayout>
  );
}
