import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Search, Pencil, Trash2, X } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { requireAuth } from "./index";
import { getDB, saveDB, nextCode, newId, logAudit, getSession, type Vehicle } from "@/lib/db";

export const Route = createFileRoute("/vehicles")({
  beforeLoad: () => requireAuth(),
  head: () => ({
    meta: [
      { title: "السيارات — CAR WASH PRO" },
      { name: "description", content: "إدارة سيارات العملاء: إضافة، تعديل، بحث باللوحة" },
    ],
  }),
  component: VehiclesPage,
});

const TYPES = ["Sedan", "SUV", "Pickup", "Van", "Truck", "Motorcycle", "Other"];
const empty = { customerId: "", plate: "", make: "", model: "", year: "", color: "", type: "Sedan", notes: "" };

function VehiclesPage() {
  const [, setVersion] = useState(0);
  const db = useMemo(() => getDB(), []);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [form, setForm] = useState(empty);
  const session = getSession();
  const refresh = () => setVersion((v) => v + 1);

  const customerName = (id: string) => db.customers.find((c) => c.id === id)?.name ?? "—";

  const rows = db.vehicles.filter(
    (v) =>
      v.plate.includes(search) ||
      v.make.includes(search) ||
      v.model.includes(search) ||
      customerName(v.customerId).includes(search),
  );

  const openAdd = () => {
    setEditing(null);
    setForm({ ...empty, customerId: db.customers[0]?.id ?? "" });
    setShowForm(true);
  };
  const openEdit = (v: Vehicle) => {
    setEditing(v);
    setForm({
      customerId: v.customerId, plate: v.plate, make: v.make, model: v.model,
      year: v.year ?? "", color: v.color ?? "", type: v.type, notes: v.notes ?? "",
    });
    setShowForm(true);
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) {
      Object.assign(editing, form);
      logAudit(db, session?.username ?? "?", "EDIT_VEHICLE", editing.code);
    } else {
      db.vehicles.push({ id: newId(), code: nextCode(db, "CAR"), ...form });
      logAudit(db, session?.username ?? "?", "ADD_VEHICLE", `${form.make} ${form.model} — ${form.plate}`);
    }
    saveDB(db);
    setShowForm(false);
    refresh();
  };

  const remove = (v: Vehicle) => {
    if (!confirm(`حذف السيارة "${v.plate}"؟`)) return;
    db.vehicles = db.vehicles.filter((x) => x.id !== v.id);
    logAudit(db, session?.username ?? "?", "DELETE_VEHICLE", `${v.code} — ${v.plate}`);
    saveDB(db);
    refresh();
  };

  return (
    <AppLayout title="السيارات">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث برقم اللوحة أو الموديل أو العميل..."
            className="w-full rounded-lg border border-input bg-card py-2.5 pe-3 ps-9 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90">
          <Plus className="h-4 w-4" /> سيارة جديدة
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="p-3 text-start">الرقم</th>
              <th className="p-3 text-start">اللوحة</th>
              <th className="p-3 text-start">السيارة</th>
              <th className="p-3 text-start">السنة</th>
              <th className="p-3 text-start">اللون</th>
              <th className="p-3 text-start">النوع</th>
              <th className="p-3 text-start">العميل</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">لا توجد سيارات مسجلة</td></tr>
            )}
            {rows.map((v) => (
              <tr key={v.id} className="border-b border-border/50 hover:bg-muted/40">
                <td className="p-3 font-mono text-xs">{v.code}</td>
                <td className="p-3 font-mono font-bold">{v.plate}</td>
                <td className="p-3">{v.make} {v.model}</td>
                <td className="p-3">{v.year || "—"}</td>
                <td className="p-3">{v.color || "—"}</td>
                <td className="p-3">{v.type}</td>
                <td className="p-3">{customerName(v.customerId)}</td>
                <td className="p-3">
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(v)} className="rounded p-1.5 hover:bg-muted"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => remove(v)} className="rounded p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowForm(false)}>
          <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="w-full max-w-md space-y-3 rounded-2xl border border-border bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">{editing ? "تعديل سيارة" : "سيارة جديدة"}</h2>
              <button type="button" onClick={() => setShowForm(false)}><X className="h-5 w-5" /></button>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">العميل</label>
              <select
                value={form.customerId}
                onChange={(e) => setForm({ ...form, customerId: e.target.value })}
                required
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="" disabled>اختر العميل...</option>
                {db.customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>
                ))}
              </select>
              {db.customers.length === 0 && (
                <p className="mt-1 text-xs text-destructive">أضف عميلاً أولاً من شاشة العملاء</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium">رقم اللوحة</label>
                <input value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value })} required className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">النوع</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
                  {TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">الشركة</label>
                <input value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} required placeholder="Toyota" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">الموديل</label>
                <input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} required placeholder="Camry" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">السنة</label>
                <input value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">اللون</label>
                <input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
              </div>
            </div>
            <button className="w-full rounded-lg bg-primary py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90">
              {editing ? "حفظ التعديلات" : "إضافة السيارة"}
            </button>
          </form>
        </div>
      )}
    </AppLayout>
  );
}
