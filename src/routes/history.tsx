import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search, Droplets, Receipt, Car, Ticket } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { requireAuth } from "./index";
import { fmt } from "@/lib/db";
import { useDB, Stat, inputCls } from "@/components/kit";

export const Route = createFileRoute("/history")({
  beforeLoad: () => requireAuth(),
  head: () => ({ meta: [{ title: "سجل السيارات — CAR WASH PRO" }, { name: "description", content: "السجل الكامل لكل سيارة: غسيل وزيوت وفواتير" }] }),
  component: HistoryPage,
});

const ST: Record<string, string> = { WAITING: "انتظار", IN_WASH: "غسيل", DETAILING: "تفصيلي", QUALITY: "فحص", READY: "جاهزة", DELIVERED: "مسلّمة", CANCELLED: "ملغاة" };

function HistoryPage() {
  const [db] = useDB();
  const [q, setQ] = useState("");
  const [vid, setVid] = useState("");
  const matches = q ? db.vehicles.filter((v) => v.plate.includes(q) || v.code.includes(q.toUpperCase()) || db.customers.find((c) => c.id === v.customerId)?.phone.includes(q)) : [];
  const v = db.vehicles.find((x) => x.id === vid);
  const c = db.customers.find((x) => x.id === v?.customerId);

  type Ev = { at: string; icon: typeof Car; title: string; detail: string; amount?: number };
  const events: Ev[] = [];
  if (v) {
    db.orders.filter((o) => o.vehicleId === v.id).forEach((o) => events.push({ at: o.createdAt, icon: Car, title: `طلب ${o.code} — ${ST[o.status]}`, detail: o.items.map((i) => i.name).join("، ") + (o.workerId ? ` • العامل: ${db.workers.find((w) => w.id === o.workerId)?.name ?? ""}` : ""), amount: o.total }));
    db.invoices.filter((i) => i.vehicleId === v.id && i.lines).forEach((i) => events.push({ at: i.createdAt, icon: Receipt, title: `فاتورة ${i.code}${i.voided ? " (ملغاة)" : ""}`, detail: i.lines!.map((l) => `${l.name} ×${l.qty}`).join("، "), amount: i.total }));
    db.oilChanges.filter((o) => o.vehicleId === v.id).forEach((o) => events.push({ at: o.date, icon: Droplets, title: `تبديل زيت عند ${fmt(o.km)} كم`, detail: `${o.products} • القادم: ${fmt(o.nextKm)} كم` }));
    db.subscriptions.filter((s) => s.vehicleId === v.id).forEach((s) => events.push({ at: s.startAt, icon: Ticket, title: `اشتراك ${db.packages.find((p) => p.id === s.packageId)?.name ?? ""}`, detail: `متبقي ${s.remaining} غسلة • ينتهي ${new Date(s.endAt).toLocaleDateString("ar-IQ")}` }));
  }
  events.sort((a, b) => b.at.localeCompare(a.at));
  const spent = events.reduce((a, e) => a + (e.amount ?? 0), 0);
  const lastOil = v && db.oilChanges.find((o) => o.vehicleId === v.id);

  return (
    <AppLayout title="سجل السيارات">
      <div className="relative mb-4 max-w-md">
        <Search className="absolute start-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <input autoFocus placeholder="رقم اللوحة أو رمز السيارة أو هاتف العميل" className={inputCls + " ps-9"} value={q} onChange={(e) => { setQ(e.target.value); setVid(""); }} />
        {!vid && matches.length > 0 && (
          <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
            {matches.slice(0, 8).map((m) => <button key={m.id} onClick={() => setVid(m.id)} className="block w-full px-3 py-2 text-start text-sm hover:bg-muted"><b className="font-mono">{m.plate}</b> — {m.make} {m.model} • {db.customers.find((x) => x.id === m.customerId)?.name}</button>)}
          </div>
        )}
      </div>
      {!v ? <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">ابحث عن سيارة لعرض سجلها الكامل</div> : (
        <>
          <div className="mb-4 rounded-xl border border-border bg-card p-4">
            <div className="text-xl font-bold">{v.make} {v.model} {v.year} <span className="font-mono text-primary">{v.plate}</span></div>
            <div className="text-sm text-muted-foreground">{v.code} • {v.color} • {v.type} • المالك: {c?.name} <span dir="ltr">{c?.phone}</span></div>
          </div>
          <div className="mb-5 grid gap-3 sm:grid-cols-4">
            <Stat label="عدد الزيارات" value={db.orders.filter((o) => o.vehicleId === v.id && o.status === "DELIVERED").length} />
            <Stat label="إجمالي الصرف" value={fmt(spent)} tone="good" />
            <Stat label="آخر زيارة" value={events[0] ? new Date(events[0].at).toLocaleDateString("ar-IQ") : "—"} />
            <Stat label="تبديل الزيت القادم" value={lastOil ? `${fmt(lastOil.nextKm)} كم` : "—"} />
          </div>
          <ol className="relative space-y-3 border-s-2 border-border ps-5">
            {events.map((e, i) => { const I = e.icon; return (
              <li key={i} className="relative">
                <span className="absolute -start-[31px] flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground"><I className="h-3.5 w-3.5" /></span>
                <div className="rounded-lg border border-border bg-card p-3">
                  <div className="flex justify-between gap-2"><span className="font-bold">{e.title}</span>{e.amount != null && <span className="font-bold text-primary">{fmt(e.amount)}</span>}</div>
                  <div className="text-xs text-muted-foreground">{new Date(e.at).toLocaleString("ar-IQ")} • {e.detail}</div>
                </div>
              </li>
            ); })}
            {!events.length && <li className="text-sm text-muted-foreground">لا توجد حركات لهذه السيارة بعد.</li>}
          </ol>
        </>
      )}
    </AppLayout>
  );
}
