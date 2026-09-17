import { getCrmAuthHeaders } from "@/lib/crm-client-auth";
import { copyTextToClipboard } from "@/lib/copy-text-to-clipboard";
import type { PaymentLinkAction } from "@/lib/booking-payment-link-upstream";

export type PaymentLinkStatus =
  | "PENDING"
  | "CREATED_NOT_DELIVERED"
  | "PAID"
  | "SUPERSEDED"
  | "EXPIRED"
  | "FAILED"
  | "CANCELLED";

export type PaymentLinkChannelStatus = "SENT" | "FAILED" | "SKIPPED";

export type PaymentLinkAttempt = {
  id: string;
  status: PaymentLinkStatus | string;
  amount: number;
  currency?: string | null;
  paymentLinkUrl?: string | null;
  createdAt?: string | null;
  expiresAt?: string | null;
  whatsappStatus?: PaymentLinkChannelStatus | string | null;
  emailStatus?: PaymentLinkChannelStatus | string | null;
  smsStatus?: PaymentLinkChannelStatus | string | null;
  sendCount?: number;
  resendCount?: number;
  copyCount?: number;
  editCount?: number;
  salesUserName?: string | null;
  salesUserId?: string | number | null;
  warnings?: string[];
  paymentChannel?: string | null;
  paymentMethod?: string | null;
  bookingTokenRecordId?: string | null;
  paymentFailureCount?: number;
  hasPaymentFailures?: boolean;
  lastPaymentFailureAt?: string | null;
  lastPaymentFailureStatus?: string | null;
  lastPaymentFailureReason?: string | null;
};

export type PaymentLinkResponse = {
  success?: boolean;
  attempt?: PaymentLinkAttempt | null;
  warnings?: string[];
  useOfflineFallback?: boolean;
  userMessage?: string;
  error?: string;
  message?: string;
  code?: string;
  paymentLinkUrl?: string | null;
  switchedToOffline?: boolean;
  amount?: number;
};

export type CreateLeadPaymentLinkInput = {
  amount?: number;
  quoteId?: string;
  quoteAmount?: number;
  tenPercentAmount?: number | null;
  quoteVersionLabel?: string;
  quoteVerifyUrl?: string;
  bookingDate?: string;
  hubLeadId?: string;
};

export class PaymentLinkApiError extends Error {
  status: number;
  useOfflineFallback: boolean;
  code?: string;
  attempt?: PaymentLinkAttempt | null;

  constructor(
    message: string,
    status: number,
    useOfflineFallback = false,
    extras?: { code?: string; attempt?: PaymentLinkAttempt | null },
  ) {
    super(message);
    this.name = "PaymentLinkApiError";
    this.status = status;
    this.useOfflineFallback = useOfflineFallback;
    this.code = extras?.code;
    this.attempt = extras?.attempt ?? null;
  }
}

const BANNER_STATUSES = new Set(["PENDING", "CREATED_NOT_DELIVERED"]);

export function isActivePaymentLinkStatus(status?: string | null): boolean {
  return BANNER_STATUSES.has(String(status ?? "").toUpperCase());
}

export function isBannerPaymentLink(attempt?: PaymentLinkAttempt | null): boolean {
  return Boolean(attempt?.id && isActivePaymentLinkStatus(attempt.status));
}

function pickStr(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function pickBool(row: Record<string, unknown>, ...keys: string[]): boolean | undefined {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "boolean") return value;
    if (value === 1 || value === "1" || String(value).toLowerCase() === "true") return true;
    if (value === 0 || value === "0" || String(value).toLowerCase() === "false") return false;
  }
  return undefined;
}

