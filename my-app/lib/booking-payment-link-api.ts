import { getCrmAuthHeaders } from "@/lib/crm-client-auth";

export type PaymentLinkStatus =
  | "PENDING"
  | "CREATED_NOT_DELIVERED"
  | "PAID"
  | "SUPERSEDED"
  | "EXPIRED"
  | "FAILED";

export type PaymentLinkChannelStatus = "SENT" | "FAILED" | "SKIPPED";

export type PaymentLinkAttempt = {
  id: string;
  status: PaymentLinkStatus | string;
  amount: number;
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
  paymentMethod?: string | null;
  recordId?: string | null;
};

export type PaymentLinkResponse = {
  success?: boolean;
  attempt?: PaymentLinkAttempt | null;
  warnings?: string[];
  useOfflineFallback?: boolean;
  userMessage?: string;
  error?: string;
  message?: string;
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

  constructor(message: string, status: number, useOfflineFallback = false) {
    super(message);
    this.name = "PaymentLinkApiError";
    this.status = status;
    this.useOfflineFallback = useOfflineFallback;
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
    paymentMethod: pickStr(row, "paymentMethod", "payment_method") || null,
    recordId: pickStr(row, "recordId", "bookingTokenRecordId", "dealId") || null,
  };
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
    };
  } catch {
    return { success: false };
  }
}

function parseApiError(text: string, fallback: string, status: number): PaymentLinkApiError {
  const parsed = parsePaymentLinkResponse(text);
  const message =
    parsed.userMessage?.trim() || parsed.error?.trim() || parsed.message?.trim() || fallback;
  return new PaymentLinkApiError(message, status, parsed.useOfflineFallback === true);
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
  action: "copy" | "resend" | "edit" | "switch-offline",
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

export const PAYMENT_LINK_POLL_MS = 20_000;
