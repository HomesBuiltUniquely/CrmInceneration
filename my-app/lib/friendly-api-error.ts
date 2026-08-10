type JsonRecord = Record<string, unknown>;

const TECHNICAL_ERROR_PATTERNS: RegExp[] = [
  /exception/i,
  /stack\s*trace/i,
  /httpmessagenotreadable/i,
  /cannot deserialize/i,
  /json parse/i,
  /jackson/i,
  /org\.[a-z0-9_.]+/i,
  /java\.[a-z0-9_.]+/i,
  /sql/i,
  /syntax error/i,
];

function asReadableString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function looksTechnical(text: string): boolean {
  if (!text) return false;
  if (text.length > 240) return true;
  return TECHNICAL_ERROR_PATTERNS.some((pattern) => pattern.test(text));
}

function pickPayloadMessage(payload: JsonRecord | null): string {
  if (!payload) return "";
  const candidates = [
    asReadableString(payload.userMessage),
    asReadableString(payload.error),
    asReadableString(payload.message),
  ];
  for (const candidate of candidates) {
    if (candidate) return candidate;
  }
  return "";
}

export function sanitizeErrorMessage(message: string, fallback: string): string {
  const cleanMessage = message.trim();
  if (!cleanMessage) return fallback;
  if (looksTechnical(cleanMessage)) return fallback;
  return cleanMessage;
}

/** User-facing copy when the Prolance project exists but has no quote yet. */
export const QUOTE_NOT_READY_USER_MESSAGE =
  "Quote not created yet. Please contact your designer.";

/** User-facing copy when the designer has not created the lead in Prolance. */
export const QUOTE_PROJECT_NOT_CREATED_USER_MESSAGE =
  "The designer has not created this lead's project in Prolance yet. Please contact your designer.";

/**
 * Hub often returns "Failed to resolve internal quote link" both when the quote
 * is missing and when CRM looked up the wrong lead id (numeric Hub id vs business id).
 */
export const QUOTE_RESOLVE_FAILED_USER_MESSAGE =
  "Could not match this lead to a Design quote. If the quote already exists in Design, confirm the lead business ID matches, then try Get Quote again.";

const QUOTE_RESOLVE_FAILED_PATTERNS: RegExp[] = [
  /failed to resolve\s+internal\s+quote/i,
  /resolve\s+internal\s+quote/i,
  /internal\s+quote\s+link/i,
];

const QUOTE_PROJECT_NOT_CREATED_PATTERNS: RegExp[] = [
  /^lead not found for externalLeadId$/i,
  /(?:no|missing)\s+prolance\s+project/i,
  /no\s+project\s+(?:found|created|available)/i,
  /prolance\s+project\s+(?:not\s+found|missing|does\s+not\s+exist|has\s+not\s+been\s+created)/i,
  /project\s+(?:not\s+found|missing|does\s+not\s+exist|has\s+not\s+been\s+created)/i,
  /(?:no|could\s+not\s+find)\s+project\s+(?:for|mapped\s+to|linked\s+to).*(?:lead|customer|external)/i,
  /(?:lead|customer|external).*(?:not\s+mapped|not\s+linked).*(?:project|prolance)/i,
];

const QUOTE_NOT_READY_PATTERNS: RegExp[] = [
  /^no quote found for this lead yet$/i,
  /no\s+quote\s+(?:created|found|generated|available)/i,
  /quote\s+(?:not\s+created|does\s+not\s+exist)/i,
  /quote\s+(?:link\s+)?(?:not\s+found|not\s+ready|not\s+available|unavailable|missing)/i,
  /quote\s+(?:has\s+)?not\s+(?:been\s+)?generated/i,
  /customer\s+(?:quote\s+)?link\s+(?:missing|not\s+found|unavailable)/i,
];

/**
 * Map Hub/design quote API errors to plain language.
 * Keeps already-friendly messages; replaces resolve/not-found jargon.
 */
export function toFriendlyQuoteErrorMessage(
  message: string,
  fallback: string = QUOTE_NOT_READY_USER_MESSAGE,
): string {
  const clean = message.trim();
  if (!clean) return fallback;
  if (QUOTE_PROJECT_NOT_CREATED_PATTERNS.some((pattern) => pattern.test(clean))) {
    return QUOTE_PROJECT_NOT_CREATED_USER_MESSAGE;
  }
  if (QUOTE_RESOLVE_FAILED_PATTERNS.some((pattern) => pattern.test(clean))) {
    return QUOTE_RESOLVE_FAILED_USER_MESSAGE;
  }
  if (QUOTE_NOT_READY_PATTERNS.some((pattern) => pattern.test(clean))) {
    return QUOTE_NOT_READY_USER_MESSAGE;
  }
  return sanitizeErrorMessage(clean, fallback);
}

/**
 * Prefer actionable quote errors while fallback lead IDs are attempted.
 * A confirmed project with no quote is strongest; otherwise prefer a clear
 * missing-project response over a generic lookup/transport error.
 */
export function quoteErrorMessagePriority(message: string): number {
  const friendly = toFriendlyQuoteErrorMessage(message);
  if (friendly === QUOTE_NOT_READY_USER_MESSAGE) return 3;
  if (friendly === QUOTE_PROJECT_NOT_CREATED_USER_MESSAGE) return 2;
  if (friendly === QUOTE_RESOLVE_FAILED_USER_MESSAGE) return 1;
  return 0;
}

export async function getFriendlyApiErrorMessage(
  response: Response,
  fallbackMessage: string,
): Promise<string> {
  let payload: JsonRecord | null = null;
  let text = "";

  try {
    payload = (await response.clone().json()) as JsonRecord;
  } catch {
    payload = null;
    try {
      text = await response.clone().text();
    } catch {
      text = "";
    }
  }

  const payloadMessage = pickPayloadMessage(payload);
  const rawMessage = payloadMessage || text.trim();
  return sanitizeErrorMessage(rawMessage, fallbackMessage);
}
