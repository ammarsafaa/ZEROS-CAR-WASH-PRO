import { QRCodeSVG } from "qrcode.react";
import { fmt, type DB, type Invoice } from "@/lib/db";

const METHOD_LABELS: Record<string, string> = {
  Cash: "نقدي",
  Card: "بطاقة",
  Credit: "آجل",
  Other: "أخرى",
};

type ProfessionalReceiptProps = {
  db: DB;
  invoice: Invoice;
};

export function ProfessionalReceipt({ db, invoice }: ProfessionalReceiptProps) {
  const compact = db.settings.paperWidth === 58;
  const width = compact ? 52 : 72;
  const order = db.orders.find((item) => item.id === invoice.orderId);
  const customerId = invoice.customerId ?? order?.customerId;
  const vehicleId = invoice.vehicleId ?? order?.vehicleId;
  const customer = db.customers.find((item) => item.id === customerId);
  const vehicle = db.vehicles.find((item) => item.id === vehicleId);
  const oilChange = db.oilChanges.find((item) => item.invoiceCode === invoice.code);
  const lines = invoice.lines ?? order?.items.map((item) => ({ ...item, kind: "service" as const, refId: item.serviceId, qty: 1 }));
  const payment = METHOD_LABELS[invoice.method] ?? invoice.method;
  const qrValue = `${invoice.code}|${fmt(invoice.total)} ${db.settings.currency}|${invoice.createdAt.slice(0, 10)}`;

  return (
    <div
      id="receipt-print"
      className={`thermal receipt ${compact ? "receipt--compact" : ""}`}
      style={{ width: `${width}mm`, "--rw": `${width}mm` } as React.CSSProperties}
      dir="rtl"
    >
      <header className="receipt__header">
        {db.settings.logoData && <img src={db.settings.logoData} alt="شعار المغسلة" className="receipt__logo" />}
        <h2 className="receipt__business">{db.settings.businessName}</h2>
        <p className="receipt__brand">ZEROS CAR WASH PRO</p>
        <div className="receipt__contact">
          {db.settings.address && <p>{db.settings.address}</p>}
          {db.settings.phone && <p dir="ltr">{db.settings.phone}</p>}
        </div>
      </header>

      <div className="receipt__rule" />

      <section className="receipt__meta" aria-label="بيانات الفاتورة">
        <div><strong>رقم الفاتورة:</strong><span dir="ltr">{invoice.code}</span></div>
        {order?.code && <div><strong>رقم الطلب:</strong><span dir="ltr">{order.code}</span></div>}
        <div><strong>التاريخ:</strong><span>{new Date(invoice.createdAt).toLocaleString("ar-IQ")}</span></div>
        <div><strong>الكاشير:</strong><span>{invoice.cashier}</span></div>
      </section>

      {(customer || vehicle) && (
        <section className="receipt__subject" aria-label="بيانات العميل والسيارة">
          {customer && <div><span>العميل:</span><strong>{customer.name}</strong></div>}
          {vehicle && <div><span>السيارة:</span><strong>{vehicle.make} {vehicle.model} — {vehicle.plate}</strong></div>}
        </section>
      )}

      <table className="receipt__items">
        <thead>
          <tr><th>الخدمة / المنتج</th><th>الكمية</th><th>السعر</th></tr>
        </thead>
        <tbody>
          {lines?.map((line, index) => (
            <tr key={`${line.refId}-${index}`}>
              <td>{line.name}</td>
              <td>{line.qty}</td>
              <td>{fmt(line.qty * line.price)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="receipt__totals" aria-label="إجماليات الفاتورة">
        <div><span>المجموع الفرعي:</span><span>{fmt(invoice.subtotal)} {db.settings.currency}</span></div>
        {invoice.discount > 0 && <div><span>الخصم:</span><span>−{fmt(invoice.discount)} {db.settings.currency}</span></div>}
        {invoice.tax > 0 && <div><span>الضريبة:</span><span>{fmt(invoice.tax)} {db.settings.currency}</span></div>}
        <div className="receipt__grand-total"><strong>الإجمالي:</strong><strong>{fmt(invoice.total)} {db.settings.currency}</strong></div>
        {invoice.paid && invoice.paid > invoice.total && (
          <div><span>المستلم / الباقي:</span><span>{fmt(invoice.paid)} / {fmt(invoice.paid - invoice.total)}</span></div>
        )}
      </section>

      {oilChange && <p className="receipt__notice">تبديل الزيت القادم عند {fmt(oilChange.nextKm)} كم</p>}
      {invoice.voided && <p className="receipt__void">*** فاتورة ملغاة ***</p>}

      <div className="receipt__payment">طريقة الدفع: {payment}</div>

      <footer className="receipt__footer">
        <QRCodeSVG value={qrValue} size={compact ? 58 : 72} fgColor="#000000" bgColor="#ffffff" />
        <p className="receipt__code" dir="ltr">{invoice.code}</p>
        <p className="receipt__thanks">شكراً لثقتكم بنا!</p>
        <p className="receipt__return">نتشرف بزيارتكم مرة أخرى</p>
        <p className="receipt__system">تم الإنشاء بواسطة ZEROS CAR WASH PRO</p>
      </footer>
    </div>
  );
}