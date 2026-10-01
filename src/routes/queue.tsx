import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Play, Pause, CheckCheck, XCircle } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { requireAuth } from "./index";
import { getDB, saveDB, logAudit, getSession, fmt, type Order, type OrderStatus } from "@/lib/db";

export const Route = createFileRoute("/queue")({
  beforeLoad: () => requireAuth(),
  head: () => ({
    meta: [
      { title: "طابور السيارات — CAR WASH PRO" },
      { name: "description", content: "متابعة حالات السيارات: انتظار، غسيل، فحص، جاهز" },
    ],
  }),
  component: QueuePage,
});

const STATUS: Record<OrderStatus, { ar: string; cls: string }> = {
  WAITING: { ar: "بانتظار", cls: "bg-warning/15 text-warning" },
  IN_WASH: { ar: "قيد الغسيل", cls: "bg-info/15 text-info" },
  DETAILING: { ar: "تنظيف تفصيلي", cls: "bg-info/15 text-info" },
  QUALITY: { ar: "فحص الجودة", cls: "bg-accent text-accent-foreground" },
  READY: { ar: "جاهزة", cls: "bg-success/15 text-success" },
  DELIVERED: { ar: "تم التسليم", cls: "bg-muted text-muted-foreground" },
  CANCELLED: { ar: "ملغي", cls: "bg-destructive/15 text-destructive" },
};

const NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
  WAITING: "IN_WASH",
  IN_WASH: "QUALITY",
  QUALITY: "READY",
  READY: "DELIVERED",
};

function QueuePage() {
  const [, setVersion] = useState(0);
  const db = useMemo(() => getDB(), []);
  const session = getSession();
  const refresh = () => setVersion((v) => v + 1);

  useEffect(() => {
    const t = setInterval(refresh, 30000);
    return () => clearInterval(t);
  }, []);

  const active = db.orders.filter((o) => o.status !== "DELIVERED" && o.status !== "CANCELLED");

  const vehicle = (o: Order) => db.vehicles.find((v) => v.id === o.vehicleId);
  const customer = (o: Order) => db.customers.find((c) => c.id === o.customerId);

  const elapsed = (iso: string) => {
    const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    return m < 60 ? `${m} د` : `${Math.floor(m / 60)}س ${m % 60}د`;
  };

  const advance = (o: Order) => {
    const next = NEXT[o.status];
    if (!next) return;
    o.status = next;
    o.history.push({ status: next, at: new Date().toISOString() });
    logAudit(db, session?.username ?? "?", "ORDER_STATUS", `${o.code} → ${next}`);
    saveDB(db);
    refresh();
  };

  const cancel = (o: Order) => {
    const reason = prompt(`سبب إلغاء الطلب ${o.code}؟`);
    if (reason === null) return;
    o.status = "CANCELLED";
    o.history.push({ status: "CANCELLED", at: new Date().toISOString() });
    logAudit(db, session?.username ?? "?", "CANCEL_ORDER", `${o.code} — ${reason}`);
    saveDB(db);
    refresh();
  };

  const nextLabel = (s: OrderStatus) =>
    ({ WAITING: "بدء الغسيل", IN_WASH: "فحص الجودة", QUALITY: "جاهزة", READY: "تسليم" })[s] ?? "";

  return (
    <AppLayout title="طابور السيارات">
      {active.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
          الطابور فارغ — لا توجد سيارات حالياً
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {active.map((o) => {
            const v = vehicle(o);
            const c = customer(o);
            const st = STATUS[o.status];
            return (
              <div key={o.id} className="rounded-xl border border-border bg-card p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-mono text-sm font-bold" dir="ltr">{o.code}</span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${st.cls}`}>{st.ar}</span>
                </div>
                <div className="text-sm">
                  <div className="font-bold">{v ? `${v.make} ${v.model}` : "—"} <span className="font-mono text-xs text-muted-foreground">{v?.plate}</span></div>
                  <div className="text-muted-foreground">{c?.name} • منذ {elapsed(o.createdAt)}</div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {o.items.map((it, i) => (
                    <span key={i} className="rounded bg-muted px-2 py-0.5 text-xs">{it.name}</span>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="font-bold text-primary">{fmt(o.total)}</span>
                  <div className="flex gap-1.5">
                    {NEXT[o.status] && (
                      <button onClick={() => advance(o)} className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90">
                        {o.status === "WAITING" ? <Play className="h-3.5 w-3.5" /> : o.status === "READY" ? <CheckCheck className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                        {nextLabel(o.status)}
                      </button>
                    )}
                    <button onClick={() => cancel(o)} className="rounded-lg border border-destructive/40 px-2.5 py-1.5 text-xs text-destructive hover:bg-destructive/10">
                      <XCircle className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
}
