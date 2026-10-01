import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Plus } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { requireAuth } from "./index";
import { newId, nextCode, logAudit, saveDB, todayStr, type Booking } from "@/lib/db";
import { useDB, Modal, Field, Table, inputCls, btnPrimary, btnGhost, btnDanger, td } from "@/components/kit";

export const Route = createFileRoute("/bookings")({
  beforeLoad: () => requireAuth(),
  head: () => ({ meta: [{ title: "الحجوزات — CAR WASH PRO" }, { name: "description", content: "حجز مواعيد الغسيل المسبقة" }] }),
  component: BookingsPage,
});

const ST: Record<Booking["status"], [string, string]> = {
  PENDING: ["بانتظار التأكيد", "bg-muted"],
  CONFIRMED: ["مؤكد", "bg-primary/20 text-primary"],
  DONE: ["تم الاستقبال", "bg-chart-2/20"],
  CANCELLED: ["ملغي", "bg-destructive/20 text-destructive"],
};

function BookingsPage() {
  const [db, refresh, user] = useDB();
  const navigate = useNavigate();
  const [day, setDay] = useState(todayStr());
  const [f, setF] = useState<{ customerName: string; phone: string; vehicle: string; serviceIds: string[]; date: string; notes: string } | null>(null);

  const rows = db.bookings.filter((b) => !day || b.date.slice(0, 10) === day).sort((a, b) => a.date.localeCompare(b.date));
  const save = () => {
    if (!f!.date) return alert("حدد الموعد");
    db.bookings.push({ id: newId(), code: nextCode(db, "BK", true), ...f!, status: "PENDING" });
    logAudit(db, user, "ADD_BOOKING", f!.customerName); saveDB(db); setF(null); refresh();
  };
  const setStatus = (b: Booking, s: Booking["status"]) => { b.status = s; logAudit(db, user, "BOOKING_" + s, b.code); saveDB(db); refresh(); };

  return (
    <AppLayout title="الحجوزات">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <span>اليوم</span>
          <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className={inputCls + " w-auto"} />
          <button className={btnGhost} onClick={() => setDay("")}>الكل</button>
        </div>
        <button className={btnPrimary} onClick={() => setF({ customerName: "", phone: "", vehicle: "", serviceIds: [], date: `${day || todayStr()}T10:00`, notes: "" })}><Plus className="h-4 w-4" /> حجز جديد</button>
      </div>
      <Table head={["الرمز", "الموعد", "العميل", "الهاتف", "السيارة", "الخدمات", "الحالة", ""]} empty={!rows.length}>
        {rows.map((b) => (
          <tr key={b.id}>
            <td className={td + " font-mono text-xs"} dir="ltr">{b.code}</td>
            <td className={td + " font-bold"} dir="ltr">{b.date.replace("T", " ")}</td>
            <td className={td}>{b.customerName}</td>
            <td className={td} dir="ltr">{b.phone}</td>
            <td className={td}>{b.vehicle}</td>
            <td className={td + " text-xs"}>{b.serviceIds.map((id) => db.services.find((s) => s.id === id)?.nameAr).join("، ")}</td>
            <td className={td}><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${ST[b.status][1]}`}>{ST[b.status][0]}</span></td>
            <td className={td}><div className="flex gap-1">
              {b.status === "PENDING" && <button className={btnGhost} onClick={() => setStatus(b, "CONFIRMED")}>تأكيد</button>}
              {(b.status === "PENDING" || b.status === "CONFIRMED") && <>
                <button className={btnGhost} onClick={() => { setStatus(b, "DONE"); navigate({ to: "/checkin" }); }}>استقبال</button>
                <button className={btnDanger} onClick={() => setStatus(b, "CANCELLED")}>إلغاء</button>
              </>}
            </div></td>
          </tr>
        ))}
      </Table>
      {f && (
        <Modal title="حجز جديد" onClose={() => setF(null)} onSubmit={save}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="اسم العميل"><input required className={inputCls} value={f.customerName} onChange={(e) => setF({ ...f, customerName: e.target.value })} /></Field>
            <Field label="الهاتف"><input required dir="ltr" className={inputCls} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
          </div>
          <Field label="السيارة (نوع / لوحة)"><input className={inputCls} value={f.vehicle} onChange={(e) => setF({ ...f, vehicle: e.target.value })} /></Field>
          <Field label="الموعد"><input type="datetime-local" required className={inputCls} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <div className="text-sm font-medium">الخدمات</div>
          <div className="flex flex-wrap gap-1.5">{db.services.filter((s) => s.active).map((s) => <button type="button" key={s.id} onClick={() => setF({ ...f, serviceIds: f.serviceIds.includes(s.id) ? f.serviceIds.filter((x) => x !== s.id) : [...f.serviceIds, s.id] })} className={`rounded-lg px-2.5 py-1 text-xs ${f.serviceIds.includes(s.id) ? "bg-primary text-primary-foreground" : "border border-border"}`}>{s.nameAr}</button>)}</div>
          <Field label="ملاحظات"><input className={inputCls} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
        </Modal>
      )}
    </AppLayout>
  );
}
