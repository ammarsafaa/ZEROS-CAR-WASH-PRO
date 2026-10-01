import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Download, Upload, Save } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { requireAuth } from "./index";
import { getDB, saveDB, logAudit, getSession, hashPassword, type DB } from "@/lib/db";

export const Route = createFileRoute("/settings")({
  beforeLoad: () => requireAuth(),
  head: () => ({
    meta: [
      { title: "الإعدادات — ZEROS CAR WASH PRO" },
      { name: "description", content: "إعدادات المغسلة والضريبة والنسخ الاحتياطي وسجل العمليات" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const db = useMemo(() => getDB(), []);
  const session = getSession();
  const [s, setS] = useState(db.settings);
  const [saved, setSaved] = useState(false);
  const [pw, setPw] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const isAdmin = session?.role === "admin" || session?.role === "manager";

  const save = () => {
    db.settings = s;
    logAudit(db, session?.username ?? "?", "SETTINGS", "تحديث الإعدادات");
    saveDB(db);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const backup = () => {
    const blob = new Blob([JSON.stringify(getDB(), null, 2)], { type: "application/json" });
    const d = new Date();
    const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}_${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `CarWash_${stamp}.json`;
    a.click();
    const cur = getDB();
    logAudit(cur, session?.username ?? "?", "BACKUP", a.download);
    saveDB(cur);
  };

  const restore = async (file: File) => {
    if (!confirm("استعادة النسخة ستستبدل كل البيانات الحالية. متابعة؟")) return;
    try {
      const data = JSON.parse(await file.text()) as DB;
      if (!data.users || !data.orders) throw new Error();
      logAudit(data, session?.username ?? "?", "RESTORE", file.name);
      saveDB(data);
      alert("تمت الاستعادة بنجاح");
      location.reload();
    } catch {
      alert("ملف النسخة غير صالح");
    }
  };

  const changePw = () => {
    if (pw.length < 6) return alert("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
    const u = db.users.find((x) => x.id === session?.userId);
    if (!u) return;
    u.passwordHash = hashPassword(pw);
    logAudit(db, u.username, "CHANGE_PASSWORD", "");
    saveDB(db);
    setPw("");
    alert("تم تغيير كلمة المرور");
  };

  const input = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm";

  return (
    <AppLayout title="الإعدادات">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 font-bold">معلومات المغسلة والفاتورة</h2>
          <div className="space-y-3">
            <div><label className="mb-1 block text-sm">اسم المغسلة</label><input className={input} value={s.businessName} onChange={(e) => setS({ ...s, businessName: e.target.value })} disabled={!isAdmin} /></div>
            <div><label className="mb-1 block text-sm">الهاتف</label><input className={input} value={s.phone} onChange={(e) => setS({ ...s, phone: e.target.value })} disabled={!isAdmin} /></div>
            <div><label className="mb-1 block text-sm">العنوان</label><input className={input} value={s.address} onChange={(e) => setS({ ...s, address: e.target.value })} disabled={!isAdmin} /></div>
            <div><label className="mb-1 block text-sm">العملة</label><input className={input} value={s.currency} onChange={(e) => setS({ ...s, currency: e.target.value })} disabled={!isAdmin} /></div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={s.taxEnabled} onChange={(e) => setS({ ...s, taxEnabled: e.target.checked })} disabled={!isAdmin} /> تفعيل الضريبة
            </label>
            {s.taxEnabled && (
              <div><label className="mb-1 block text-sm">نسبة الضريبة %</label><input type="number" className={input} value={s.taxRate} onChange={(e) => setS({ ...s, taxRate: +e.target.value })} disabled={!isAdmin} /></div>
            )}
            {isAdmin && (
              <button onClick={save} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
                <Save className="h-4 w-4" /> {saved ? "تم الحفظ ✓" : "حفظ"}
              </button>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-2 font-bold">النسخ الاحتياطي والاستعادة</h2>
            <p className="mb-4 text-sm text-muted-foreground">احفظ نسخة من كل بيانات المغسلة في ملف على جهازك أو فلاشة.</p>
            <div className="flex gap-3">
              <button onClick={backup} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
                <Download className="h-4 w-4" /> نسخة احتياطية
              </button>
              {isAdmin && (
                <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-bold hover:bg-muted">
                  <Upload className="h-4 w-4" /> استعادة
                </button>
              )}
              <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])} />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-3 font-bold">تغيير كلمة المرور</h2>
            <div className="flex gap-2">
              <input type="password" className={input} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="كلمة المرور الجديدة" />
              <button onClick={changePw} className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">تغيير</button>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card lg:col-span-2">
          <h2 className="border-b border-border p-4 font-bold">سجل العمليات (Audit Log)</h2>
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <tbody>
                {db.audit.slice(0, 100).map((a, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="p-2.5 text-xs text-muted-foreground">{new Date(a.at).toLocaleString("ar-IQ")}</td>
                    <td className="p-2.5">{a.user}</td>
                    <td className="p-2.5 font-mono text-xs">{a.action}</td>
                    <td className="p-2.5">{a.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
