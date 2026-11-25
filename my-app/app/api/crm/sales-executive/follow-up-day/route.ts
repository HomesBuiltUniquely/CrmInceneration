import { NextRequest, NextResponse } from "next/server";
import { normalizeRole } from "@/lib/auth/api";
import { resolveCrmAuthViewer } from "@/lib/crm-auth-viewer-server";
import { loadSalesExecutiveInsightPoolForRequest } from "@/lib/crm-leads-pool-server";
import { quoteForLocalDate } from "@/lib/se-followup-motivational-quotes";
import { firstNameFromDisplayName } from "@/lib/se-followup-modal-titles";
import {
  signFollowUpSnapshotToken,
  verifyFollowUpSnapshotToken,
} from "@/lib/se-followup-snapshot-token";
import { localCalendarDateKey } from "@/lib/se-followup-motivational-quotes";
import {
  buildEveningFollowUpBrief,
  buildMorningFollowUpBrief,
  buildSnapshotFromDueTodayLeads,
  filterLeadsDueTodayAll,
} from "@/lib/sales-executive-followup-day-brief";

export async function GET(req: NextRequest) {
  const variantRaw = (req.nextUrl.searchParams.get("variant") ?? "morning").trim().toLowerCase();
  const variant = variantRaw === "evening" ? "evening" : "morning";
  const snapshotTokenParam = req.nextUrl.searchParams.get("snapshotToken")?.trim() ?? "";

  const auth = await resolveCrmAuthViewer(req);
  if (!auth) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHORIZED", error: "Session expired or invalid." },
      { status: 401 },
    );
  }
  if (normalizeRole(auth.role) !== "SALES_EXECUTIVE") {
    return NextResponse.json(
      { ok: false, code: "FORBIDDEN", error: "Sales Executive only." },
      { status: 403 },
    );
  }
  if (!auth.active) {
    return NextResponse.json(
      { ok: false, code: "USER_INACTIVE", error: "Your CRM account is inactive." },
      { status: 409 },
    );
  }

  const now = new Date();
  const dateKey = localCalendarDateKey(now);
  const viewer = auth.viewerContext;
  const displayName = viewer.displayName || auth.displayName;
  const firstName = firstNameFromDisplayName(displayName) || "there";
  const quote = quoteForLocalDate(now);

  let pool;
  try {
    pool = await loadSalesExecutiveInsightPoolForRequest(req, viewer);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unable to load follow-ups.";
    return NextResponse.json(
      { ok: false, code: "UPSTREAM_UNAVAILABLE", error: message },
      { status: 503 },
    );
  }

  const dueToday = filterLeadsDueTodayAll(pool, displayName);
  const meta: {
    degraded?: boolean;
    reason?: string;
    allOutstandingFromSnapshot?: boolean;
  } = {};

  if (variant === "morning") {
    const brief = buildMorningFollowUpBrief(pool, displayName, now, 80);
    const snapshot = buildSnapshotFromDueTodayLeads(dueToday, now);
    const snapshotToken = signFollowUpSnapshotToken({
      ...snapshot,
      userId: viewer.userId,
      dateKey,
    });
    return NextResponse.json({
      ok: true,
      variant: "morning",
      firstName,
      quote,
      counts: {
        totalDue: brief.totalDue,
        followupsActive: brief.followupsActive,
        followupsClosure: brief.followupsClosure,
        overdueTotal: brief.overdueTotal,
        overdueActive: brief.overdueActive,
        overdueClosure: brief.overdueClosure,
      },
      firstUp: brief.firstUp,
      snapshotToken,
      generatedAt: now.toISOString(),
      meta,
    });
  }

  let snapshot = null as ReturnType<typeof buildSnapshotFromDueTodayLeads> | null;
  if (snapshotTokenParam) {
    const verified = verifyFollowUpSnapshotToken(
      snapshotTokenParam,
      viewer.userId,
      dateKey,
    );
    if (verified.ok) {
      snapshot = verified.snapshot;
    } else {
      meta.degraded = true;
      meta.reason = "Invalid or expired snapshot token.";
    }
  }
  if (!snapshot) {
    snapshot = buildSnapshotFromDueTodayLeads(dueToday, now);
    meta.degraded = true;
    meta.reason = meta.reason ?? "Snapshot captured at evening open.";
  }

  const evening = buildEveningFollowUpBrief(pool, displayName, snapshot, now, 20);
  if (evening.left === evening.totalDue && evening.totalDue > 0) {
    meta.allOutstandingFromSnapshot = true;
  }
  const refreshedToken = signFollowUpSnapshotToken({
    ...snapshot,
    userId: viewer.userId,
    dateKey,
  });

  return NextResponse.json({
    ok: true,
    variant: "evening",
    firstName,
    quote,
    counts: {
      totalDue: evening.totalDue,
      followupsActive: 0,
      followupsClosure: 0,
      overdueTotal: 0,
      overdueActive: 0,
      overdueClosure: 0,
      completed: evening.completed,
      left: evening.left,
      olderOverdueCleared: evening.olderOverdueCleared,
    },
    pending: evening.pendingRows,
    snapshotToken: refreshedToken,
    generatedAt: now.toISOString(),
    meta,
  });
}