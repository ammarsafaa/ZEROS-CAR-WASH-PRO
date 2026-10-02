import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Search, Plus, Minus, Trash2, ScanBarcode, Printer, User, Droplets, Tag, Star } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { AppLayout } from "@/components/AppLayout";
import { requireAuth } from "./index";
import { newId, nextCode, logAudit, saveDB, fmt, getSession, PRODUCT_CATS, OIL_CATS, type Invoice, type InvoiceLine } from "@/lib/db";
import { useDB, inputCls, btnPrimary, btnGhost } from "@/components/kit";

export const Route = createFileRoute("/sales")({
  beforeLoad: () => requireAuth(),
  head: () => ({ meta: [{ title: "شاشة المبيعات — ZEROS CAR WASH PRO" }, { name: "description", content: "بيع الخدمات والزيوت وقطع الغيار بسرعة مع الباركود" }] }),
  component: SalesPage,
});

const METHODS = [["Cash", "نقدي"], ["Card", "بطاقة"], ["Credit", "آجل"], ["Other", "أخرى"]] as const;

function SalesPage() {
  const [db, refresh, user] = useDB();
  const session = getSession();
  const [cat, setCat] = useState<string>("الخدمات");
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<InvoiceLine[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [discount, setDiscount] = useState(0);
  const [couponCode, setCouponCode] = useState("");
  const [usePoints, setUsePoints] = useState(0);
  const [method, setMethod] = useState("Cash");
  const [received, setReceived] = useState(0);
  const [km, setKm] = useState(0);
  const [last, setLast] = useState<Invoice | null>(null);
  const scanRef = useRef<HTMLInputElement>(null);

  const products = db.items.filter((i) => i.sellable);
  const tiles = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (cat === "الخدمات" && !t) return db.services.filter((s) => s.active).map((s) => ({ kind: "service" as const, id: s.id, name: s.nameAr, price: s.price, sub: `${s.minutes} د`, stock: Infinity }));
    const prods = products.filter((p) => (t ? p.name.toLowerCase().includes(t) || p.barcode === t || p.code.toLowerCase() === t : p.category === cat))
      .map((p) => ({ kind: "product" as const, id: p.id, name: p.name, price: p.sellPrice ?? 0, sub: `متوفر ${p.qty} ${p.unit}`, stock: p.qty }));
    const svcs = t ? db.services.filter((s) => s.active && s.nameAr.includes(t)).map((s) => ({ kind: "service" as const, id: s.id, name: s.nameAr, price: s.price, sub: "خدمة", stock: Infinity })) : [];
    return [...svcs, ...prods];
  }, [cat, q, db, products]);

  const add = (kind: "service" | "product", id: string, name: string, price: number, stock: number) => {
    setCart((c) => {
      const ex = c.find((l) => l.refId === id);
      if (ex) { if (ex.qty + 1 > stock) { alert("الكمية في المخزون غير كافية"); return c; } return c.map((l) => (l === ex ? { ...l, qty: l.qty + 1 } : l)); }
      if (stock < 1) { alert("نفد من المخزون"); return c; }
      return [...c, { kind, refId: id, name, price, qty: 1 }];
    });
  };
  const scan = (code: string) => {
    const p = products.find((x) => x.barcode === code || x.code === code);
    if (p) add("product", p.id, p.name, p.sellPrice ?? 0, p.qty); else alert("لم يتم العثور على منتج بهذا الباركود");
  };
  const setQty = (l: InvoiceLine, d: number) => {
    const stock = l.kind === "product" ? db.items.find((i) => i.id === l.refId)?.qty ?? 0 : Infinity;
    setCart((c) => c.map((x) => (x === l ? { ...x, qty: Math.max(1, Math.min(stock, x.qty + d)) } : x)));
  };

  const customer = db.customers.find((c) => c.id === customerId);
  const subtotal = cart.reduce((a, l) => a + l.qty * l.price, 0);
  const coupon = db.coupons.find((c) => c.code.toUpperCase() === couponCode.trim().toUpperCase() && c.active && c.used < c.maxUses && new Date(c.expiresAt) >= new Date(new Date().toDateString()) && subtotal >= c.minTotal);
  const couponDisc = coupon ? (coupon.type === "pct" ? Math.round((subtotal * coupon.value) / 100) : coupon.value) : 0;
  const maxPct = session?.role === "cashier" ? 10 : 100;
  const manualDisc = Math.min(discount, Math.round((subtotal * maxPct) / 100));
  const pointValue = db.settings.pointValue ?? 100;
  const pts = Math.min(usePoints, customer?.points ?? 0);
  const pointsDisc = pts * pointValue;
  const totalDisc = Math.min(subtotal, couponDisc + manualDisc + pointsDisc);
  const tax = db.settings.taxEnabled ? Math.round(((subtotal - totalDisc) * db.settings.taxRate) / 100) : 0;
  const total = subtotal - totalDisc + tax;
  const hasOil = cart.some((l) => l.kind === "product" && OIL_CATS.includes(db.items.find((i) => i.id === l.refId)?.category ?? ""));

  const checkout = () => {
    if (!cart.length) return;
    if (!db.shifts.some((s) => !s.closedAt)) return alert("لا توجد وردية مفتوحة. افتح وردية أولاً.");
    if (method === "Credit" && !customer) return alert("البيع الآجل يتطلب اختيار عميل");
    if (method === "Cash" && received && received < total) return alert("المبلغ المستلم أقل من الإجمالي");
    if (hasOil && vehicleId && !km) return alert("أدخل عداد السيارة (كم) لتسجيل تبديل الزيت");
    const inv: Invoice = {
      id: newId(), code: nextCode(db, "INV", true), orderId: "", subtotal, discount: totalDisc, tax, total, method,
      cashier: session?.name ?? "", createdAt: new Date().toISOString(), lines: cart, customerId: customerId || undefined, vehicleId: vehicleId || undefined,
      couponCode: coupon?.code, pointsUsed: pts || undefined, paid: method === "Cash" ? received || total : total,
    };
    for (const l of cart) if (l.kind === "product") { const it = db.items.find((i) => i.id === l.refId); if (it) it.qty -= l.qty; }
    if (coupon) coupon.used += 1;
    if (customer) {
      customer.points = customer.points - pts + Math.floor((total / 1000) * (db.settings.pointsPer1000 ?? 1));
      if (method === "Credit") customer.balance += total;
    }
    if (hasOil && vehicleId) {
      db.oilChanges.unshift({ id: newId(), vehicleId, invoiceCode: inv.code, date: inv.createdAt, km, nextKm: km + (db.settings.oilIntervalKm ?? 5000),
        products: cart.filter((l) => l.kind === "product").map((l) => `${l.name} ×${l.qty}`).join("، ") });
    }
    db.invoices.push(inv);
    logAudit(db, user, "SALE", `${inv.code} ${total}`);
    saveDB(db);
    setLast(inv);
    setCart([]); setDiscount(0); setCouponCode(""); setUsePoints(0); setReceived(0); setKm(0);
    refresh();
    setTimeout(() => window.print(), 100);
  };

  const cats = ["الخدمات", ...PRODUCT_CATS];
  return (
    <AppLayout title="شاشة المبيعات">
      <div className="grid gap-4 xl:grid-cols-[1fr_400px]">
        {/* Catalog */}
        <div className="min-w-0 print:hidden">
          <div className="mb-3 flex flex-wrap gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute start-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم أو الرمز..." className={inputCls + " ps-9"} />
            </div>
            <div className="relative w-56">
              <ScanBarcode className="absolute start-3 top-2.5 h-4 w-4 text-primary" />
              <input ref={scanRef} placeholder="امسح الباركود + Enter" className={inputCls + " ps-9"} dir="ltr"
                onKeyDown={(e) => { if (e.key === "Enter" && e.currentTarget.value) { scan(e.currentTarget.value.trim()); e.currentTarget.value = ""; } }} />
            </div>
          </div>
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
            {cats.map((c) => (
              <button key={c} onClick={() => { setCat(c); setQ(""); }} className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium ${cat === c ? "bg-primary text-primary-foreground" : "border border-border bg-card hover:bg-muted"}`}>{c}</button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {tiles.map((t) => (
              <button key={t.id} onClick={() => add(t.kind, t.id, t.name, t.price, t.stock)} disabled={t.stock < 1}
                className="group flex min-h-[96px] flex-col justify-between rounded-xl border border-border bg-card p-3 text-start transition hover:border-primary hover:bg-primary/5 disabled:opacity-40">
                <div className="flex items-start gap-1.5 text-sm font-bold leading-tight">{t.kind === "product" ? <Droplets className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" /> : null}{t.name}</div>
                <div>
                  <div className="text-base font-bold text-primary">{fmt(t.price)}</div>
                  <div className={`text-xs ${t.stock <= 3 ? "text-destructive" : "text-muted-foreground"}`}>{t.sub}</div>
                </div>
              </button>
            ))}
            {!tiles.length && <div className="col-span-full rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">لا توجد أصناف هنا. أضف الزيوت وقطع الغيار من صفحة "الزيوت وقطع الغيار".</div>}
          </div>
        </div>

        {/* Cart */}
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 print:hidden xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto">
          <div className="grid grid-cols-2 gap-2">
            <label className="col-span-2 flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground" />
              <select className={inputCls} value={customerId} onChange={(e) => { setCustomerId(e.target.value); setVehicleId(""); setUsePoints(0); }}>
                <option value="">زبون نقدي</option>
                {db.customers.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>)}
              </select>
            </label>
            {customer && (
              <select className={inputCls + " col-span-2"} value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
                <option value="">— السيارة —</option>
                {db.vehicles.filter((v) => v.customerId === customerId).map((v) => <option key={v.id} value={v.id}>{v.make} {v.model} — {v.plate}</option>)}
              </select>
            )}
          </div>

          <div className="min-h-[120px] flex-1 divide-y divide-border">
            {cart.map((l) => (
              <div key={l.refId} className="flex items-center gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{l.name}</div>
                  <div className="text-xs text-muted-foreground">{fmt(l.price)} × {l.qty}</div>
                </div>
                <button onClick={() => setQty(l, -1)} className="rounded-md border border-border p-1"><Minus className="h-3 w-3" /></button>
                <span className="w-6 text-center text-sm font-bold">{l.qty}</span>
                <button onClick={() => setQty(l, 1)} className="rounded-md border border-border p-1"><Plus className="h-3 w-3" /></button>
                <span className="w-20 text-end text-sm font-bold">{fmt(l.qty * l.price)}</span>
                <button onClick={() => setCart((c) => c.filter((x) => x !== l))} className="text-destructive"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
            {!cart.length && <div className="py-10 text-center text-sm text-muted-foreground">السلة فارغة — اختر خدمة أو منتج</div>}
          </div>

          {hasOil && (
            <div className="rounded-lg border border-primary/40 bg-primary/5 p-2.5 text-sm">
              <div className="mb-1 flex items-center gap-1 font-bold"><Droplets className="h-4 w-4 text-primary" /> تبديل زيت</div>
              {vehicleId ? (
                <div className="flex items-center gap-2"><span>العداد الحالي (كم)</span><input type="number" min={0} className={inputCls + " w-32"} value={km || ""} onChange={(e) => setKm(+e.target.value)} />
                  {km > 0 && <span className="text-xs text-muted-foreground">القادم: {fmt(km + (db.settings.oilIntervalKm ?? 5000))}</span>}</div>
              ) : <div className="text-xs text-muted-foreground">اختر العميل والسيارة لحفظ سجل تبديل الزيت والتذكير بالموعد القادم.</div>}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 text-sm">
            <label className="flex items-center gap-1"><Tag className="h-4 w-4 text-muted-foreground" /><input placeholder="كوبون" className={inputCls} dir="ltr" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} /></label>
            <input type="number" min={0} placeholder={`خصم (حد ${maxPct}%)`} className={inputCls} value={discount || ""} onChange={(e) => setDiscount(+e.target.value)} />
            {couponCode && <div className={`col-span-2 text-xs ${coupon ? "text-primary" : "text-destructive"}`}>{coupon ? `كوبون صالح: −${fmt(couponDisc)}` : "كوبون غير صالح أو منتهي أو لم يبلغ الحد الأدنى"}</div>}
            {customer && customer.points > 0 && (
              <label className="col-span-2 flex items-center gap-2 text-xs"><Star className="h-4 w-4 text-primary" /> نقاط الولاء: {customer.points} (النقطة = {fmt(pointValue)})
                <input type="number" min={0} max={customer.points} className={inputCls + " w-24"} value={usePoints || ""} onChange={(e) => setUsePoints(+e.target.value)} placeholder="استبدال" /></label>
            )}
          </div>

          <div className="space-y-1 border-t border-border pt-2 text-sm">
            <div className="flex justify-between"><span>المجموع</span><span>{fmt(subtotal)}</span></div>
            {totalDisc > 0 && <div className="flex justify-between text-destructive"><span>الخصم</span><span>−{fmt(totalDisc)}</span></div>}
            {tax > 0 && <div className="flex justify-between"><span>الضريبة</span><span>{fmt(tax)}</span></div>}
            <div className="flex justify-between text-2xl font-bold"><span>الإجمالي</span><span className="text-primary">{fmt(total)}</span></div>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {METHODS.map(([v, l]) => <button key={v} onClick={() => setMethod(v)} className={`rounded-lg py-2 text-sm font-bold ${method === v ? "bg-primary text-primary-foreground" : "border border-border"}`}>{l}</button>)}
          </div>
          {method === "Cash" && (
            <div className="flex items-center gap-2 text-sm">
              <input type="number" min={0} placeholder="المبلغ المستلم" className={inputCls} value={received || ""} onChange={(e) => setReceived(+e.target.value)} />
              <span className="whitespace-nowrap font-bold">الباقي: {fmt(Math.max(0, received - total))}</span>
            </div>
          )}
          <button disabled={!cart.length} onClick={checkout} className={btnPrimary + " justify-center py-3.5 text-base"}><Printer className="h-5 w-5" /> دفع وطباعة ({fmt(total)})</button>
          {last && <button className={btnGhost + " justify-center"} onClick={() => window.print()}>إعادة طباعة {last.code}</button>}
        </div>
      </div>

      {last && (
        <div id="receipt-print" className="hidden print:block">
          <div className="text-center"><div className="text-base font-bold">{db.settings.businessName}</div>{db.settings.phone && <div>{db.settings.phone}</div>}{db.settings.address && <div>{db.settings.address}</div>}</div>
          <div className="my-1 border-t border-dashed" />
          <div>فاتورة: {last.code}</div><div>{new Date(last.createdAt).toLocaleString("ar-IQ")}</div><div>الكاشير: {last.cashier}</div>
          {last.customerId && <div>العميل: {db.customers.find((c) => c.id === last.customerId)?.name}</div>}
          <div className="my-1 border-t border-dashed" />
          {last.lines?.map((l, i) => <div key={i} className="flex justify-between"><span>{l.name} ×{l.qty}</span><span>{fmt(l.qty * l.price)}</span></div>)}
          <div className="my-1 border-t border-dashed" />
          <div className="flex justify-between"><span>المجموع</span><span>{fmt(last.subtotal)}</span></div>
          {last.discount > 0 && <div className="flex justify-between"><span>الخصم</span><span>{fmt(last.discount)}</span></div>}
          {last.tax > 0 && <div className="flex justify-between"><span>الضريبة</span><span>{fmt(last.tax)}</span></div>}
          <div className="flex justify-between text-sm font-bold"><span>الإجمالي</span><span>{fmt(last.total)} {db.settings.currency}</span></div>
          {last.paid && last.paid > last.total && <div className="flex justify-between"><span>المستلم / الباقي</span><span>{fmt(last.paid)} / {fmt(last.paid - last.total)}</span></div>}
          {(() => { const oc = db.oilChanges.find((o) => o.invoiceCode === last.code); return oc ? <div className="mt-1 font-bold">تبديل الزيت القادم عند: {fmt(oc.nextKm)} كم</div> : null; })()}
          <div className="mt-2 text-center">شكراً لزيارتكم</div>
        </div>
      )}
    </AppLayout>
  );
}
