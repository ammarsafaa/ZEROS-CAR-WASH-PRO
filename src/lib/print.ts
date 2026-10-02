// Receipt printer choice is per-device (each PC has its own printers), so it lives in local storage, not shared settings.
type NativePrint = {
  listPrinters: () => Promise<{ name: string; displayName?: string; isDefault?: boolean }[]>;
  printSilent: (name: string) => Promise<{ ok: boolean; error?: string }>;
};
const KEY = "cwp_receipt_printer";

export function nativePrint(): NativePrint | null {
  if (typeof window === "undefined") return null;
  const n = (window as unknown as { cwpNative?: Partial<NativePrint> }).cwpNative;
  return n?.listPrinters && n.printSilent ? (n as NativePrint) : null;
}
export const getReceiptPrinter = () => (typeof localStorage === "undefined" ? "" : localStorage.getItem(KEY) ?? "");
export const setReceiptPrinter = (name: string) => (name ? localStorage.setItem(KEY, name) : localStorage.removeItem(KEY));

export async function printReceipt() {
  const n = nativePrint();
  const name = getReceiptPrinter();
  if (n && name) {
    const r = await n.printSilent(name);
    if (r.ok) return;
    alert("تعذّرت الطباعة على الطابعة " + name + (r.error ? " — " + r.error : "") + "\nستظهر نافذة الطباعة العادية.");
  }
  window.print();
}
