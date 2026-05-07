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
