import { X } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { getDB, getSession, type DB } from "@/lib/db";

export const inputCls = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm";
export const btnPrimary = "inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50";
export const btnGhost = "inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-muted";
export const btnDanger = "inline-flex items-center gap-1 rounded-lg border border-destructive/40 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10";

export function useDB(): [DB, () => void, string] {
  const [, setV] = useState(0);
  const db = useMemo(() => getDB(), []);
  return [db, () => setV((v) => v + 1), getSession()?.username ?? "?"];
}

export function Modal({ title, onClose, children, onSubmit, wide }: { title: string; onClose: () => void; children: ReactNode; onSubmit: (e: React.FormEvent) => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <form
        onSubmit={(e) => { e.preventDefault(); onSubmit(e); }}
        onClick={(e) => e.stopPropagation()}
        className={`max-h-[90vh] w-full overflow-y-auto ${wide ? "max-w-2xl" : "max-w-md"} space-y-3 rounded-2xl border border-border bg-card p-6 shadow-xl`}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-bold">{title}</h2>
          <button type="button" onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        {children}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className={btnGhost}>إلغاء</button>
          <button type="submit" className={btnPrimary}>حفظ</button>
        </div>
      </form>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: "good" | "bad" | undefined }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-bold ${tone === "good" ? "text-primary" : tone === "bad" ? "text-destructive" : ""}`}>{value}</div>
    </div>
  );
}

export function Table({ head, children, empty }: { head: string[]; children: ReactNode; empty?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs text-muted-foreground">
          <tr>{head.map((h) => <th key={h} className="px-3 py-2.5 text-start font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
      {empty && <div className="p-8 text-center text-sm text-muted-foreground">لا توجد بيانات</div>}
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (t: T) => void; tabs: [T, string][] }) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {tabs.map(([k, l]) => (
        <button key={k} onClick={() => onChange(k)} className={`rounded-lg px-4 py-2 text-sm font-medium ${value === k ? "bg-primary text-primary-foreground" : "border border-border bg-card hover:bg-muted"}`}>{l}</button>
      ))}
    </div>
  );
}

export function DateRange({ from, to, setFrom, setTo }: { from: string; to: string; setFrom: (s: string) => void; setTo: (s: string) => void }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span>من</span>
      <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls + " w-auto"} />
      <span>إلى</span>
      <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls + " w-auto"} />
    </div>
  );
}

export const td = "px-3 py-2.5";
