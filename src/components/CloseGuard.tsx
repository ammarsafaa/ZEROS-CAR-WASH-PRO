import { useEffect, useState } from "react";
import { getDB, makeAutoBackup, getSession, logAudit, saveDB } from "@/lib/db";

type Native = {
  onCloseRequest?: (cb: () => void) => () => void;
  confirmQuit?: () => void;
  backupWriteFile?: (json: string) => Promise<{ ok: boolean; file?: string; error?: string }>;
};
const native = (): Native | undefined => (typeof window !== "undefined" ? (window as unknown as { cwpNative?: Native }).cwpNative : undefined);

/** Desktop: confirm close, then take a mandatory backup (in-app + folder) before quitting. */
export function CloseGuard() {
  const [step, setStep] = useState<"idle" | "ask" | "working" | "failed">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    const n = native();
    if (n?.onCloseRequest) return n.onCloseRequest(() => setStep((s) => (s === "idle" ? "ask" : s)));
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, []);

  const backupAndQuit = async () => {
    setStep("working");
    try {
      const db = getDB();
      const s = getSession();
      if (s) logAudit(db, s.username, "APP_CLOSE", "إغلاق البرنامج مع نسخة احتياطية");
      makeAutoBackup(db);
      const r = await native()?.backupWriteFile?.(JSON.stringify(db));
      if (r && !r.ok) throw new Error(r.error || "تعذر حفظ الملف");
      await new Promise((res) => setTimeout(res, 900)); // let pending SQL sync push
      native()?.confirmQuit?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStep("failed");
    }
  };
  const quitAnyway = () => { const db = getDB(); const s = getSession(); if (s) { logAudit(db, s.username, "APP_CLOSE_NO_BACKUP", error); saveDB(db); } setTimeout(() => native()?.confirmQuit?.(), 600); };

  if (step === "idle") return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-6 text-center shadow-xl">
        {step === "ask" && (<>
          <h2 className="text-lg font-bold">هل تريد إغلاق البرنامج؟</h2>
          <p className="text-sm text-muted-foreground">سيتم أخذ نسخة احتياطية إجبارية قبل الإغلاق.</p>
          <div className="flex justify-center gap-2">
            <button className="rounded-lg bg-primary px-5 py-2 text-sm font-bold text-primary-foreground" onClick={backupAndQuit}>إغلاق</button>
            <button className="rounded-lg border border-border px-5 py-2 text-sm" onClick={() => setStep("idle")}>إلغاء</button>
          </div>
        </>)}
        {step === "working" && <p className="font-bold">جارٍ أخذ النسخة الاحتياطية...</p>}
        {step === "failed" && (<>
          <h2 className="text-lg font-bold text-destructive">فشلت النسخة الاحتياطية</h2>
          <p className="text-sm text-muted-foreground" dir="auto">{error}</p>
          <div className="flex justify-center gap-2">
            <button className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground" onClick={backupAndQuit}>حاول مرة ثانية</button>
            <button className="rounded-lg border border-border px-4 py-2 text-sm" onClick={quitAnyway}>إغلاق بدون نسخة</button>
          </div>
        </>)}
      </div>
    </div>
  );
}
