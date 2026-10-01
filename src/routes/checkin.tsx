import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { requireAuth } from "./index";
import { getDB, saveDB, nextCode, newId, logAudit, getSession, fmt } from "@/lib/db";

export const Route = createFileRoute("/checkin")({
  beforeLoad: () => requireAuth(),
  head: () => ({
    meta: [
      { title: "استقبال سيارة — ZEROS CAR WASH PRO" },
      { name: "description", content: "تسجيل دخول سيارة جديدة واختيار الخدمات" },
    ],
  }),
  component: CheckInPage,
});

function CheckInPage() {
  const navigate = useNavigate();
  const db = useMemo(() => getDB(), []);
  const [customerId, setCustomerId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [done, setDone] = useState<string | null>(null);
  const session = getSession();

  const customerVehicles = db.vehicles.filter((v) => v.customerId === customerId);
  const vehicle = db.vehicles.find((v) => v.id === vehicleId);
  const services = db.services.filter((s) => s.active);
  const total = services.filter((s) => selected.has(s.id)).reduce((sum, s) => sum + s.price, 0);
  const estMinutes = services.filter((s) => selected.has(s.id)).reduce((sum, s) => sum + s.minutes, 0);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const submit = () => {
    if (!customerId || !vehicleId || selected.size === 0) return;
    const items = services
      .filter((s) => selected.has(s.id))
      .map((s) => ({ serviceId: s.id, name: s.nameAr, price: s.price }));
    const now = new Date().toISOString();
    const order = {
      id: newId(),
      code: nextCode(db, "CW", true),
      customerId,
      vehicleId,
      items,
      total,
      status: "WAITING" as const,
      createdAt: now,
      history: [{ status: "WAITING" as const, at: now }],
    };
    db.orders.push(order);
    logAudit(db, session?.username ?? "?", "NEW_ORDER", order.code);
    saveDB(db);
    setDone(order.code);
  };

  if (done) {
    return (
      <AppLayout title="استقبال سيارة">
        <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 text-center">
          <CheckCircle2 className="mx-auto mb-4 h-14 w-14 text-success" />
          <h2 className="text-xl font-bold">تم استقبال السيارة</h2>
          <p className="mt-2 font-mono text-lg text-primary" dir="ltr">{done}</p>
          <p className="mt-1 text-sm text-muted-foreground">الحالة: بانتظار الدور</p>
          <div className="mt-6 flex gap-3">
            <button onClick={() => { setDone(null); setSelected(new Set()); setVehicleId(""); }} className="flex-1 rounded-lg border border-border py-2.5 text-sm font-bold hover:bg-muted">
              سيارة أخرى
            </button>
            <button onClick={() => navigate({ to: "/queue" })} className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90">
              عرض الطابور
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="استقبال سيارة — CAR CHECK-IN">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          <div className="rounded-xl border border-border bg-card p-5">
            <label className="mb-1.5 block text-sm font-bold">1. العميل</label>
            <select
              value={customerId}
              onChange={(e) => { setCustomerId(e.target.value); setVehicleId(""); }}
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
            >
              <option value="">اختر العميل...</option>
              {db.customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>
              ))}
            </select>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <label className="mb-1.5 block text-sm font-bold">2. السيارة</label>
            <select
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              disabled={!customerId}
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm disabled:opacity-50"
            >
              <option value="">اختر السيارة...</option>
              {customerVehicles.map((v) => (
                <option key={v.id} value={v.id}>{v.make} {v.model} — {v.plate}</option>
              ))}
            </select>
            {vehicle && (
              <div className="mt-3 rounded-lg bg-muted p-3 text-sm">
                <div className="font-bold">{vehicle.make} {vehicle.model} {vehicle.year}</div>
                <div className="text-muted-foreground">{vehicle.color} • لوحة: <span className="font-mono">{vehicle.plate}</span></div>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">الوقت التقديري</span>
              <span className="font-bold">{estMinutes} دقيقة</span>
            </div>
            <div className="mt-2 flex justify-between">
              <span className="text-muted-foreground">الإجمالي</span>
              <span className="text-lg font-bold text-primary">{fmt(total)} {db.settings.currency}</span>
            </div>
            <button
              onClick={submit}
              disabled={!customerId || !vehicleId || selected.size === 0}
              className="mt-4 w-full rounded-lg bg-primary py-3 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-40"
            >
              تسجيل الدخول — CHECK-IN
            </button>
          </div>
        </div>

        <div className="lg:col-span-2">
          <h3 className="mb-3 text-sm font-bold">3. اختر الخدمات</h3>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {services.map((s) => {
              const on = selected.has(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => toggle(s.id)}
                  className={`rounded-xl border p-4 text-start transition-colors ${
                    on ? "border-primary bg-accent" : "border-border bg-card hover:bg-muted"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold">{s.nameAr}</span>
                    {on && <CheckCircle2 className="h-5 w-5 text-primary" />}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{s.category} • {s.minutes} د</div>
                  <div className="mt-2 font-bold text-primary">{fmt(s.price)}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
