import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { requireAuth } from "./index";
import { newId, nextCode, logAudit, saveDB, fmt, type Package } from "@/lib/db";
import { useDB, Modal, Field, Table, Tabs, inputCls, btnPrimary, btnGhost, td } from "@/components/kit";

export const Route = createFileRoute("/packages")({
  beforeLoad: () => requireAuth(),
  head: () => ({ meta: [{ title: "الاشتراكات والباقات — ZEROS CAR WASH PRO" }, { name: "description", content: "باقات الغسيل الشهرية واشتراكات العملاء" }] }),
  component: PackagesPage,
});

function PackagesPage() {
  const [db, refresh, user] = useDB();
  const [tab, setTab] = useState<"subs" | "pkgs">("subs");
  const [pf, setPf] = useState<{ edit: Package | null; name: string; price: number; washes: number; days: number; serviceIds: string[] } | null>(null);
  const [sf, setSf] = useState<{ customerId: string; vehicleId: string; packageId: string; method: string } | null>(null);

  const savePkg = () => {
    const f = pf!; const data = { name: f.name, price: f.price, washes: f.washes, days: f.days, serviceIds: f.serviceIds };
    if (f.edit) Object.assign(f.edit, data); else db.packages.push({ id: newId(), ...data, active: true });
    logAudit(db, user, "SAVE_PACKAGE", f.name); saveDB(db); setPf(null); refresh();
  };
  const saveSub = () => {
    const f = sf!; const p = db.packages.find((x) => x.id === f.packageId);
    if (!f.customerId || !p) return alert("اختر العميل والباقة");
    if (!db.shifts.some((s) => !s.closedAt)) return alert("افتح وردية أولاً لاستلام مبلغ الاشتراك.");
    const start = new Date(); const end = new Date(start.getTime() + p.days * 86400000);
    db.subscriptions.unshift({ id: newId(), code: nextCode(db, "SUB", true), customerId: f.customerId, vehicleId: f.vehicleId || undefined, packageId: p.id, remaining: p.washes, startAt: start.toISOString(), endAt: end.toISOString(), usage: [] });
    db.invoices.push({ id: newId(), code: nextCode(db, "INV", true), orderId: "", subtotal: p.price, discount: 0, tax: 0, total: p.price, method: f.method, cashier: user, createdAt: start.toISOString() });
    logAudit(db, user, "ADD_SUBSCRIPTION", p.name); saveDB(db); setSf(null); refresh();
  };
  const use = (id: string) => {
    const s = db.subscriptions.find((x) => x.id === id)!;
    if (s.remaining <= 0 || new Date(s.endAt) < new Date()) return alert("الاشتراك منتهي");
    s.remaining -= 1; s.usage.push(new Date().toISOString());
    logAudit(db, user, "USE_SUBSCRIPTION", s.code); saveDB(db); refresh();
  };
  const toggle = (sid: string) => setPf((f) => f && { ...f, serviceIds: f.serviceIds.includes(sid) ? f.serviceIds.filter((x) => x !== sid) : [...f.serviceIds, sid] });

  return (
    <AppLayout title="الاشتراكات والباقات">
      <Tabs value={tab} onChange={setTab} tabs={[["subs", "اشتراكات العملاء"], ["pkgs", "الباقات"]]} />
      {tab === "pkgs" ? (
        <>
          <div className="mb-3 flex justify-end"><button className={btnPrimary} onClick={() => setPf({ edit: null, name: "", price: 0, washes: 4, days: 30, serviceIds: [] })}><Plus className="h-4 w-4" /> باقة جديدة</button></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {db.packages.map((p) => (
              <div key={p.id} className={`rounded-xl border border-border bg-card p-4 ${p.active ? "" : "opacity-50"}`}>
                <div className="flex items-start justify-between"><div className="font-bold">{p.name}</div><button className={btnGhost} onClick={() => setPf({ edit: p, name: p.name, price: p.price, washes: p.washes, days: p.days, serviceIds: p.serviceIds })}><Pencil className="h-3.5 w-3.5" /></button></div>
                <div className="mt-2 text-2xl font-bold text-primary">{fmt(p.price)}</div>
                <div className="text-sm text-muted-foreground">{p.washes} غسلة • {p.days} يوم</div>
                <div className="mt-2 flex flex-wrap gap-1">{p.serviceIds.map((id) => <span key={id} className="rounded bg-muted px-2 py-0.5 text-xs">{db.services.find((s) => s.id === id)?.nameAr}</span>)}</div>
                <button className={btnGhost + " mt-3"} onClick={() => { p.active = !p.active; saveDB(db); refresh(); }}>{p.active ? "إيقاف" : "تفعيل"}</button>
              </div>
            ))}
            {!db.packages.length && <div className="text-sm text-muted-foreground">لا توجد باقات بعد.</div>}
          </div>
        </>
      ) : (
        <>
          <div className="mb-3 flex justify-end"><button className={btnPrimary} onClick={() => setSf({ customerId: "", vehicleId: "", packageId: "", method: "cash" })}><Plus className="h-4 w-4" /> اشتراك جديد</button></div>
          <Table head={["الرمز", "العميل", "السيارة", "الباقة", "المتبقي", "ينتهي", "الحالة", ""]} empty={!db.subscriptions.length}>
            {db.subscriptions.map((s) => {
              const expired = s.remaining <= 0 || new Date(s.endAt) < new Date();
              const v = db.vehicles.find((x) => x.id === s.vehicleId);
              return (
                <tr key={s.id}>
                  <td className={td + " font-mono text-xs"} dir="ltr">{s.code}</td>
                  <td className={td + " font-bold"}>{db.customers.find((c) => c.id === s.customerId)?.name}</td>
                  <td className={td}>{v ? `${v.make} ${v.plate}` : "—"}</td>
                  <td className={td}>{db.packages.find((p) => p.id === s.packageId)?.name}</td>
                  <td className={td + " font-bold"}>{s.remaining}</td>
                  <td className={td + " text-xs"}>{new Date(s.endAt).toLocaleDateString("ar-IQ")}</td>
                  <td className={td}><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${expired ? "bg-destructive/20 text-destructive" : "bg-primary/20 text-primary"}`}>{expired ? "منتهي" : "فعّال"}</span></td>
                  <td className={td}>{!expired && <button className={btnGhost} onClick={() => use(s.id)}>استخدام غسلة</button>}</td>
                </tr>
              );
            })}
          </Table>
        </>
      )}
      {pf && (
        <Modal title={pf.edit ? "تعديل باقة" : "باقة جديدة"} onClose={() => setPf(null)} onSubmit={savePkg}>
          <Field label="اسم الباقة"><input required className={inputCls} value={pf.name} onChange={(e) => setPf({ ...pf, name: e.target.value })} /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="السعر"><input type="number" min={0} className={inputCls} value={pf.price} onChange={(e) => setPf({ ...pf, price: +e.target.value })} /></Field>
            <Field label="عدد الغسلات"><input type="number" min={1} className={inputCls} value={pf.washes} onChange={(e) => setPf({ ...pf, washes: +e.target.value })} /></Field>
            <Field label="المدة (يوم)"><input type="number" min={1} className={inputCls} value={pf.days} onChange={(e) => setPf({ ...pf, days: +e.target.value })} /></Field>
          </div>
          <div className="text-sm font-medium">الخدمات المشمولة</div>
          <div className="flex flex-wrap gap-1.5">{db.services.filter((s) => s.active).map((s) => <button type="button" key={s.id} onClick={() => toggle(s.id)} className={`rounded-lg px-2.5 py-1 text-xs ${pf.serviceIds.includes(s.id) ? "bg-primary text-primary-foreground" : "border border-border"}`}>{s.nameAr}</button>)}</div>
        </Modal>
      )}
      {sf && (
        <Modal title="اشتراك جديد" onClose={() => setSf(null)} onSubmit={saveSub}>
          <Field label="العميل"><select required className={inputCls} value={sf.customerId} onChange={(e) => setSf({ ...sf, customerId: e.target.value, vehicleId: "" })}><option value="">— اختر —</option>{db.customers.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>)}</select></Field>
          <Field label="السيارة"><select className={inputCls} value={sf.vehicleId} onChange={(e) => setSf({ ...sf, vehicleId: e.target.value })}><option value="">— أي سيارة —</option>{db.vehicles.filter((v) => v.customerId === sf.customerId).map((v) => <option key={v.id} value={v.id}>{v.make} {v.model} — {v.plate}</option>)}</select></Field>
          <Field label="الباقة"><select required className={inputCls} value={sf.packageId} onChange={(e) => setSf({ ...sf, packageId: e.target.value })}><option value="">— اختر —</option>{db.packages.filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.name} — {fmt(p.price)}</option>)}</select></Field>
          <Field label="طريقة الدفع"><select className={inputCls} value={sf.method} onChange={(e) => setSf({ ...sf, method: e.target.value })}><option value="cash">نقدي</option><option value="card">بطاقة</option><option value="credit">آجل</option></select></Field>
        </Modal>
      )}
    </AppLayout>
  );
}
