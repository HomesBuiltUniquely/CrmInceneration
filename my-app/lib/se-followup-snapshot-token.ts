import { createHmac, timingSafeEqual } from "crypto";
import type { FollowUpDaySnapshot } from "@/lib/sales-executive-followup-day-brief";

export type SnapshotTokenPayload = FollowUpDaySnapshot & {
  userId: number;
  dateKey: string;
};

function snapshotSecret(): string {
  return (
    process.env.CRM_FOLLOWUP_SNAPSHOT_SECRET?.trim() ||
    process.env.CRM_DEV_BEARER_TOKEN?.trim() ||
    "crm-followup-snapshot-dev-only"
  );
}

function b64urlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function b64urlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

export function signFollowUpSnapshotToken(payload: SnapshotTokenPayload): string {
  const body = b64urlEncode(JSON.stringify(payload));
  const sig = createHmac("sha256", snapshotSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyFollowUpSnapshotToken(
  token: string,
  expectedUserId: number,
  expectedDateKey: string,
): { ok: true; snapshot: FollowUpDaySnapshot } | { ok: false } {
  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false };
  const [body, sig] = parts;
  const expectedSig = createHmac("sha256", snapshotSecret()).update(body).digest("base64url");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false };
  } catch {
    return { ok: false };
  }
  let parsed: SnapshotTokenPayload;
  try {
    parsed = JSON.parse(b64urlDecode(body)) as SnapshotTokenPayload;
  } catch {
    return { ok: false };
  }
  if (Number(parsed.userId) !== Number(expectedUserId)) return { ok: false };
  if (String(parsed.dateKey) !== expectedDateKey) return { ok: false };
  if (!Array.isArray(parsed.items)) return { ok: false };
  return {
    ok: true,
    snapshot: {
      capturedAt: String(parsed.capturedAt ?? ""),
      totalDue: Number(parsed.totalDue ?? parsed.items.length),
      overdueAtCapture: Number(parsed.overdueAtCapture ?? 0),
      items: parsed.items,
    },
  };
}