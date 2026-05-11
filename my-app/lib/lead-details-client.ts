import type { CrmLeadType } from "@/lib/leads-filter";
import { getCrmAuthHeaders } from "@/lib/crm-client-auth";
import {
  sanitizeErrorMessage,
} from "@/lib/friendly-api-error";

function authHeaders(): HeadersInit {
  return getCrmAuthHeaders({ "Content-Type": "application/json" });
}

type ParsedApiError = {
  status: number;
  message: string;
  payload: Record<string, unknown> | null;
};

function isRateLimitMessage(text: string): boolean {
  const t = text.trim().toLowerCase();
  return (
    t.includes("ratelimiter") ||
    t.includes("rate limit") ||
    t.includes("too many requests")
  );
}

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizePropertyDetails(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  try {
    return JSON.stringify(value).trim();
  } catch {
    return String(value).trim();
  }
}

function normalizeLeadUpdatePayload(
  leadType: CrmLeadType,
  input: Record<string, unknown>,
): Record<string, unknown> {
  const normalizedBody: Record<string, unknown> = { ...input };
  if (normalizedBody.PropertyDetails !== undefined) {
    // Canonicalize to one top-level key.
    normalizedBody.propertyDetails = normalizedBody.PropertyDetails;
    delete normalizedBody.PropertyDetails;
  }
  normalizedBody.propertyDetails = normalizePropertyDetails(
    normalizedBody.propertyDetails,
  );
  const dynamicFields = normalizedBody.dynamicFields;
  if (
    dynamicFields &&
    typeof dynamicFields === "object" &&
    !Array.isArray(dynamicFields)
  ) {
    const normalizedDynamicFields = {
      ...(dynamicFields as Record<string, unknown>),
    };
    const incomingPropertyDetails =
      normalizedDynamicFields.PropertyDetails ??
      normalizedDynamicFields.propertyDetails;
    normalizedDynamicFields.PropertyDetails = normalizePropertyDetails(
      incomingPropertyDetails,
    );
    delete normalizedDynamicFields.propertyDetails;
    normalizedBody.dynamicFields = normalizedDynamicFields;
  }

  // Keep GLead update payload closer to old CRM contract.
  if (leadType === "glead") {
    const rawPhone =
      typeof normalizedBody.phoneNumber === "string"
        ? normalizedBody.phoneNumber
        : typeof normalizedBody.phone === "string"
          ? normalizedBody.phone
          : typeof normalizedBody.mobile === "string"
            ? normalizedBody.mobile
            : "";
    const rawPin =
      typeof normalizedBody.propertyPin === "string"
        ? normalizedBody.propertyPin
        : typeof normalizedBody.propertyPincode === "string"
          ? normalizedBody.propertyPincode
          : typeof normalizedBody.pincode === "string"
            ? normalizedBody.pincode
            : "";

    normalizedBody.phoneNumber = rawPhone.trim();
    normalizedBody.propertyPin = rawPin.trim();

    delete normalizedBody.phone;
    delete normalizedBody.mobile;
    delete normalizedBody.propertyPincode;
    delete normalizedBody.pincode;
    delete normalizedBody.pinCode;
    delete normalizedBody.zip;
  }

  return normalizedBody;
}

async function parseApiError(response: Response): Promise<ParsedApiError> {
  let payload: Record<string, unknown> | null = null;
  let text = "";
  try {
    payload = (await response.clone().json()) as Record<string, unknown>;
  } catch {
    payload = null;
    try {
      text = await response.clone().text();
    } catch {
      text = "";
    }
  }
  const payloadMessage =
    (typeof payload?.userMessage === "string" && payload.userMessage.trim()) ||
    (typeof payload?.error === "string" && payload.error.trim()) ||
    (typeof payload?.message === "string" && payload.message.trim()) ||
    "";
  const fallbackByStatus =
    response.status === 401
      ? "Session expired. Please login again."
      : response.status === 403
        ? "You do not have permission to update this lead."
        : response.status === 404
          ? "Lead not found."
          : response.status === 500
            ? "Server error. Please try again."
            : `Request failed with status ${response.status}`;

  return {
    status: response.status,
    message: sanitizeErrorMessage(payloadMessage || text.trim(), fallbackByStatus),
    payload,
  };
}

