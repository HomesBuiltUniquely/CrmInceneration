import { NextResponse } from "next/server";

type JsonRecord = Record<string, unknown>;

type UpstreamPayload = {
  text: string;
  json: JsonRecord | null;
  contentType: string;
};

function normalizeMessage(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function readUpstreamPayload(response: Response): Promise<UpstreamPayload> {
  const contentType = response.headers.get("Content-Type") ?? "application/json";
  const text = await response.text();
  let json: JsonRecord | null = null;

  if (text.trim()) {
    try {
      json = JSON.parse(text) as JsonRecord;
    } catch {
      json = null;
    }
  }

  return { text, json, contentType };
}

export function buildProxyErrorBody(args: {
  payload: UpstreamPayload;
  fallbackMessage: string;
}): JsonRecord {
  const { payload, fallbackMessage } = args;
  const userMessage =
    normalizeMessage(payload.json?.userMessage) ||
    normalizeMessage(payload.json?.error) ||
    normalizeMessage(payload.json?.message) ||
    fallbackMessage;

  const debugMessage =
    normalizeMessage(payload.json?.debugMessage) || normalizeMessage(payload.text);

  return {
    success: false,
    userMessage,
    error: userMessage,
    ...(debugMessage ? { debugMessage } : {}),
  };
}

export function proxyJsonError(
  status: number,
  payload: UpstreamPayload,
  fallbackMessage: string,
): NextResponse {
  const body = buildProxyErrorBody({ payload, fallbackMessage });
  return NextResponse.json(body, { status });
}
