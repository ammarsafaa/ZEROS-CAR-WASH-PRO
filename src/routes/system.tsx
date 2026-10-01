import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck, DatabaseBackup, Network } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { requireAuth } from "./index";
import { UpdatePanel } from "@/components/UpdatePanel";
import { saveDB, logAudit, listBackups, makeAutoBackup, restoreAutoBackup, machineId, getLicense, activateLicense, trialDaysLeft, getSession } from "@/lib/db";
import { getSyncConfig, setSyncConfig, syncStatus, testConnection, pushNow, type SyncMode } from "@/lib/sync";
import { useDB, Field, Table, inputCls, btnPrimary, btnGhost, td } from "@/components/kit";

interface NativeLan { lanStart(): Promise<{ ok: boolean; ips?: string[]; port?: number; error?: string }>; lanStop(): Promise<{ ok: boolean }>; lanStatus(): Promise<{ running: boolean; ips: string[]; port: number }>; }
const native = (): (NativeLan & Record<string, unknown>) | null => (window as unknown as { cwpNative?: NativeLan }).cwpNative ?? null;

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
        <NetworkSection isAdmin={isAdmin} user={user} db={db} />
        <UpdatePanel />
      </div>
    </AppLayout>
  );
}

function NetworkSection({ isAdmin, user, db }: { isAdmin: boolean; user: string; db: ReturnType<typeof useDB>[0] }) {
  const [mode, setMode] = useState<SyncMode>("off");
  const [url, setUrl] = useState("");
  const [ips, setIps] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState(syncStatus());
  const isDesktop = !!native();

  useEffect(() => {
    const cfg = getSyncConfig();
    setMode(cfg.mode);
    setUrl(cfg.url || "");
    void native()?.lanStatus().then((s) => { setRunning(s.running); setIps(s.ips); });
    const t = setInterval(() => setStatus(syncStatus()), 3000);
    return () => clearInterval(t);
  }, []);

  const enableServer = async () => {
    const n = native();
    if (!n) return alert("وضع الجهاز الرئيسي يعمل فقط من نسخة سطح المكتب");
    const r = await n.lanStart();
    if (!r.ok) return alert("تعذر تشغيل الشبكة: " + (r.error || ""));
    setRunning(true); setIps(r.ips || []);
    setSyncConfig({ mode: "server" }); setMode("server");
    logAudit(db, user, "LAN_SERVER_ON", "تفعيل وضع الجهاز الرئيسي"); saveDB(db);
    void pushNow();
  };
  const disable = async () => {
    if (mode === "server") await native()?.lanStop();
    setSyncConfig({ mode: "off" }); setMode("off"); setRunning(false);
    logAudit(db, user, "LAN_OFF", "إيقاف الربط الشبكي"); saveDB(db);
  };
  const connectClient = async () => {
    const u = url.trim().replace(/\/+$/, "");
    if (!u) return alert("أدخل عنوان الجهاز الرئيسي");
    const full = u.startsWith("http") ? u : `http://${u}`;
    if (!(await testConnection(full))) return alert("تعذر الاتصال بالجهاز الرئيسي — تأكد من العنوان وأن الجهازين على نفس الشبكة");
    setSyncConfig({ mode: "client", url: full }); setMode("client");
    logAudit(db, user, "LAN_CLIENT_ON", full); saveDB(db);
    setTimeout(() => location.reload(), 800);
  };

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-5 lg:col-span-2">
      <h2 className="flex items-center gap-2 font-bold"><Network className="h-5 w-5 text-primary" /> الربط بين الأجهزة (شبكة محلية)</h2>
      <p className="text-sm text-muted-foreground">
        لمشاركة نفس البيانات بين عدة أجهزة: جهاز واحد يكون <b>رئيسي</b> (يخزن البيانات)، وباقي الأجهزة تفتح البرنامج من المتصفح عبر عنوانه — بدون إنترنت، فقط راوتر مشترك.
      </p>
      {mode === "off" && (
        <div className="flex flex-wrap items-end gap-4">
          {isDesktop && isAdmin && (
            <button className={btnPrimary} onClick={() => void enableServer()}>تفعيل هذا الجهاز كجهاز رئيسي</button>
          )}
          <div className="flex items-end gap-2">
            <Field label="عنوان الجهاز الرئيسي (للأجهزة الفرعية)">
              <input dir="ltr" placeholder="192.168.1.10:8787" className={inputCls + " w-56 font-mono"} value={url} onChange={(e) => setUrl(e.target.value)} />
            </Field>
            <button className={btnPrimary} onClick={() => void connectClient()}>اتصال كجهاز فرعي</button>
          </div>
        </div>
      )}
      {mode === "server" && (
        <div className="space-y-2">
          <div className="rounded-lg bg-primary/10 p-3 text-sm"><b className="text-primary">هذا الجهاز هو الرئيسي</b> — الأجهزة الأخرى تفتح أحد هذه العناوين بالمتصفح:</div>
          {ips.map((ip) => (
            <div key={ip} dir="ltr" className="w-fit rounded-lg border border-border bg-muted px-3 py-2 font-mono text-sm font-bold">http://{ip}:8787</div>
          ))}
          <div className="text-xs text-muted-foreground">آخر مزامنة: {status.lastSyncAt ? new Date(status.lastSyncAt).toLocaleTimeString("ar-IQ") : "—"} {status.lastError && <span className="text-destructive">— خطأ: {status.lastError}</span>}</div>
          {isAdmin && <button className={btnGhost} onClick={() => void disable()}>إيقاف الوضع الرئيسي</button>}
        </div>
      )}
      {mode === "client" && (
        <div className="space-y-2">
          <div className="rounded-lg bg-primary/10 p-3 text-sm"><b className="text-primary">هذا الجهاز فرعي</b> — متصل بالجهاز الرئيسي: <span dir="ltr" className="font-mono">{getSyncConfig().url}</span></div>
          <div className="text-xs text-muted-foreground">آخر مزامنة: {status.lastSyncAt ? new Date(status.lastSyncAt).toLocaleTimeString("ar-IQ") : "—"} {status.lastError && <span className="text-destructive">— خطأ: {status.lastError}</span>}</div>
          <button className={btnGhost} onClick={() => void disable()}>فصل الاتصال</button>
        </div>
      )}
      {!isDesktop && mode === "off" && (
        <p className="text-xs text-muted-foreground">ملاحظة: هذا الجهاز يعمل بالمتصفح، لذا يمكنه الاتصال كجهاز فرعي فقط. الجهاز الرئيسي يجب أن يشغّل نسخة سطح المكتب.</p>
      )}
    </section>
  );
}
