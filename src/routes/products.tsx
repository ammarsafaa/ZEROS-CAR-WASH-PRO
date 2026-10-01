import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { requireAuth } from "./index";
import { newId, nextCode, logAudit, saveDB, fmt, PRODUCT_CATS, type StockItem } from "@/lib/db";
import { useDB, Modal, Field, Table, Tabs, inputCls, btnPrimary, btnGhost, btnDanger, td } from "@/components/kit";

export const Route = createFileRoute("/products")({
  beforeLoad: () => requireAuth(),
  head: () => ({ meta: [{ title: "الزيوت وقطع الغيار — CAR WASH PRO" }, { name: "description", content: "زيوت المحرك والفلاتر وقطع الغيار وسجل تبديل الزيت" }] }),
  component: ProductsPage,
});

const empty = { name: "", category: PRODUCT_CATS[0]!, unit: "قطعة", barcode: "", qty: 0, minQty: 2, cost: 0, sellPrice: 0 };

function ProductsPage() {
  const [db, refresh, user] = useDB();
  const [tab, setTab] = useState<"products" | "oil">("products");
  const [cat, setCat] = useState("الكل");
  const [q, setQ] = useState("");
  const [f, setF] = useState<(typeof empty & { edit: StockItem | null }) | null>(null);

  const rows = db.items.filter((i) => i.sellable && (cat === "الكل" || i.category === cat) && (!q || i.name.includes(q) || i.barcode === q || i.code === q));
  const save = () => {
    const x = f!;
    if (x.barcode && db.items.some((i) => i.barcode === x.barcode && i !== x.edit)) return alert("الباركود مستخدم لمنتج آخر");
    const data = { name: x.name, category: x.category, unit: x.unit, barcode: x.barcode, qty: x.qty, minQty: x.minQty, cost: x.cost, sellPrice: x.sellPrice, sellable: true };
    if (x.edit) Object.assign(x.edit, data); else db.items.push({ id: newId(), code: nextCode(db, "PRD"), ...data });
    logAudit(db, user, x.edit ? "EDIT_PRODUCT" : "ADD_PRODUCT", x.name); saveDB(db); setF(null); refresh();
  };

  // latest oil change per vehicle
  const latest = new Map<string, (typeof db.oilChanges)[number]>();
  db.oilChanges.forEach((o) => { if (!latest.has(o.vehicleId)) latest.set(o.vehicleId, o); });

  return (
    <AppLayout title="الزيوت وقطع الغيار">
      <Tabs value={tab} onChange={setTab} tabs={[["products", "المنتجات"], ["oil", "سجل تبديل الزيت"]]} />
      {tab === "products" ? (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <input placeholder="بحث / باركود" className={inputCls + " w-56"} value={q} onChange={(e) => setQ(e.target.value)} />
            {["الكل", ...PRODUCT_CATS].map((c) => <button key={c} onClick={() => setCat(c)} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${cat === c ? "bg-primary text-primary-foreground" : "border border-border bg-card"}`}>{c}</button>)}
            <div className="flex-1" />
            <button className={btnPrimary} onClick={() => setF({ ...empty, edit: null })}><Plus className="h-4 w-4" /> منتج جديد</button>
          </div>
          <Table head={["الرمز", "المنتج", "التصنيف", "الباركود", "الكمية", "الكلفة", "سعر البيع", "الربح", ""]} empty={!rows.length}>
            {rows.map((p) => (
              <tr key={p.id} className={p.qty <= p.minQty ? "bg-destructive/10" : ""}>
                <td className={td + " font-mono text-xs"}>{p.code}</td>
                <td className={td + " font-bold"}>{p.qty <= p.minQty && <AlertTriangle className="me-1 inline h-4 w-4 text-destructive" />}{p.name}</td>
                <td className={td}>{p.category}</td>
                <td className={td + " font-mono text-xs"} dir="ltr">{p.barcode || "—"}</td>
                <td className={td + " font-bold"}>{p.qty} {p.unit}</td>
                <td className={td}>{fmt(p.cost)}</td>
                <td className={td + " font-bold text-primary"}>{fmt(p.sellPrice ?? 0)}</td>
                <td className={td}>{fmt((p.sellPrice ?? 0) - p.cost)}</td>
                <td className={td}><div className="flex gap-1">
                  <button className={btnGhost} onClick={() => setF({ edit: p, name: p.name, category: p.category ?? PRODUCT_CATS[0]!, unit: p.unit, barcode: p.barcode ?? "", qty: p.qty, minQty: p.minQty, cost: p.cost, sellPrice: p.sellPrice ?? 0 })}><Pencil className="h-3.5 w-3.5" /></button>
                  <button className={btnDanger} onClick={() => { if (!confirm("حذف المنتج؟")) return; db.items = db.items.filter((x) => x.id !== p.id); logAudit(db, user, "DELETE_PRODUCT", p.name); saveDB(db); refresh(); }}><Trash2 className="h-3.5 w-3.5" /></button>
                </div></td>
              </tr>
            ))}
          </Table>
          <p className="mt-2 text-xs text-muted-foreground">لزيادة الكمية استخدم فاتورة شراء من صفحة المخزون والمشتريات. البيع يتم من شاشة المبيعات وينقص المخزون تلقائياً.</p>
        </>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted-foreground">يُسجَّل تلقائياً عند بيع زيت أو فلتر لسيارة من شاشة المبيعات. فترة التبديل الافتراضية: {fmt(db.settings.oilIntervalKm ?? 5000)} كم (تُغيّر من صفحة الولاء والإعدادات).</p>
          <Table head={["التاريخ", "السيارة", "العميل", "العداد", "التبديل القادم", "المواد", "الفاتورة"]} empty={!db.oilChanges.length}>
            {db.oilChanges.map((o) => {
              const v = db.vehicles.find((x) => x.id === o.vehicleId);
              const isLatest = latest.get(o.vehicleId) === o;
              return (
                <tr key={o.id} className={isLatest ? "" : "opacity-60"}>
                  <td className={td + " text-xs"}>{new Date(o.date).toLocaleDateString("ar-IQ")}</td>
                  <td className={td + " font-bold"}>{v ? `${v.make} ${v.model} — ${v.plate}` : "—"}</td>
                  <td className={td}>{db.customers.find((c) => c.id === v?.customerId)?.name} <span className="text-xs text-muted-foreground" dir="ltr">{db.customers.find((c) => c.id === v?.customerId)?.phone}</span></td>
                  <td className={td}>{fmt(o.km)}</td>
                  <td className={td + " font-bold text-primary"}>{fmt(o.nextKm)}</td>
                  <td className={td + " text-xs"}>{o.products}</td>
                  <td className={td + " font-mono text-xs"} dir="ltr">{o.invoiceCode}</td>
                </tr>
              );
            })}
          </Table>
        </>
      )}
      {f && (
        <Modal title={f.edit ? "تعديل منتج" : "منتج جديد"} onClose={() => setF(null)} onSubmit={save}>
          <Field label="اسم المنتج"><input required className={inputCls} placeholder="مثال: زيت Mobil 5W-30 — 4 لتر" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="التصنيف"><select className={inputCls} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{PRODUCT_CATS.map((c) => <option key={c}>{c}</option>)}</select></Field>
            <Field label="الوحدة"><select className={inputCls} value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })}>{["قطعة", "علبة", "لتر", "غالون", "طقم"].map((u) => <option key={u}>{u}</option>)}</select></Field>
            <Field label="الباركود"><input dir="ltr" className={inputCls} value={f.barcode} onChange={(e) => setF({ ...f, barcode: e.target.value })} /></Field>
            <Field label="الكمية الحالية"><input type="number" min={0} className={inputCls} value={f.qty} onChange={(e) => setF({ ...f, qty: +e.target.value })} /></Field>
            <Field label="كلفة الشراء"><input type="number" min={0} className={inputCls} value={f.cost} onChange={(e) => setF({ ...f, cost: +e.target.value })} /></Field>
            <Field label="سعر البيع"><input type="number" min={0} required className={inputCls} value={f.sellPrice} onChange={(e) => setF({ ...f, sellPrice: +e.target.value })} /></Field>
            <Field label="حد التنبيه"><input type="number" min={0} className={inputCls} value={f.minQty} onChange={(e) => setF({ ...f, minQty: +e.target.value })} /></Field>
          </div>
        </Modal>
      )}
    </AppLayout>
  );
}
