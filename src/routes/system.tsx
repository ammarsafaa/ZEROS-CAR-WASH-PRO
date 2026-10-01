import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck, DatabaseBackup, Network } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { requireAuth } from "./index";
import { UpdatePanel } from "@/components/UpdatePanel";
import { saveDB, logAudit, listBackups, makeAutoBackup, restoreAutoBackup, machineId, getLicense, activateLicense, trialDaysLeft, getSession } from "@/lib/db";
import { syncStatus, nativeSql } from "@/lib/sync";
import { SqlSetupForm } from "@/components/SqlGate";
import { useDB, Field, Table, inputCls, btnPrimary, btnGhost, td } from "@/components/kit";


export const Route = createFileRoute("/system")({
  beforeLoad: () => requireAuth(),
  head: () => ({ meta: [{ title: "النسخ الاحتياطي والترخيص — ZEROS CAR WASH PRO" }, { name: "description", content: "النسخ الاحتياطي التلقائي وتفعيل ترخيص البرنامج" }] }),
  component: SystemPage,
});

function SystemPage() {
  const [db, refresh, user] = useDB();
  const isAdmin = getSession()?.role === "admin";
  const [mid, setMid] = useState("");
  const [lic, setLic] = useState<ReturnType<typeof getLicense>>(null);
  const [days, setDays] = useState(30);
  const [key, setKey] = useState("");
  const [owner, setOwner] = useState("");
  const [backups, setBackups] = useState<{ at: string; size: number }[]>([]);
  useEffect(() => { setMid(machineId()); setLic(getLicense()); setDays(trialDaysLeft()); setBackups(listBackups()); }, []);

  const activate = () => {
    if (!activateLicense(key, owner)) return alert("مفتاح الترخيص غير صحيح لهذا الجهاز");
    setLic(getLicense()); logAudit(db, user, "LICENSE_ACTIVATED", owner); saveDB(db); alert("تم تفعيل البرنامج بنجاح");
  };

  return (
    <AppLayout title="النسخ الاحتياطي والترخيص">
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="space-y-3 rounded-xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 font-bold"><DatabaseBackup className="h-5 w-5 text-primary" /> النسخ الاحتياطي التلقائي</h2>
          <p className="text-sm text-muted-foreground">يأخذ البرنامج نسخة تلقائية عند أول تشغيل كل يوم وعند إغلاق اليوم، ويحتفظ بآخر 7 نسخ على هذا الجهاز. للحماية الكاملة صدّر نسخة لفلاشة من صفحة الإعدادات بشكل دوري.</p>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={!isAdmin} checked={db.settings.autoBackup !== false} onChange={(e) => { db.settings.autoBackup = e.target.checked; saveDB(db); refresh(); }} /> تفعيل النسخ التلقائي</label>
          <div className="text-sm">آخر نسخة: <b>{db.settings.lastBackupAt ? new Date(db.settings.lastBackupAt).toLocaleString("ar-IQ") : "—"}</b></div>
          <button className={btnPrimary} onClick={() => { makeAutoBackup(db); setBackups(listBackups()); refresh(); }}>نسخة الآن</button>
          <Table head={["التاريخ", "الحجم", ""]} empty={!backups.length}>
            {backups.map((b) => (
              <tr key={b.at}>
                <td className={td + " text-xs"}>{new Date(b.at).toLocaleString("ar-IQ")}</td>
                <td className={td + " text-xs"}>{Math.round(b.size / 1024)} KB</td>
                <td className={td}>{isAdmin && <button className={btnGhost} onClick={() => { if (!confirm("استعادة هذه النسخة؟ ستُستبدل البيانات الحالية.")) return; restoreAutoBackup(b.at); location.reload(); }}>استعادة</button>}</td>
              </tr>
            ))}
          </Table>
        </section>

        <section className="space-y-3 rounded-xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 font-bold"><ShieldCheck className="h-5 w-5 text-primary" /> ترخيص البرنامج</h2>
          {lic ? (
            <div className="rounded-lg bg-primary/10 p-3 text-sm"><b className="text-primary">البرنامج مفعّل</b><div>المالك: {lic.owner}</div><div>تاريخ التفعيل: {new Date(lic.at).toLocaleDateString("ar-IQ")}</div></div>
          ) : (
            <div className={`rounded-lg p-3 text-sm ${days > 0 ? "bg-muted" : "bg-destructive/15 text-destructive"}`}>{days > 0 ? `نسخة تجريبية — متبقي ${days} يوم` : "انتهت الفترة التجريبية — يرجى التفعيل"}</div>
          )}
          <Field label="رقم الجهاز (أرسله للمورّد للحصول على المفتاح)"><input readOnly dir="ltr" className={inputCls + " font-mono font-bold"} value={mid} onFocus={(e) => e.currentTarget.select()} /></Field>
          {!lic && (
            <>
              <Field label="اسم المغسلة / المالك"><input className={inputCls} value={owner} onChange={(e) => setOwner(e.target.value)} /></Field>
              <Field label="مفتاح الترخيص"><input dir="ltr" placeholder="XXXX-XXXX-XXXX-XXXX" className={inputCls + " font-mono"} value={key} onChange={(e) => setKey(e.target.value)} /></Field>
              <button className={btnPrimary} onClick={activate}>تفعيل</button>
            </>
          )}
        </section>
        <SqlSection isAdmin={isAdmin} />
        <UpdatePanel />
      </div>
    </AppLayout>
  );
}

function SqlSection({ isAdmin }: { isAdmin: boolean }) {
  const [info, setInfo] = useState<{ server?: string; instance?: string; database?: string } | null>(null);
  const [edit, setEdit] = useState(false);
  const [, tick] = useState(0);
  useEffect(() => { void nativeSql()?.sqlGetConfig().then((r) => setInfo(r.config)); const t = setInterval(() => tick((x) => x + 1), 3000); return () => clearInterval(t); }, [edit]);
  if (!nativeSql()) return null;
  const st = syncStatus();
  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <h2 className="flex items-center gap-2 font-bold"><Network className="h-4 w-4 text-primary" /> قاعدة البيانات (SQL Server)</h2>
      <div className="text-sm" dir="ltr">{info ? `${info.server}${info.instance ? "\\" + info.instance : ""} / ${info.database}` : "—"}</div>
      <div className={`rounded-lg p-2 text-sm ${st.lastError ? "bg-destructive/15 text-destructive" : "bg-muted"}`}>
        {st.lastError ? "خطأ بالاتصال: " + st.lastError : `متصل — آخر مزامنة ${st.lastSyncAt ? new Date(st.lastSyncAt).toLocaleTimeString() : "—"}`}
      </div>
      {isAdmin && (edit ? <SqlSetupForm onDone={() => setEdit(false)} /> : <button className={btnGhost} onClick={() => setEdit(true)}>تغيير إعدادات الاتصال</button>)}
    </section>
  );
}
