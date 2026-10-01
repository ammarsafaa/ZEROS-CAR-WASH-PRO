import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { requireAuth } from "./index";
import { getDB, saveDB, newId, logAudit, getSession, fmt, type Service } from "@/lib/db";

export const Route = createFileRoute("/services")({
  beforeLoad: () => requireAuth(),
  head: () => ({
    meta: [
      { title: "الخدمات — CAR WASH PRO" },
      { name: "description", content: "إدارة خدمات الغسيل والتلميع والأسعار والعمولات" },
    ],
  }),
  component: ServicesPage,
});

const CATEGORIES = ["غسيل", "تنظيف", "تلميع", "محرك", "إطارات", "أخرى"];
const empty = { nameAr: "", nameEn: "", category: "غسيل", price: 0, cost: 0, minutes: 30, commission: 0 };

function ServicesPage() {
  const [, setVersion] = useState(0);
  const db = useMemo(() => getDB(), []);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState(empty);
  const [cat, setCat] = useState("الكل");
  const session = getSession();
  const refresh = () => setVersion((v) => v + 1);

  const rows = db.services.filter((s) => cat === "الكل" || s.category === cat);

  const openAdd = () => {
    setEditing(null);
    setForm(empty);
    setShowForm(true);
  };
  const openEdit = (s: Service) => {
    setEditing(s);
    setForm({ nameAr: s.nameAr, nameEn: s.nameEn, category: s.category, price: s.price, cost: s.cost, minutes: s.minutes, commission: s.commission });
    setShowForm(true);
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) {
      Object.assign(editing, form);
      logAudit(db, session?.username ?? "?", "EDIT_SERVICE", editing.nameAr);
    } else {
      db.services.push({ id: newId(), ...form, active: true });
      logAudit(db, session?.username ?? "?", "ADD_SERVICE", form.nameAr);
    }
    saveDB(db);
    setShowForm(false);
    refresh();
  };

  const toggleActive = (s: Service) => {
    s.active = !s.active;
    saveDB(db);
    refresh();
  };

  const remove = (s: Service) => {
    if (!confirm(`حذف الخدمة "${s.nameAr}"؟`)) return;
    db.services = db.services.filter((x) => x.id !== s.id);
    logAudit(db, session?.username ?? "?", "DELETE_SERVICE", s.nameAr);
    saveDB(db);
    refresh();
  };

  return (
    <AppLayout title="الخدمات">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {["الكل", ...CATEGORIES].map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${cat === c ? "bg-primary text-primary-foreground" : "border border-border bg-card hover:bg-muted"}`}
          >
            {c}
          </button>
        ))}
        <div className="flex-1" />
        <button onClick={openAdd} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90">
          <Plus className="h-4 w-4" /> خدمة جديدة
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {rows.map((s) => (
          <div key={s.id} className={`rounded-xl border border-border bg-card p-4 ${!s.active ? "opacity-50" : ""}`}>
            <div className="mb-1 flex items-start justify-between">
              <div>
                <div className="font-bold">{s.nameAr}</div>
                <div className="text-xs text-muted-foreground">{s.nameEn}</div>
              </div>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{s.category}</span>
            </div>
            <div className="mt-3 flex items-end justify-between">
              <div>
                <div className="text-lg font-bold text-primary">{fmt(s.price)} <span className="text-xs font-normal">{db.settings.currency}</span></div>
                <div className="text-xs text-muted-foreground">{s.minutes} دقيقة • عمولة {fmt(s.commission)}</div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => toggleActive(s)} className="rounded border border-border px-2 py-1 text-xs hover:bg-muted">
                  {s.active ? "إيقاف" : "تفعيل"}
                </button>
                <button onClick={() => openEdit(s)} className="rounded p-1.5 hover:bg-muted"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => remove(s)} className="rounded p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowForm(false)}>
          <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="w-full max-w-md space-y-3 rounded-2xl border border-border bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">{editing ? "تعديل خدمة" : "خدمة جديدة"}</h2>
              <button type="button" onClick={() => setShowForm(false)}><X className="h-5 w-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium">الاسم بالعربي</label>
                <input value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} required className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">الاسم بالإنجليزي</label>
                <input value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} dir="ltr" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">التصنيف</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">الوقت التقديري (دقيقة)</label>
                <input type="number" min={1} value={form.minutes} onChange={(e) => setForm({ ...form, minutes: +e.target.value })} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">السعر</label>
                <input type="number" min={0} value={form.price} onChange={(e) => setForm({ ...form, price: +e.target.value })} required className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">التكلفة</label>
                <input type="number" min={0} value={form.cost} onChange={(e) => setForm({ ...form, cost: +e.target.value })} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">عمولة العامل</label>
                <input type="number" min={0} value={form.commission} onChange={(e) => setForm({ ...form, commission: +e.target.value })} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
              </div>
            </div>
            <button className="w-full rounded-lg bg-primary py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90">
              {editing ? "حفظ التعديلات" : "إضافة الخدمة"}
            </button>
          </form>
        </div>
      )}
    </AppLayout>
  );
}
