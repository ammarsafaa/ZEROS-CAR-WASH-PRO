import { useEffect, useState, type ReactNode } from "react";
import { Database } from "lucide-react";
import { bootSql, nativeSql, type SqlConfig } from "@/lib/sync";
import { Field, inputCls, btnPrimary, btnGhost } from "@/components/kit";

/** Desktop program: nothing opens until SQL Server is connected and the data is loaded. */
export function SqlGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"boot" | "ok" | "setup">("boot");
  const [error, setError] = useState("");

  useEffect(() => {
    void bootSql().then((r) => {
      if (r === "web" || r === "ok") setState("ok");
      else { if (r !== "setup") setError(r); setState("setup"); }
    });
  }, []);

  if (state === "ok") return <>{children}</>;
  if (state === "boot") return <div className="grid min-h-screen place-items-center text-muted-foreground">جاري الاتصال بـ SQL Server…</div>;
  return (
    <div className="grid min-h-screen place-items-center bg-background p-4" dir="rtl">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6">
        <SqlSetupForm initialError={error} onDone={() => setState("ok")} />
      </div>
    </div>
  );
}

export function SqlSetupForm({ initialError = "", onDone }: { initialError?: string; onDone: () => void }) {
  const [c, setC] = useState<SqlConfig>({ server: "localhost", instance: "SQLEXPRESS", port: "", database: "ZerosCarWash", auth: "windows", user: "", password: "" });
  const [msg, setMsg] = useState(initialError ? "تعذر الاتصال: " + initialError : "");
  const [busy, setBusy] = useState(false);
  const [advanced, setAdvanced] = useState(false);

  useEffect(() => {
    void nativeSql()?.sqlGetConfig().then((r) => { if (r.config) setC((p) => ({ ...p, ...r.config, password: "" })); });
  }, []);

  const set = (k: keyof SqlConfig) => (e: { target: { value: string } }) => setC({ ...c, [k]: e.target.value });

  async function test() {
    const n = nativeSql(); if (!n) return;
    setBusy(true); setMsg("");
    const r = await n.sqlTest(c);
    setBusy(false);
    setMsg(r.ok ? "✓ الاتصال ناجح — " + (r.version || "") : "✗ فشل الاتصال: " + r.error);
  }
  async function save() {
    setBusy(true); setMsg("");
    const r = await bootSql(c);
    setBusy(false);
    if (r === "ok" || r === "web") onDone(); else setMsg("✗ فشل الاتصال: " + r);
  }

  return (
    <div className="space-y-3">
      <h1 className="flex items-center gap-2 text-xl font-bold"><Database className="h-5 w-5 text-primary" /> الاتصال بـ SQL Server</h1>
      <p className="text-sm text-muted-foreground">جميع بيانات البرنامج تُحفظ في SQL Server. في الجهاز الرئيسي اكتب <b dir="ltr">localhost</b>، وفي الأجهزة الأخرى اكتب رقم IP الجهاز الرئيسي.</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="السيرفر (اسم أو IP)"><input dir="ltr" className={inputCls} value={c.server} onChange={set("server")} /></Field>
        <Field label="اسم قاعدة البيانات"><input dir="ltr" className={inputCls} value={c.database} onChange={set("database")} /></Field>
      </div>
      <Field label="نوع الاتصال">
        <select className={inputCls} value={c.auth} onChange={(e) => setC({ ...c, auth: e.target.value as SqlConfig["auth"] })}>
          <option value="windows">Windows — بدون اسم مستخدم وكلمة سر (الجهاز الرئيسي)</option>
          <option value="sql">SQL Server — باسم مستخدم وكلمة سر (للأجهزة الأخرى بالشبكة)</option>
        </select>
      </Field>
      {c.auth === "sql" && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="اسم المستخدم"><input dir="ltr" className={inputCls} value={c.user} onChange={set("user")} placeholder="sa" /></Field>
          <Field label="كلمة السر"><input dir="ltr" type="password" className={inputCls} value={c.password} onChange={set("password")} /></Field>
        </div>
      )}
      <button type="button" className="text-xs text-primary underline" onClick={() => setAdvanced(!advanced)}>{advanced ? "إخفاء الخيارات المتقدمة" : "خيارات متقدمة (النسخة والمنفذ)"}</button>
      {advanced && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="اسم النسخة (Instance)"><input dir="ltr" className={inputCls} value={c.instance} onChange={set("instance")} placeholder="SQLEXPRESS" /></Field>
          <Field label="المنفذ (اختياري)"><input dir="ltr" className={inputCls} value={c.port} onChange={set("port")} placeholder="1433" /></Field>
        </div>
      )}
      <p className="text-xs text-muted-foreground">الجهاز الرئيسي: اترك السيرفر <b dir="ltr">localhost</b> واختر اتصال Windows. الأجهزة الأخرى: اكتب رقم IP الجهاز الرئيسي واختر اتصال SQL Server. قاعدة البيانات تُنشأ تلقائياً إذا لم تكن موجودة.</p>
      {msg && <div className="rounded-lg bg-muted p-3 text-sm" dir="auto">{msg}</div>}
      <div className="flex gap-2">
        <button className={btnPrimary} disabled={busy} onClick={save}>حفظ واتصال</button>
        <button className={btnGhost} disabled={busy} onClick={test}>اختبار الاتصال</button>
      </div>
    </div>
  );
}
