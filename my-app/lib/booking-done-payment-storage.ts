export type PaymentProofFile = {
  id: string;
  name: string;
  mimeType: string;
  previewUrl: string;
  uploadedAt: string;
};

const STORAGE_PREFIX = "booking-done-payment-proofs:";
const AMOUNT_STORAGE_PREFIX = "booking-done-payment-amount:";
const MAX_FILES = 12;
const MAX_FILE_BYTES = 8 * 1024 * 1024;

function amountStorageKey(leadType: string, leadId: string): string {
  return `${AMOUNT_STORAGE_PREFIX}${leadType}:${leadId}`;
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