function pickNum(row: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value.replace(/,/g, ""));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function parsePaymentLinkAttempt(raw: unknown): PaymentLinkAttempt | null {
  const row = asRecord(raw);
  if (!row) return null;
  const id = pickStr(row, "id", "attemptId", "paymentAttemptId");
  if (!id) return null;
  const warningsRaw = row.warnings;
  const warnings = Array.isArray(warningsRaw)
    ? warningsRaw.map((item) => String(item)).filter(Boolean)
    : [];
  return {
    id,
    status: pickStr(row, "status") || "PENDING",
    amount: pickNum(row, "amount") ?? 0,
    paymentLinkUrl: pickStr(row, "paymentLinkUrl", "payment_link_url", "linkUrl") || null,
    createdAt: pickStr(row, "createdAt", "created_at") || null,
    expiresAt: pickStr(row, "expiresAt", "expires_at") || null,
    whatsappStatus: pickStr(row, "whatsappStatus", "whatsapp_status") || null,
    emailStatus: pickStr(row, "emailStatus", "email_status") || null,
    smsStatus: pickStr(row, "smsStatus", "sms_status") || null,
    sendCount: pickNum(row, "sendCount", "send_count"),
    resendCount: pickNum(row, "resendCount", "resend_count"),
    copyCount: pickNum(row, "copyCount", "copy_count"),
    editCount: pickNum(row, "editCount", "edit_count"),
    salesUserName: pickStr(row, "salesUserName", "sales_user_name") || null,
    salesUserId: pickStr(row, "salesUserId", "sales_user_id") || null,
    warnings,
    paymentChannel: pickStr(row, "paymentChannel", "payment_channel") || "ONLINE",
    paymentMethod: pickStr(row, "paymentMethod", "payment_method") || null,
    bookingTokenRecordId:
      pickStr(row, "bookingTokenRecordId", "booking_token_record_id", "recordId", "dealId") || null,
    currency: pickStr(row, "currency") || "INR",
    paymentFailureCount: pickNum(row, "paymentFailureCount", "payment_failure_count"),
    hasPaymentFailures: pickBool(row, "hasPaymentFailures", "has_payment_failures"),
    lastPaymentFailureAt:
      pickStr(row, "lastPaymentFailureAt", "last_payment_failure_at") || null,
    lastPaymentFailureStatus:
      pickStr(row, "lastPaymentFailureStatus", "last_payment_failure_status") || null,
    lastPaymentFailureReason:
      pickStr(row, "lastPaymentFailureReason", "last_payment_failure_reason") || null,
  };
}

export function attemptPaymentFailureCount(attempt?: PaymentLinkAttempt | null): number {
  const count = attempt?.paymentFailureCount;
  if (typeof count === "number" && Number.isFinite(count) && count > 0) return Math.floor(count);
  return 0;
}

export function attemptHasPaymentFailures(attempt?: PaymentLinkAttempt | null): boolean {
  if (!attempt) return false;
  return attempt.hasPaymentFailures === true || attemptPaymentFailureCount(attempt) > 0;
}

export function formatPaymentFailureStatusLabel(status?: string | null): string {
  const raw = String(status ?? "").trim();
  if (!raw) return "";
  const spaced = raw
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function parsePaymentLinkResponse(text: string): PaymentLinkResponse {
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const attemptRaw = parsed.attempt ?? parsed.data ?? parsed.paymentAttempt;
    return {
      success: parsed.success === true,
      attempt: parsePaymentLinkAttempt(attemptRaw),
      warnings: Array.isArray(parsed.warnings)
        ? parsed.warnings.map((item) => String(item)).filter(Boolean)
        : [],
      useOfflineFallback: parsed.useOfflineFallback === true,
      userMessage: typeof parsed.userMessage === "string" ? parsed.userMessage : undefined,
      error: typeof parsed.error === "string" ? parsed.error : undefined,
      message: typeof parsed.message === "string" ? parsed.message : undefined,
      code: typeof parsed.code === "string" ? parsed.code : undefined,
      paymentLinkUrl: pickStr(parsed, "paymentLinkUrl", "payment_link_url") || null,
      switchedToOffline: parsed.switchedToOffline === true,
      amount: pickNum(parsed, "amount"),
    };
  } catch {
    return { success: false };
  }
}

function parseApiError(text: string, fallback: string, status: number): PaymentLinkApiError {
  const parsed = parsePaymentLinkResponse(text);
  const message =
    parsed.userMessage?.trim() || parsed.error?.trim() || parsed.message?.trim() || fallback;
  return new PaymentLinkApiError(message, status, parsed.useOfflineFallback === true, {
    code: parsed.code,
    attempt: parsed.attempt,
  });
}

async function readJsonResponse(res: Response, fallback: string): Promise<PaymentLinkResponse> {
  const text = await res.text();
  if (!res.ok) {
    throw parseApiError(text, fallback, res.status);
  }
  return parsePaymentLinkResponse(text);
}

