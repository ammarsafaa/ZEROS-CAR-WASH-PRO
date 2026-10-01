import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Pencil, KeyRound } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { requireAuth } from "./index";
import { newId, logAudit, saveDB, hashPassword, getSession, ROLE_LABEL, ROLE_ROUTES, type Role, type User } from "@/lib/db";
import { useDB, Modal, Field, Table, inputCls, btnPrimary, btnGhost, td } from "@/components/kit";

export const Route = createFileRoute("/users")({
  beforeLoad: () => requireAuth(),
  head: () => ({ meta: [{ title: "المستخدمون والصلاحيات — ZEROS CAR WASH PRO" }, { name: "description", content: "إدارة حسابات الموظفين وأدوارهم" }] }),
  component: UsersPage,
});

const ROLES = Object.keys(ROLE_LABEL) as Role[];

function UsersPage() {
  const [db, refresh, user] = useDB();
  const me = getSession();
  const [f, setF] = useState<{ edit: User | null; username: string; name: string; role: Role; password: string } | null>(null);

  const save = () => {
    const x = f!;
    if (!x.edit && db.users.some((u) => u.username === x.username)) return alert("اسم المستخدم موجود");
    if (!x.edit && x.password.length < 4) return alert("كلمة المرور 4 أحرف على الأقل");
    if (x.edit) {
      if (x.edit.id === me?.userId && x.role !== "admin") return alert("لا يمكنك إزالة صلاحية المدير عن نفسك");
      Object.assign(x.edit, { name: x.name, role: x.role });
      if (x.password) x.edit.passwordHash = hashPassword(x.password);
    } else db.users.push({ id: newId(), username: x.username.trim(), name: x.name, role: x.role, passwordHash: hashPassword(x.password), active: true });
    logAudit(db, user, x.edit ? "EDIT_USER" : "ADD_USER", `${x.username} (${x.role})`); saveDB(db); setF(null); refresh();
  };
  const toggle = (u: User) => {
    if (u.id === me?.userId) return alert("لا يمكنك إيقاف حسابك");
    if (u.active && u.role === "admin" && db.users.filter((x) => x.role === "admin" && x.active).length < 2) return alert("يجب بقاء مدير نظام واحد فعّال على الأقل");
    u.active = !u.active; logAudit(db, user, "TOGGLE_USER", u.username); saveDB(db); refresh();
  };

  return (
    <AppLayout title="المستخدمون والصلاحيات">
      <div className="mb-3 flex justify-end"><button className={btnPrimary} onClick={() => setF({ edit: null, username: "", name: "", role: "cashier", password: "" })}><Plus className="h-4 w-4" /> مستخدم جديد</button></div>
      <Table head={["اسم المستخدم", "الاسم", "الدور", "الحالة", ""]}>
        {db.users.map((u) => (
          <tr key={u.id} className={u.active ? "" : "opacity-50"}>
            <td className={td + " font-mono font-bold"} dir="ltr">{u.username}</td>
            <td className={td}>{u.name}</td>
            <td className={td}><span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-bold text-primary">{ROLE_LABEL[u.role]}</span></td>
            <td className={td}><button className={btnGhost} onClick={() => toggle(u)}>{u.active ? "فعّال" : "موقوف"}</button></td>
            <td className={td}><button className={btnGhost} onClick={() => setF({ edit: u, username: u.username, name: u.name, role: u.role, password: "" })}><Pencil className="h-3.5 w-3.5" /> <KeyRound className="h-3.5 w-3.5" /></button></td>
          </tr>
        ))}
      </Table>
      <h3 className="mb-2 mt-6 font-bold">صلاحيات الأدوار</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {ROLES.map((r) => (
          <div key={r} className="rounded-xl border border-border bg-card p-3 text-xs">
            <div className="mb-1 text-sm font-bold">{ROLE_LABEL[r]}</div>
            <div className="text-muted-foreground">{ROLE_ROUTES[r].includes("*") ? "كل الأقسام" : `${ROLE_ROUTES[r].length} قسم`}</div>
            {r === "cashier" && <div className="mt-1">خصم حتى 10% فقط • لا يلغي الفواتير</div>}
          </div>
        ))}
      </div>
      {f && (
        <Modal title={f.edit ? "تعديل مستخدم" : "مستخدم جديد"} onClose={() => setF(null)} onSubmit={save}>
          <Field label="اسم المستخدم"><input required disabled={!!f.edit} dir="ltr" className={inputCls} value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} /></Field>
          <Field label="الاسم الكامل"><input required className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="الدور"><select className={inputCls} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></Field>
          <Field label={f.edit ? "كلمة مرور جديدة (اتركها فارغة للإبقاء)" : "كلمة المرور"}><input type="password" className={inputCls} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
        </Modal>
      )}
    </AppLayout>
  );
}