async function buildApiError(res: Response, fallback: string): Promise<Error> {
  const parsed = await parseApiError(res);
  return new Error(parsed.message || fallback);
}

export async function getLeadDetail(leadType: CrmLeadType, id: string): Promise<Record<string, unknown>> {
  const maxAttempts = 3;
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const res = await fetch(`/api/crm/lead/${leadType}/${id}`, {
      cache: "no-store",
      credentials: "include",
      headers: authHeaders(),
    });
    if (res.ok) return res.json() as Promise<Record<string, unknown>>;
    const parsed = await parseApiError(res);
    const limiterHit =
      res.status === 429 || res.status === 503 || isRateLimitMessage(parsed.message);
    if (limiterHit && attempt < maxAttempts) {
      await waitMs(400 * attempt);
      continue;
    }
    const fallback = limiterHit
      ? "Too many requests right now. Please retry in a few seconds."
      : `Failed to load lead details (${res.status})`;
    if (limiterHit) {
      lastError = new Error(fallback);
    } else {
      lastError = new Error(parsed.message || fallback);
    }
    break;
  }
  throw lastError ?? new Error("Failed to load lead details.");
}

export async function getLeadActivities(leadType: CrmLeadType, id: string): Promise<unknown> {
  const res = await fetch(`/api/crm/lead/${leadType}/${id}/activities`, {
    cache: "no-store",
    credentials: "include",
    headers: authHeaders(),
  });
  if (!res.ok) throw await buildApiError(res, `Failed to load activities (${res.status})`);
  return res.json();
}

export async function putLeadDetail(
  leadType: CrmLeadType,
  id: string,
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const normalizedBody = normalizeLeadUpdatePayload(leadType, body);
  const requestBody = JSON.stringify(normalizedBody);
  if (typeof window !== "undefined") {
    console.info("[lead:update] PUT endpoint:", `/api/crm/lead/${leadType}/${id}`);
    console.info("[lead:update] payload bytes:", new Blob([requestBody]).size);
    console.info(
      "[lead:update] propertyDetails length:",
      (normalizedBody.propertyDetails as string).length,
    );
  }
  const res = await fetch(`/api/crm/lead/${leadType}/${id}`, {
    method: "PUT",
    credentials: "include",
    headers: authHeaders(),
    body: requestBody,
    cache: "no-store",
  });
  if (!res.ok) {
    throw await buildApiError(
      res,
      "Failed to update lead. Please check values and try again.",
    );
  }
  return res.json() as Promise<Record<string, unknown>>;
}

