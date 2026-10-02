import { printReceipt } from "@/lib/print";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Printer, Ban } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { ProfessionalReceipt } from "@/components/ProfessionalReceipt";
import { requireAuth } from "./index";
import { getDB, saveDB, nextCode, newId, logAudit, getSession, fmt, type Invoice, type Order } from "@/lib/db";

export const Route = createFileRoute("/pos")({
  beforeLoad: () => requireAuth(),
  head: () => ({
    meta: [
      { title: "الكاشير والفواتير — ZEROS CAR WASH PRO" },
      { name: "description", content: "إصدار الفواتير والدفع والطباعة الحرارية 80mm" },
    ],
  }),
  component: PosPage,
});

const METHODS = [
  { v: "Cash", ar: "نقدي" },
  { v: "Card", ar: "بطاقة" },
  { v: "Credit", ar: "آجل" },
  { v: "Other", ar: "أخرى" },
];

function PosPage() {
  const [, setVersion] = useState(0);
  const db = useMemo(() => getDB(), []);
  const session = getSession();
  const refresh = () => setVersion((v) => v + 1);
  const [orderId, setOrderId] = useState("");
  const [discount, setDiscount] = useState(0);
  const [method, setMethod] = useState("Cash");
  const [printInv, setPrintInv] = useState<Invoice | null>(null);

  const invoicedIds = new Set(db.invoices.filter((i) => !i.voided).map((i) => i.orderId));
  const unpaid = db.orders.filter((o) => o.status !== "CANCELLED" && !invoicedIds.has(o.id));
  const order = db.orders.find((o) => o.id === orderId);

  const maxDiscountPct = session?.role === "cashier" ? 10 : 100;
  const subtotal = order?.total ?? 0;
  const disc = Math.min(discount, (subtotal * maxDiscountPct) / 100);
  const tax = db.settings.taxEnabled ? Math.round(((subtotal - disc) * db.settings.taxRate) / 100) : 0;
  const total = subtotal - disc + tax;

  const veh = (o?: Order) => db.vehicles.find((v) => v.id === o?.vehicleId);
  const cus = (o?: Order) => db.customers.find((c) => c.id === o?.customerId);

  const pay = () => {
    if (!order) return;
    if (!db.shifts.some((x) => !x.closedAt)) {
      alert("لا توجد وردية مفتوحة. افتح وردية من صفحة الورديات والصندوق أولاً.");
      return;
    }
    const inv: Invoice = {
      id: newId(),
      code: nextCode(db, "INV", true),
      orderId: order.id,
      subtotal,
      discount: disc,
      tax,
      total,
      method,
      cashier: session?.name ?? "",
      createdAt: new Date().toISOString(),
    };
    db.invoices.push(inv);
    const c = cus(order);
    if (c) {
      c.points += Math.floor(total / 1000);
      if (method === "Credit") c.balance += total;
    }
    logAudit(db, session?.username ?? "?", "NEW_INVOICE", `${inv.code} — ${fmt(total)} (${method})`);
    saveDB(db);
    setOrderId("");
    setDiscount(0);
    setPrintInv(inv);
    refresh();
  };

  const voidInv = (inv: Invoice) => {
    if (session?.role === "cashier" || session?.role === "worker") {
      alert("لا تملك صلاحية إلغاء الفواتير");
      return;
    }
    const reason = prompt(`سبب إلغاء الفاتورة ${inv.code}؟`);
    if (!reason) return;
    inv.voided = true;
    inv.voidReason = reason;
    logAudit(db, session?.username ?? "?", "VOID_INVOICE", `${inv.code} — ${reason}`);
    saveDB(db);
    refresh();
  };

  const recent = [...db.invoices].reverse().slice(0, 15);

  return (
    <AppLayout title="الكاشير والفواتير">
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-3 text-sm font-bold">طلبات بانتظار الدفع ({unpaid.length})</h2>
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {unpaid.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">لا توجد طلبات</p>}
              {unpaid.map((o) => (
                <button
                  key={o.id}
                  onClick={() => setOrderId(o.id)}
                  className={`flex w-full items-center justify-between rounded-lg border p-3 text-start text-sm ${orderId === o.id ? "border-primary bg-accent" : "border-border hover:bg-muted"}`}
                >
                  <div>
                    <div className="font-mono font-bold" dir="ltr">{o.code}</div>
                    <div className="text-xs text-muted-foreground">{cus(o)?.name} • {veh(o)?.plate}</div>
                  </div>
                  <span className="font-bold text-primary">{fmt(o.total)}</span>
                </button>
              ))}
            </div>
          </div>

          {order && (
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="mb-3 text-sm font-bold">الدفع — {order.code}</h2>
              <div className="space-y-1 text-sm">
                {order.items.map((it, i) => (
                  <div key={i} className="flex justify-between"><span>{it.name}</span><span>{fmt(it.price)}</span></div>
                ))}
              </div>
              <div className="my-3 border-t border-border" />
              <label className="mb-1 block text-xs text-muted-foreground">الخصم (حد أقصى {maxDiscountPct}%)</label>
              <input type="number" min={0} value={discount} onChange={(e) => setDiscount(+e.target.value)} className="mb-3 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
              <div className="mb-3 grid grid-cols-4 gap-1.5">
                {METHODS.map((m) => (
                  <button key={m.v} onClick={() => setMethod(m.v)} className={`rounded-lg py-2 text-xs font-bold ${method === m.v ? "bg-primary text-primary-foreground" : "border border-border hover:bg-muted"}`}>
                    {m.ar}
                  </button>
                ))}
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span>المجموع</span><span>{fmt(subtotal)}</span></div>
                <div className="flex justify-between text-destructive"><span>الخصم</span><span>-{fmt(disc)}</span></div>
                {tax > 0 && <div className="flex justify-between"><span>الضريبة</span><span>{fmt(tax)}</span></div>}
                <div className="flex justify-between text-lg font-bold"><span>الإجمالي</span><span className="text-primary">{fmt(total)} {db.settings.currency}</span></div>
              </div>
              <button onClick={pay} className="mt-4 w-full rounded-lg bg-primary py-3 text-sm font-bold text-primary-foreground hover:opacity-90">
                دفع وإصدار الفاتورة
              </button>
            </div>
          )}
        </div>

        <div className="lg:col-span-3">
          <div className="rounded-xl border border-border bg-card">
            <h2 className="border-b border-border p-4 text-sm font-bold">آخر الفواتير</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="p-3 text-start">الرقم</th>
                  <th className="p-3 text-start">الوقت</th>
                  <th className="p-3 text-start">الدفع</th>
                  <th className="p-3 text-start">المبلغ</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {recent.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">لا توجد فواتير بعد</td></tr>}
                {recent.map((inv) => (
                  <tr key={inv.id} className={`border-b border-border/50 ${inv.voided ? "opacity-50 line-through" : ""}`}>
                    <td className="p-3 font-mono text-xs" dir="ltr">{inv.code}</td>
                    <td className="p-3 text-xs">{new Date(inv.createdAt).toLocaleString("ar-IQ")}</td>
                    <td className="p-3">{inv.method}</td>
                    <td className="p-3 font-bold">{fmt(inv.total)}</td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <button onClick={() => setPrintInv(inv)} className="rounded p-1.5 hover:bg-muted" title="طباعة"><Printer className="h-4 w-4" /></button>
                        {!inv.voided && <button onClick={() => voidInv(inv)} className="rounded p-1.5 text-destructive hover:bg-destructive/10" title="إلغاء"><Ban className="h-4 w-4" /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {printInv && <Receipt inv={printInv} onClose={() => setPrintInv(null)} />}
    </AppLayout>
  );
}

function Receipt({ inv, onClose }: { inv: Invoice; onClose: () => void }) {
  const db = getDB();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="max-h-[92vh] overflow-y-auto rounded-lg bg-card p-4 shadow-xl">
        <ProfessionalReceipt db={db} invoice={inv} />
        <div className="mt-3 flex gap-2">
          <button onClick={() => printReceipt()} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary py-2 text-sm font-bold text-primary-foreground">
            <Printer className="h-4 w-4" /> طباعة
          </button>
          <button onClick={onClose} className="flex-1 rounded-lg border border-border py-2 text-sm">إغلاق</button>
        </div>
      </div>
    </div>
  );
}