export function hasLeadContact(phone?: string | null, email?: string | null): boolean {
  const hasPhone = Boolean(phone?.trim() && phone.trim() !== "—");
  const hasEmail = Boolean(email?.trim() && email.trim() !== "—");
  return hasPhone || hasEmail;
}

export async function createLeadPaymentLink(
  leadType: string,
  leadId: string,
  input: CreateLeadPaymentLinkInput,
): Promise<PaymentLinkResponse> {
  const res = await fetch(
    `/api/crm/lead/${encodeURIComponent(leadType)}/${encodeURIComponent(leadId)}/payment-links`,
    {
      method: "POST",
      credentials: "include",
      headers: getCrmAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(input),
      cache: "no-store",
    },
  );
  return readJsonResponse(res, "Unable to send payment link.");
}

export async function createDealPaymentLink(
  recordId: string,
  input: { amount?: number } = {},
): Promise<PaymentLinkResponse> {
  const res = await fetch(
    `/api/crm/booking-token/deals/${encodeURIComponent(recordId)}/payment-links`,
    {
      method: "POST",
      credentials: "include",
      headers: getCrmAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(input),
      cache: "no-store",
    },
  );
  return readJsonResponse(res, "Unable to send payment link.");
}

export async function fetchLeadPaymentLinkActive(
  leadType: string,
  leadId: string,
): Promise<PaymentLinkAttempt | null> {
  const res = await fetch(
    `/api/crm/lead/${encodeURIComponent(leadType)}/${encodeURIComponent(leadId)}/payment-links/active`,
    {
      credentials: "include",
      headers: getCrmAuthHeaders(),
      cache: "no-store",
    },
  );
  const parsed = await readJsonResponse(res, "Unable to load payment link.");
  return parsed.attempt ?? null;
}

export async function fetchDealPaymentLinkActive(
  recordId: string,
): Promise<PaymentLinkAttempt | null> {
  const res = await fetch(
    `/api/crm/booking-token/deals/${encodeURIComponent(recordId)}/payment-links/active`,
    {
      credentials: "include",
      headers: getCrmAuthHeaders(),
      cache: "no-store",
    },
  );
  const parsed = await readJsonResponse(res, "Unable to load payment link.");
  return parsed.attempt ?? null;
}

async function postPaymentLinkAction(
  attemptId: string,
  action: PaymentLinkAction,
  body?: Record<string, unknown>,
): Promise<PaymentLinkResponse> {
  const res = await fetch(
    `/api/crm/booking-token/payment-links/${encodeURIComponent(attemptId)}/${action}`,
    {
      method: "POST",
      credentials: "include",
      headers: getCrmAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(body ?? {}),
      cache: "no-store",
    },
  );
  return readJsonResponse(res, `Unable to ${action.replace("-", " ")} payment link.`);
}

export function copyPaymentLink(attemptId: string): Promise<PaymentLinkResponse> {
  return postPaymentLinkAction(attemptId, "copy");
}

export function resendPaymentLink(attemptId: string): Promise<PaymentLinkResponse> {
  return postPaymentLinkAction(attemptId, "resend");
}

export function editPaymentLinkAmount(
  attemptId: string,
  amount: number,
): Promise<PaymentLinkResponse> {
  return postPaymentLinkAction(attemptId, "edit", { amount });
}

export function switchPaymentLinkOffline(attemptId: string): Promise<PaymentLinkResponse> {
  return postPaymentLinkAction(attemptId, "switch-offline");
}

/** Cancel/delete unpaid active link. Tries `cancel`, then `delete` on 404. */
export async function cancelPaymentLink(attemptId: string): Promise<PaymentLinkResponse> {
  try {
    return await postPaymentLinkAction(attemptId, "cancel");
  } catch (err) {
    if (err instanceof PaymentLinkApiError && err.status === 404) {
      return postPaymentLinkAction(attemptId, "delete");
    }
    throw err;
  }
}

export function isPaymentLinkActiveConflict(err: unknown): err is PaymentLinkApiError {
  return (
    err instanceof PaymentLinkApiError &&
    (err.status === 409 || err.code === "PAYMENT_LINK_ACTIVE")
  );
}

export function resolveCopiedPaymentLinkUrl(
  result: PaymentLinkResponse,
  fallback?: PaymentLinkAttempt | null,
): string {
  return (
    result.paymentLinkUrl?.trim() ||
    result.attempt?.paymentLinkUrl?.trim() ||
    fallback?.paymentLinkUrl?.trim() ||
    ""
  );
}

