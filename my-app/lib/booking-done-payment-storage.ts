export type PaymentProofFile = {
  id: string;
  name: string;
  mimeType: string;
  previewUrl: string;
  uploadedAt: string;
};

const STORAGE_PREFIX = "booking-done-payment-proofs:";
const AMOUNT_STORAGE_PREFIX = "booking-done-payment-amount:";
const BOOKING_DATE_STORAGE_PREFIX = "booking-done-booking-date:";
const MAX_FILES = 12;
const MAX_FILE_BYTES = 8 * 1024 * 1024;

function amountStorageKey(leadType: string, leadId: string): string {
  return `${AMOUNT_STORAGE_PREFIX}${leadType}:${leadId}`;
}

function bookingDateStorageKey(leadType: string, leadId: string): string {
  return `${BOOKING_DATE_STORAGE_PREFIX}${leadType}:${leadId}`;
}

/** Local calendar day as `YYYY-MM-DD`. */
export function todayBookingDateValue(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isValidBookingDateValue(value: string): boolean {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return false;
  const [year, month, day] = trimmed.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export function formatBookingDateLabel(value: string): string {
  if (!isValidBookingDateValue(value)) return "";
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function readBookingDate(leadType: string, leadId: string): string {
  if (typeof window === "undefined") return "";
  const stored = window.localStorage.getItem(bookingDateStorageKey(leadType, leadId)) ?? "";
  return isValidBookingDateValue(stored) ? stored : "";
}

export function writeBookingDate(
  leadType: string,
  leadId: string,
  value: string,
): void {
  if (typeof window === "undefined") return;
  const trimmed = value.trim();
  if (!trimmed || !isValidBookingDateValue(trimmed)) {
    window.localStorage.removeItem(bookingDateStorageKey(leadType, leadId));
    return;
  }
  window.localStorage.setItem(bookingDateStorageKey(leadType, leadId), trimmed);
}

export function readPaymentAmount(leadType: string, leadId: string): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(amountStorageKey(leadType, leadId)) ?? "";
}

export function writePaymentAmount(
  leadType: string,
  leadId: string,
  amount: string,
): void {
  if (typeof window === "undefined") return;
  const trimmed = amount.trim();
  if (!trimmed) {
    window.localStorage.removeItem(amountStorageKey(leadType, leadId));
    return;
  }
  window.localStorage.setItem(amountStorageKey(leadType, leadId), trimmed);
}

export function parsePaymentAmountInput(value: string): number | null {
  const cleaned = value.replace(/[^\d.]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function formatPaymentAmountInput(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "";
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(value);
}

function storageKey(leadType: string, leadId: string): string {
  return `${STORAGE_PREFIX}${leadType}:${leadId}`;
}

export function readPaymentProofs(leadType: string, leadId: string): PaymentProofFile[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(leadType, leadId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (row): row is PaymentProofFile =>
        Boolean(row) &&
        typeof row === "object" &&
        typeof (row as PaymentProofFile).id === "string" &&
        typeof (row as PaymentProofFile).previewUrl === "string",
    );
  } catch {
    return [];
  }
}

export function writePaymentProofs(
  leadType: string,
  leadId: string,
  files: PaymentProofFile[],
): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(leadType, leadId), JSON.stringify(files));
}

export function validatePaymentProofFile(file: File): string | null {
  if (!file.type.startsWith("image/")) {
    return `${file.name}: only image screenshots are supported.`;
  }
  if (file.size > MAX_FILE_BYTES) {
    return `${file.name}: file is too large (max 8 MB).`;
  }
  return null;
}

export async function fileToPaymentProof(file: File): Promise<PaymentProofFile> {
  const previewUrl = await readFileAsDataUrl(file);
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    name: file.name,
    mimeType: file.type,
    previewUrl,
    uploadedAt: new Date().toISOString(),
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export function getPaymentProofLimits() {
  return { maxFiles: MAX_FILES, maxFileBytes: MAX_FILE_BYTES };
}

/** Clear draft amount + proof screenshots after successful Hub submit. */
export function clearBookingDoneDraft(leadType: string, leadId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(amountStorageKey(leadType, leadId));
  window.localStorage.removeItem(storageKey(leadType, leadId));
  window.localStorage.removeItem(bookingDateStorageKey(leadType, leadId));
}

/** Reconstruct uploadable files from draft data URLs (for multipart POST). */
export async function paymentProofsToFiles(proofs: PaymentProofFile[]): Promise<File[]> {
  const files: File[] = [];
  for (const proof of proofs) {
    const file = await paymentProofToFile(proof);
    if (file) files.push(file);
  }
  return files;
}

async function paymentProofToFile(proof: PaymentProofFile): Promise<File | null> {
  try {
    const res = await fetch(proof.previewUrl);
    const blob = await res.blob();
    return new File([blob], proof.name || "payment-proof.png", {
      type: proof.mimeType || blob.type || "image/png",
    });
  } catch {
    return null;
  }
}
