/** Shared helpers for Booking & Token payment-proof JSON uploads (avoids Tomcat multipart via Vercel). */

export type PaymentProofJsonFile = {
  fileName: string;
  contentType: string;
  base64: string;
};

export type PaymentProofUploadErrorBody = {
  success?: boolean;
  userMessage?: string;
  error?: string;
  message?: string;
  debugMessage?: string;
  type?: string;
  fallbackPath?: string;
};

/** MIME when `File.type` is empty (common on Android / Windows). */
export function paymentProofContentType(file: File): string {
  const typed = file.type?.trim();
  if (typed) return typed;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  return "application/octet-stream";
}

/** Data-URL or raw base64 — Hub accepts both on `/payments/json` and `/payment-proofs/json`. */
export function fileToPaymentProofBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      if (!result) {
        reject(new Error(`Could not read ${file.name || "payment proof"}`));
        return;
      }
      resolve(result);
    };
    reader.onerror = () =>
      reject(new Error(`Could not read ${file.name || "payment proof"}`));
    reader.readAsDataURL(file);
  });
}

export async function filesToPaymentProofJson(
  files: File[],
): Promise<PaymentProofJsonFile[]> {
  return Promise.all(
    files.map(async (file) => ({
      fileName: file.name || "payment-proof.bin",
      contentType: paymentProofContentType(file),
      base64: await fileToPaymentProofBase64(file),
    })),
  );
}

/** True when Hub/Tomcat rejected multipart parse (retry with JSON / fallbackPath). */
export function isPaymentMultipartParseError(
  raw: string,
  type?: string | null,
): boolean {
  const kind = (type ?? "").trim().toLowerCase();
  if (kind.includes("multipartexception")) return true;
  const lower = raw.trim().toLowerCase();
  return (
    lower.includes("failed to parse multipart") ||
    lower.includes("multipartexception") ||
    lower.includes("parse multipart servlet request")
  );
}

export function paymentProofUploadErrorMessage(
  data: PaymentProofUploadErrorBody,
  textFallback = "",
): string {
  return (
    data.userMessage?.trim() ||
    data.error?.trim() ||
    data.message?.trim() ||
    data.debugMessage?.trim() ||
    textFallback.trim() ||
    ""
  );
}

/**
 * Hub may return a relative `fallbackPath` on MultipartException.
 * Prefer absolute `/api/...` when present; otherwise keep relative and let caller resolve.
 */
export function resolvePaymentFallbackFetchPath(
  fallbackPath: string | undefined,
  defaultJsonPath: string,
): string {
  const raw = (fallbackPath ?? "").trim();
  if (!raw) return defaultJsonPath;
  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      return `${url.pathname}${url.search}`;
    } catch {
      return defaultJsonPath;
    }
  }
  if (raw.startsWith("/api/")) return raw;
  if (raw.startsWith("/v1/") || raw.startsWith("/api/crm/")) {
    // Browser must hit the Vercel BFF JSON routes, not Hub directly without auth proxy.
    if (raw.includes("/payments") && !raw.includes("/payment-proofs")) {
      const match = raw.match(/\/deals\/([^/]+)\/payments(?:\/json)?/i);
      if (match?.[1]) {
        return `/api/crm/booking-token/deals/${encodeURIComponent(decodeURIComponent(match[1]))}/payments/json`;
      }
    }
    if (raw.includes("/payment-proofs")) {
      const match = raw.match(
        /\/lead\/([^/]+)\/([^/]+)\/booking-done\/([^/]+)\/payment-proofs(?:\/json)?/i,
      );
      if (match?.[1] && match[2] && match[3]) {
        return `/api/crm/booking-done/${encodeURIComponent(match[1])}/${encodeURIComponent(match[2])}/${encodeURIComponent(match[3])}/payment-proofs/json`;
      }
      const v1 = raw.match(
        /\/leads\/([^/]+)\/([^/]+)\/booking-done\/([^/]+)\/payment-proofs(?:\/json)?/i,
      );
      if (v1?.[1] && v1[2] && v1[3]) {
        return `/api/crm/booking-done/${encodeURIComponent(v1[1])}/${encodeURIComponent(v1[2])}/${encodeURIComponent(v1[3])}/payment-proofs/json`;
      }
    }
    return defaultJsonPath;
  }
  if (raw.startsWith("/")) return raw;
  return defaultJsonPath;
}