/** POST .../copy then clipboard (modal-safe fallback). */
export async function copyPaymentLinkToClipboard(
  attemptId: string,
  fallback?: PaymentLinkAttempt | null,
): Promise<PaymentLinkResponse> {
  const result = await copyPaymentLink(attemptId);
  const url = resolveCopiedPaymentLinkUrl(result, fallback ?? result.attempt);
  if (!url) throw new Error("Payment link URL is not available yet.");
  await copyTextToClipboard(url);
  return result;
}

export function resolveSwitchOfflineAmount(
  result: PaymentLinkResponse,
  fallback?: PaymentLinkAttempt | null,
): number | null {
  if (typeof result.amount === "number" && Number.isFinite(result.amount) && result.amount > 0) {
    return result.amount;
  }
  if (typeof result.attempt?.amount === "number" && result.attempt.amount > 0) {
    return result.attempt.amount;
  }
  if (typeof fallback?.amount === "number" && fallback.amount > 0) return fallback.amount;
  return null;
}

export function isStalePaymentLinkAction(err: unknown): boolean {
  return err instanceof PaymentLinkApiError && err.status === 400;
}

export function isSmsFallback(attempt?: PaymentLinkAttempt | null): boolean {
  return (
    String(attempt?.whatsappStatus ?? "").toUpperCase() === "FAILED" &&
    String(attempt?.smsStatus ?? "").toUpperCase() === "SENT"
  );
}

export const PAYMENT_LINK_POLL_MS = 20_000;
export const PAYMENT_LINK_UPDATED_EVENT = "crm-payment-link-updated";
export const PAYMENT_LINK_STATE_EVENT = "crm-payment-link-state";

const activePaymentLinkCache = new Map<string, PaymentLinkAttempt | null>();
const paymentLinkSuccessCache = new Map<string, boolean>();

export function paymentLinkCacheKey(leadType: string, leadId: string): string {
  return `${leadType}:${leadId}`;
}

function emitPaymentLinkState(
  leadType: string,
  leadId: string,
  attempt: PaymentLinkAttempt | null,
): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(PAYMENT_LINK_STATE_EVENT, {
      detail: { leadType, leadId, attempt },
    }),
  );
}

export function readPaymentLinkOnlineSuccess(leadType: string, leadId: string): boolean {
  return paymentLinkSuccessCache.get(paymentLinkCacheKey(leadType, leadId)) === true;
}

export function clearPaymentLinkOnlineSuccess(leadType: string, leadId: string): void {
  paymentLinkSuccessCache.delete(paymentLinkCacheKey(leadType, leadId));
}

export function markPaymentLinkOnlineSuccess(leadType: string, leadId: string): void {
  paymentLinkSuccessCache.set(paymentLinkCacheKey(leadType, leadId), true);
  emitPaymentLinkState(leadType, leadId, readCachedPaymentLinkAttempt(leadType, leadId));
}

export function readCachedPaymentLinkAttempt(
  leadType: string,
  leadId: string,
): PaymentLinkAttempt | null {
  const cached = activePaymentLinkCache.get(paymentLinkCacheKey(leadType, leadId));
  return isBannerPaymentLink(cached) ? cached ?? null : null;
}

export function writeCachedPaymentLinkAttempt(
  leadType: string,
  leadId: string,
  attempt: PaymentLinkAttempt | null | undefined,
): void {
  const banner = isBannerPaymentLink(attempt) ? attempt ?? null : null;
  if (banner) clearPaymentLinkOnlineSuccess(leadType, leadId);
  activePaymentLinkCache.set(paymentLinkCacheKey(leadType, leadId), banner);
  emitPaymentLinkState(leadType, leadId, banner);
}

export function notifyPaymentLinkUpdated(
  leadType: string,
  leadId: string,
  attempt?: PaymentLinkAttempt | null,
): void {
  if (typeof window === "undefined") return;
  writeCachedPaymentLinkAttempt(leadType, leadId, attempt ?? null);
  window.dispatchEvent(
    new CustomEvent(PAYMENT_LINK_UPDATED_EVENT, {
      detail: { leadType, leadId, attempt: attempt ?? null },
    }),
  );
}
