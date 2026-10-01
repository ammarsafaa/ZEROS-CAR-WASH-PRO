import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { requireAuth } from "./index";
import { newId, nextCode, logAudit, saveDB, fmt, type StockItem, type Supplier } from "@/lib/db";
import { useDB, Modal, Field, Table, Tabs, inputCls, btnPrimary, btnGhost, btnDanger, td } from "@/components/kit";

export const Route = createFileRoute("/inventory")({
  beforeLoad: () => requireAuth(),
  head: () => ({ meta: [{ title: "المخزون والمشتريات — ZEROS CAR WASH PRO" }, { name: "description", content: "المواد والموردون وفواتير الشراء" }] }),
  component: InventoryPage,
});

type Line = { itemId: string; qty: number; cost: number };

function InventoryPage() {
  const [db, refresh, user] = useDB();
  const [tab, setTab] = useState<"items" | "suppliers" | "purchases">("items");
  const [itemForm, setItemForm] = useState<{ edit: StockItem | null; name: string; unit: string; qty: number; minQty: number; cost: number } | null>(null);
  const [supForm, setSupForm] = useState<{ edit: Supplier | null; name: string; phone: string; address: string } | null>(null);
  const [pur, setPur] = useState<{ supplierId: string; lines: Line[]; paid: number } | null>(null);

  const saveItem = () => {
    const f = itemForm!;
    const data = { name: f.name, unit: f.unit, qty: f.qty, minQty: f.minQty, cost: f.cost };
    if (f.edit) Object.assign(f.edit, data); else db.items.push({ id: newId(), code: nextCode(db, "ITM"), ...data });
    logAudit(db, user, f.edit ? "EDIT_ITEM" : "ADD_ITEM", f.name); saveDB(db); setItemForm(null); refresh();
  };
  const adjust = (it: StockItem) => {
    const v = prompt(`استهلاك/تسوية "${it.name}" — أدخل الكمية (سالب للصرف، موجب للإضافة):`);
    const n = Number(v);
    if (!v || isNaN(n)) return;
    if (it.qty + n < 0) return alert("الكمية غير كافية");
    it.qty += n; logAudit(db, user, "STOCK_ADJUST", `${it.name} ${n}`); saveDB(db); refresh();
  };
  const saveSup = () => {
    const f = supForm!;
    if (f.edit) Object.assign(f.edit, { name: f.name, phone: f.phone, address: f.address });
    else db.suppliers.push({ id: newId(), code: nextCode(db, "SUP"), name: f.name, phone: f.phone, address: f.address, balance: 0 });
    logAudit(db, user, "SAVE_SUPPLIER", f.name); saveDB(db); setSupForm(null); refresh();
  };
  const savePur = () => {
    const p = pur!;
    const lines = p.lines.filter((l) => l.itemId && l.qty > 0);
    if (!p.supplierId || !lines.length) return alert("اختر المورد وأضف مادة واحدة على الأقل");
    const total = lines.reduce((a, l) => a + l.qty * l.cost, 0);
    for (const l of lines) {
      const it = db.items.find((i) => i.id === l.itemId)!;
      it.cost = Math.round((it.qty * it.cost + l.qty * l.cost) / (it.qty + l.qty) || l.cost);
      it.qty += l.qty;
    }
    const s = db.suppliers.find((x) => x.id === p.supplierId)!;
    s.balance += total - p.paid;
    const code = nextCode(db, "PUR", true);
    db.purchases.unshift({ id: newId(), code, supplierId: p.supplierId, lines, total, paid: p.paid, date: new Date().toISOString(), user });
    logAudit(db, user, "ADD_PURCHASE", `${code} ${total}`); saveDB(db); setPur(null); refresh();
  };
  const paySup = (s: Supplier) => {
    const n = Number(prompt(`تسديد للمورد ${s.name} (الرصيد ${fmt(s.balance)}):`));
    if (!n || n <= 0) return;
    s.balance -= n;
    db.expenses.unshift({ id: newId(), code: nextCode(db, "EXP", true), category: "مواد", amount: n, method: "cash", note: `تسديد مورد: ${s.name}`, date: new Date().toISOString(), user });
    logAudit(db, user, "PAY_SUPPLIER", `${s.name} ${n}`); saveDB(db); refresh();
  };

  return (
    <AppLayout title="المخزون والمشتريات">
      <Tabs value={tab} onChange={setTab} tabs={[["items", "المواد"], ["suppliers", "الموردون"], ["purchases", "المشتريات"]]} />
      {tab === "items" && (
        <>
          <div className="mb-3 flex justify-end"><button className={btnPrimary} onClick={() => setItemForm({ edit: null, name: "", unit: "لتر", qty: 0, minQty: 0, cost: 0 })}><Plus className="h-4 w-4" /> مادة جديدة</button></div>
          <Table head={["الرمز", "المادة", "الوحدة", "الكمية", "الحد الأدنى", "الكلفة", "القيمة", ""]} empty={!db.items.length}>
            {db.items.map((it) => (
              <tr key={it.id} className={it.qty <= it.minQty ? "bg-destructive/10" : ""}>
                <td className={td + " font-mono text-xs"}>{it.code}</td>
                <td className={td + " font-bold"}>{it.qty <= it.minQty && <AlertTriangle className="me-1 inline h-4 w-4 text-destructive" />}{it.name}</td>
                <td className={td}>{it.unit}</td>
                <td className={td + " font-bold"}>{it.qty}</td>
                <td className={td}>{it.minQty}</td>
                <td className={td}>{fmt(it.cost)}</td>
                <td className={td}>{fmt(it.qty * it.cost)}</td>
                <td className={td}><div className="flex gap-1">
                  <button className={btnGhost} onClick={() => adjust(it)}>صرف/تسوية</button>
                  <button className={btnGhost} onClick={() => setItemForm({ edit: it, name: it.name, unit: it.unit, qty: it.qty, minQty: it.minQty, cost: it.cost })}><Pencil className="h-3.5 w-3.5" /></button>
                  <button className={btnDanger} onClick={() => { if (!confirm("حذف المادة؟")) return; db.items = db.items.filter((x) => x.id !== it.id); saveDB(db); refresh(); }}><Trash2 className="h-3.5 w-3.5" /></button>
                </div></td>
              </tr>
            ))}
          </Table>
        </>
      )}
      {tab === "suppliers" && (
        <>
          <div className="mb-3 flex justify-end"><button className={btnPrimary} onClick={() => setSupForm({ edit: null, name: "", phone: "", address: "" })}><Plus className="h-4 w-4" /> مورد جديد</button></div>
          <Table head={["الرمز", "المورد", "الهاتف", "العنوان", "المستحق له", ""]} empty={!db.suppliers.length}>
            {db.suppliers.map((s) => (
              <tr key={s.id}>
                <td className={td + " font-mono text-xs"}>{s.code}</td>
                <td className={td + " font-bold"}>{s.name}</td>
                <td className={td} dir="ltr">{s.phone}</td>
                <td className={td}>{s.address}</td>
                <td className={td + " font-bold text-destructive"}>{fmt(s.balance)}</td>
                <td className={td}><div className="flex gap-1">
                  <button className={btnGhost} onClick={() => paySup(s)}>تسديد</button>
                  <button className={btnGhost} onClick={() => setSupForm({ edit: s, name: s.name, phone: s.phone, address: s.address })}><Pencil className="h-3.5 w-3.5" /></button>
                </div></td>
              </tr>
            ))}
          </Table>
        </>
      )}
      {tab === "purchases" && (
        <>
          <div className="mb-3 flex justify-end"><button className={btnPrimary} onClick={() => setPur({ supplierId: "", lines: [{ itemId: "", qty: 1, cost: 0 }], paid: 0 })}><Plus className="h-4 w-4" /> فاتورة شراء</button></div>
          <Table head={["الرمز", "التاريخ", "المورد", "المواد", "الإجمالي", "المدفوع", "المتبقي"]} empty={!db.purchases.length}>
            {db.purchases.map((p) => (
              <tr key={p.id}>
                <td className={td + " font-mono text-xs"} dir="ltr">{p.code}</td>
                <td className={td + " text-xs"}>{new Date(p.date).toLocaleString("ar-IQ")}</td>
                <td className={td}>{db.suppliers.find((s) => s.id === p.supplierId)?.name}</td>
                <td className={td + " text-xs"}>{p.lines.map((l) => `${db.items.find((i) => i.id === l.itemId)?.name} ×${l.qty}`).join("، ")}</td>
                <td className={td + " font-bold"}>{fmt(p.total)}</td>
                <td className={td}>{fmt(p.paid)}</td>
                <td className={td}>{fmt(p.total - p.paid)}</td>
              </tr>
            ))}
          </Table>
        </>
      )}

      {itemForm && (
        <Modal title={itemForm.edit ? "تعديل مادة" : "مادة جديدة"} onClose={() => setItemForm(null)} onSubmit={saveItem}>
          <Field label="اسم المادة"><input required className={inputCls} value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="الوحدة"><select className={inputCls} value={itemForm.unit} onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })}>{["لتر", "كغم", "قطعة", "علبة", "غالون"].map((u) => <option key={u}>{u}</option>)}</select></Field>
            <Field label="الكمية"><input type="number" min={0} step="any" className={inputCls} value={itemForm.qty} onChange={(e) => setItemForm({ ...itemForm, qty: +e.target.value })} /></Field>
            <Field label="الحد الأدنى للتنبيه"><input type="number" min={0} step="any" className={inputCls} value={itemForm.minQty} onChange={(e) => setItemForm({ ...itemForm, minQty: +e.target.value })} /></Field>
            <Field label="كلفة الوحدة"><input type="number" min={0} className={inputCls} value={itemForm.cost} onChange={(e) => setItemForm({ ...itemForm, cost: +e.target.value })} /></Field>
          </div>
        </Modal>
      )}
      {supForm && (
        <Modal title={supForm.edit ? "تعديل مورد" : "مورد جديد"} onClose={() => setSupForm(null)} onSubmit={saveSup}>
          <Field label="الاسم"><input required className={inputCls} value={supForm.name} onChange={(e) => setSupForm({ ...supForm, name: e.target.value })} /></Field>
          <Field label="الهاتف"><input dir="ltr" className={inputCls} value={supForm.phone} onChange={(e) => setSupForm({ ...supForm, phone: e.target.value })} /></Field>
          <Field label="العنوان"><input className={inputCls} value={supForm.address} onChange={(e) => setSupForm({ ...supForm, address: e.target.value })} /></Field>
        </Modal>
      )}
      {pur && (
        <Modal wide title="فاتورة شراء" onClose={() => setPur(null)} onSubmit={savePur}>
          <Field label="المورد"><select required className={inputCls} value={pur.supplierId} onChange={(e) => setPur({ ...pur, supplierId: e.target.value })}><option value="">— اختر —</option>{db.suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
          {pur.lines.map((l, i) => (
            <div key={i} className="grid grid-cols-[2fr_1fr_1fr_auto] items-end gap-2">
              <Field label="المادة"><select className={inputCls} value={l.itemId} onChange={(e) => { const lines = [...pur.lines]; const it = db.items.find((x) => x.id === e.target.value); lines[i] = { ...l, itemId: e.target.value, cost: it?.cost ?? 0 }; setPur({ ...pur, lines }); }}><option value="">—</option>{db.items.map((it) => <option key={it.id} value={it.id}>{it.name}</option>)}</select></Field>
              <Field label="الكمية"><input type="number" min={0} step="any" className={inputCls} value={l.qty} onChange={(e) => { const lines = [...pur.lines]; lines[i] = { ...l, qty: +e.target.value }; setPur({ ...pur, lines }); }} /></Field>
              <Field label="سعر الوحدة"><input type="number" min={0} className={inputCls} value={l.cost} onChange={(e) => { const lines = [...pur.lines]; lines[i] = { ...l, cost: +e.target.value }; setPur({ ...pur, lines }); }} /></Field>
              <button type="button" className={btnDanger + " mb-1"} onClick={() => setPur({ ...pur, lines: pur.lines.filter((_, j) => j !== i) })}><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
          <button type="button" className={btnGhost} onClick={() => setPur({ ...pur, lines: [...pur.lines, { itemId: "", qty: 1, cost: 0 }] })}><Plus className="h-3.5 w-3.5" /> سطر</button>
          <div className="flex items-end justify-between gap-3">
            <div className="text-lg font-bold">الإجمالي: {fmt(pur.lines.reduce((a, l) => a + l.qty * l.cost, 0))}</div>
            <Field label="المدفوع الآن"><input type="number" min={0} className={inputCls} value={pur.paid} onChange={(e) => setPur({ ...pur, paid: +e.target.value })} /></Field>
          </div>
        </Modal>
      )}
    </AppLayout>
  );
}