export async function postManualActivity(
  leadType: CrmLeadType,
  id: string,
  activityType: "CALL" | "WHATSAPP" | "SMS" | "NOTE",
  value: string
): Promise<string> {
  const res = await fetch(`/api/crm/lead/${leadType}/${id}/activity`, {
    method: "POST",
    credentials: "include",
    headers: authHeaders(),
    body: JSON.stringify({ activityType, value }),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    if (res.status === 403)
      throw new Error("You don't have permission to add activity.");
    throw new Error(
      sanitizeErrorMessage(
        text,
        `Unable to save activity right now. Please try again.`,
      ),
    );
  }
  return text;
}

function verifyPayloadMessage(parsed: Record<string, unknown> | null): string | null {
  if (!parsed) return null;
  const um = parsed.userMessage;
  if (typeof um === "string" && um.trim()) return um.trim();
  const m = parsed.message;
  if (typeof m === "string" && m.trim()) return m.trim();
  const e = parsed.error;
  if (typeof e === "string" && e.trim()) return e.trim();
  return null;
}

/** `POST .../verify/{id}` — body shape depends on Hub (e.g. sales executive id). */
export async function postVerifyLead(
  leadType: CrmLeadType,
  id: string,
  body: Record<string, unknown> = {}
): Promise<unknown> {
  const res = await fetch(`/api/crm/lead/${leadType}/${id}/verify`, {
    method: "POST",
    credentials: "include",
    headers: authHeaders(),
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const text = await res.text();
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = text.trim() ? (JSON.parse(text) as Record<string, unknown>) : null;
  } catch {
    parsed = null;
  }

  if (!res.ok) {
    const fromJson = verifyPayloadMessage(parsed);
    const msg =
      fromJson ??
      (res.status === 401 ? "Session expired. Please log in again." : null) ??
      (res.status === 403 ? "You don't have permission to verify this lead." : null) ??
      (text.trim() ? text.trim() : null) ??
      `Verify failed (${res.status})`;
    throw new Error(msg);
  }

  if (parsed && parsed.success === false) {
    throw new Error(verifyPayloadMessage(parsed) ?? "Verify failed.");
  }

  return parsed ?? {};
}

export async function postStageRollback(
  leadType: CrmLeadType,
  id: string,
  body: {
    toMilestoneStage: string;
    toMilestoneStageCategory: string;
    toMilestoneSubStage: string;
    reason: string;
  }
): Promise<unknown> {
  const res = await fetch(`/api/crm/lead/${leadType}/${id}/stage-rollback`, {
    method: "POST",
    credentials: "include",
    headers: authHeaders(),
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error("Session expired. Please login again.");
    }
    if (res.status === 403) {
      throw new Error("Only Super Admin can rollback stage.");
    }
    throw new Error(
      sanitizeErrorMessage(
        text,
        `Unable to rollback stage right now. Please try again.`,
      ),
    );
  }
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return text;
  }
}

/** `POST /v1/quote/send` — multipart fields: quoteLink, toEmail, subject, body, leadId, leadType. */
export async function postQuoteSend(formData: FormData): Promise<unknown> {
  const headers = getCrmAuthHeaders();
  const res = await fetch(`/api/crm/quote/send`, {
    method: "POST",
    credentials: "include",
    headers,
    body: formData,
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      sanitizeErrorMessage(text, "Unable to send quote right now. Please try again."),
    );
  }
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return text;
  }
}

type NewCrmQuoteResponse = {
  ok?: boolean;
  externalLeadId?: string;
  leadId?: string | number;
  quoteId?: string | number;
  internalQuoteUrl?: string;
  customerQuoteUrl?: string;
  message?: string;
  error?: string;
};

function isHtmlLikePayload(text: string): boolean {
  const t = text.trim().toLowerCase();
  return (
    t.startsWith("<!doctype html") ||
    t.startsWith("<html") ||
    t.includes("<head") ||
    t.includes("<body")
  );
}

/** `GET /api/new-crm/quotes/internal-link/by-lead/{leadId}` via CRM backend proxy. */
export async function getNewCrmQuoteInternalLinkByLead(
  leadId: string,
): Promise<NewCrmQuoteResponse> {
  const id = leadId.trim();
  if (!id) throw new Error("Lead ID is required to fetch quote.");
  const res = await fetch(
    `/api/new-crm/quotes/internal-link/by-lead/${encodeURIComponent(id)}`,
    {
      method: "GET",
      credentials: "include",
      headers: authHeaders(),
      cache: "no-store",
    },
  );
  const text = await res.text();
  let parsed: NewCrmQuoteResponse | null = null;
  try {
    parsed = text ? (JSON.parse(text) as NewCrmQuoteResponse) : null;
  } catch {
    parsed = null;
  }
  if (!res.ok) {
    const rawMessage =
      (parsed?.message && parsed.message.trim()) ||
      (parsed?.error && parsed.error.trim()) ||
      text.trim();
    const message = isHtmlLikePayload(rawMessage)
      ? `Get quote failed (${res.status}). Upstream service returned an invalid response.`
      : sanitizeErrorMessage(
          rawMessage,
          "Unable to fetch quote link right now. Please try again.",
        );
    throw new Error(message);
  }
  return parsed ?? {};
}
