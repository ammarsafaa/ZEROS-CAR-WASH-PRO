import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Search, Pencil, Trash2, X } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { requireAuth } from "./index";
import { getDB, saveDB, nextCode, newId, logAudit, getSession, fmt, type Customer } from "@/lib/db";

export const Route = createFileRoute("/customers")({
  beforeLoad: () => requireAuth(),
  head: () => ({
    meta: [
      { title: "العملاء — CAR WASH PRO" },
      { name: "description", content: "إدارة عملاء المغسلة: إضافة، تعديل، بحث" },
    ],
  }),
  component: CustomersPage,
});

const empty = { name: "", phone: "", address: "", notes: "" };

function CustomersPage() {
  const [, setVersion] = useState(0);
  const db = useMemo(() => getDB(), []);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState(empty);
  const session = getSession();

  const refresh = () => setVersion((v) => v + 1);

  const rows = db.customers.filter(
    (c) =>
      c.name.includes(search) || c.phone.includes(search) || c.code.includes(search),
  );

  const visits = (id: string) => db.orders.filter((o) => o.customerId === id && o.status !== "CANCELLED").length;
  const totalSpent = (id: string) =>
    db.invoices
      .filter((i) => !i.voided && db.orders.find((o) => o.id === i.orderId)?.customerId === id)
      .reduce((s, i) => s + i.total, 0);
  const lastVisit = (id: string) => {
    const os = db.orders.filter((o) => o.customerId === id).map((o) => o.createdAt).sort();
    return os.length ? new Date(os[os.length - 1]).toLocaleDateString("ar-IQ") : "—";
  };

  const openAdd = () => {
    setEditing(null);
    setForm(empty);
    setShowForm(true);
  };
  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({ name: c.name, phone: c.phone, address: c.address ?? "", notes: c.notes ?? "" });
    setShowForm(true);
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) {
      Object.assign(editing, form);
      logAudit(db, session?.username ?? "?", "EDIT_CUSTOMER", editing.code);
    } else {
      db.customers.push({
        id: newId(),
        code: nextCode(db, "CUS"),
        ...form,
        createdAt: new Date().toISOString(),
        points: 0,
        balance: 0,
      });
      logAudit(db, session?.username ?? "?", "ADD_CUSTOMER", form.name);
    }
    saveDB(db);
    setShowForm(false);
    refresh();
  };

  const remove = (c: Customer) => {
    if (!confirm(`حذف العميل "${c.name}"؟`)) return;
    db.customers = db.customers.filter((x) => x.id !== c.id);
    logAudit(db, session?.username ?? "?", "DELETE_CUSTOMER", `${c.code} — ${c.name}`);
    saveDB(db);
    refresh();
  };

  return (
    <AppLayout title="العملاء">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالاسم أو الهاتف أو الرقم..."
            className="w-full rounded-lg border border-input bg-card py-2.5 pe-3 ps-9 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90">
          <Plus className="h-4 w-4" /> عميل جديد
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-start text-xs text-muted-foreground">
              <th className="p-3 text-start">الرقم</th>
              <th className="p-3 text-start">الاسم</th>
              <th className="p-3 text-start">الهاتف</th>
              <th className="p-3 text-start">الزيارات</th>
              <th className="p-3 text-start">إجمالي الصرف</th>
              <th className="p-3 text-start">آخر زيارة</th>
              <th className="p-3 text-start">النقاط</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">لا يوجد عملاء — أضف أول عميل</td></tr>
            )}
            {rows.map((c) => (
              <tr key={c.id} className="border-b border-border/50 hover:bg-muted/40">
                <td className="p-3 font-mono text-xs">{c.code}</td>
                <td className="p-3 font-medium">{c.name}</td>
                <td className="p-3" dir="ltr">{c.phone}</td>
                <td className="p-3">{visits(c.id)}</td>
                <td className="p-3">{fmt(totalSpent(c.id))}</td>
                <td className="p-3">{lastVisit(c.id)}</td>
                <td className="p-3">{c.points}</td>
                <td className="p-3">
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(c)} className="rounded p-1.5 hover:bg-muted"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => remove(c)} className="rounded p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowForm(false)}>
          <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">{editing ? "تعديل عميل" : "عميل جديد"}</h2>
              <button type="button" onClick={() => setShowForm(false)}><X className="h-5 w-5" /></button>
            </div>
            {(["name", "phone", "address", "notes"] as const).map((f) => (
              <div key={f}>
                <label className="mb-1 block text-sm font-medium">
                  {{ name: "الاسم", phone: "الهاتف", address: "العنوان", notes: "ملاحظات" }[f]}
                </label>
                <input
                  value={form[f]}
                  onChange={(e) => setForm({ ...form, [f]: e.target.value })}
                  required={f === "name" || f === "phone"}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            ))}
            <button className="w-full rounded-lg bg-primary py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90">
              {editing ? "حفظ التعديلات" : "إضافة العميل"}
            </button>
          </form>
        </div>
      )}
    </AppLayout>
  );
}
