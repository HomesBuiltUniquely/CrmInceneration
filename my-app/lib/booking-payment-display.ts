export const OFFLINE_PAYMENT_METHODS = [
  { id: "CASH", label: "Cash" },
  { id: "CHEQUE", label: "Cheque" },
  { id: "BANK_TRANSFER", label: "Bank Transfer" },
  { id: "DD", label: "Demand Draft" },
] as const;

export type OfflinePaymentMethodId = (typeof OFFLINE_PAYMENT_METHODS)[number]["id"];
export type PaymentChannelChoice = "online" | "offline";

export function formatPaymentSource(source?: string | null): string {
  if (!source) return "";
  const normalized = source.trim();
  if (normalized === "booking_done") return "Booking Done";
  if (normalized === "pay_action") return "Pay action";
  if (normalized.toUpperCase() === "EASEBUZZ") return "Easebuzz";
  return normalized.replace(/_/g, " ");
}

export function formatPaymentChannel(channel?: string | null): string {
  if (!channel) return "";
  const normalized = channel.trim().toUpperCase();
  if (normalized === "ONLINE") return "Online";
  if (normalized === "OFFLINE") return "Offline";
  return channel.replace(/_/g, " ");
}

export function formatPaymentMethod(method?: string | null): string {
  if (!method) return "";
  const normalized = method.trim().toUpperCase();
  const fromOffline = OFFLINE_PAYMENT_METHODS.find((item) => item.id === normalized);
  if (fromOffline) return fromOffline.label;
  if (normalized === "UPI") return "UPI";
  if (normalized === "CARD") return "Card";
  if (normalized === "NETBANKING" || normalized === "NET_BANKING") return "Netbanking";
  if (normalized === "WALLET") return "Wallet";
  return method.replace(/_/g, " ");
}

export function formatPaymentKind(kind?: string | null): string {
  if (!kind) return "";
  return kind.replace(/_/g, " ");
}

export function isEasebuzzPayment(entry: {
  source?: string | null;
  paymentChannel?: string | null;
}): boolean {
  return (
    String(entry.source ?? "").toUpperCase() === "EASEBUZZ" ||
    String(entry.paymentChannel ?? "").toUpperCase() === "ONLINE"
  );
}

export function paymentHistoryMetaLine(entry: {
  source?: string | null;
  paymentChannel?: string | null;
  paymentMethod?: string | null;
}): string {
  const parts = [
    formatPaymentSource(entry.source),
    formatPaymentChannel(entry.paymentChannel),
    formatPaymentMethod(entry.paymentMethod),
  ].filter(Boolean);
  return parts.join(" · ");
}
