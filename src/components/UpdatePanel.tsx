import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

type UpdateStatus = { state: "available" | "none" | "downloading" | "ready" | "error"; version?: string; percent?: number; error?: string | undefined };
type CwpNative = {
  appVersion?: () => string;
  checkUpdate?: () => Promise<{ ok: boolean; error?: string }>;
  downloadUpdate?: () => Promise<{ ok: boolean }>;
  installUpdate?: () => void;
  onUpdateStatus?: (cb: (s: UpdateStatus) => void) => () => void;
};
const native = (): CwpNative | null => (typeof window !== "undefined" ? ((window as unknown as { cwpNative?: CwpNative }).cwpNative ?? null) : null);

export function UpdatePanel() {
  const [n, setN] = useState<CwpNative | null>(null);
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    const nn = native();
    setN(nn);
    setVersion(nn?.appVersion?.() ?? null);
    if (!nn?.onUpdateStatus) return;
    return nn.onUpdateStatus((s) => { setStatus(s); setChecking(false); });
  }, []);

  const check = async () => {
    if (!n?.checkUpdate) return;
    setChecking(true); setStatus(null);
    const r = await n.checkUpdate();
    if (!r.ok) { setChecking(false); setStatus({ state: "error", error: r.error }); }
  };

  let msg = "";
  if (checking) msg = "جارِ البحث عن تحديث...";
  else if (status?.state === "none") msg = "أنت تستخدم أحدث نسخة.";
  else if (status?.state === "available") msg = `يوجد تحديث جديد (النسخة ${status.version}).`;
  else if (status?.state === "downloading") msg = `جارِ التحميل... ${status.percent ?? 0}%`;
  else if (status?.state === "ready") msg = "تم تحميل التحديث. اضغط «تثبيت الآن» وسيُعاد تشغيل البرنامج.";
  else if (status?.state === "error") msg = "تعذّر التحديث. تأكد من اتصال الإنترنت ثم حاول مرة أخرى." + (status.error ? ` (${status.error})` : "");

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-5 lg:col-span-2">
      <h2 className="flex items-center gap-2 font-bold"><RefreshCw className="h-5 w-5 text-primary" /> تحديث البرنامج</h2>
      <p className="text-sm text-muted-foreground">النسخة الحالية: <b>{version ?? "معاينة المتصفح"}</b> — يحتاج الإنترنت وقت التحديث فقط، وبياناتك لا تتأثر.</p>
      {!n?.checkUpdate ? (
        <p className="text-sm text-muted-foreground">هذه الميزة تعمل في نسخة Windows فقط.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          {status?.state === "available" ? (
            <button onClick={() => n.downloadUpdate?.()} className="rounded-lg bg-primary px-5 py-2.5 font-bold text-primary-foreground">تحميل التحديث</button>
          ) : status?.state === "ready" ? (
            <button onClick={() => n.installUpdate?.()} className="rounded-lg bg-primary px-5 py-2.5 font-bold text-primary-foreground">تثبيت الآن</button>
          ) : (
            <button disabled={checking || status?.state === "downloading"} onClick={check} className="rounded-lg bg-primary px-5 py-2.5 font-bold text-primary-foreground disabled:opacity-50">البحث عن تحديث</button>
          )}
          {msg && <span className="text-sm font-semibold">{msg}</span>}
        </div>
      )}
    </section>
  );
}
