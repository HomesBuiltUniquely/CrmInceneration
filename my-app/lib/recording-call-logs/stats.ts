import { formatDurationLabel, formatTalkTime, formatWhenLabel, maskPhone } from "./format";
import { resolveDurationRange } from "./filters";
import type {
  ActivityListRow,
  CallDirection,
  HubCallEvent,
  HubCallRecording,
  SummaryDuration,
  SummaryHubFilters,
  SummaryMetric,
} from "./types";

function outcomeToDirection(outcome: string, durationSec: number): CallDirection {
  const o = outcome.toUpperCase();
  if (o === "REJECTED" || o === "BLOCKED") return "Sales rejected";
  if (o === "OUTGOING" && durationSec <= 0) return "Client rejected";
  if (o === "INCOMING" || o === "IN") return "Incoming";
  if (o === "OUTGOING" || o === "OUT") return "Outgoing";
  if (o === "MISSED" || o === "VOICEMAIL") return "Missed";
  return "Missed";
}

function recordingDirection(raw: string): CallDirection {
  const d = raw.toUpperCase();
  if (d === "IN" || d === "INCOMING" || d === "INBOUND") return "Incoming";
  return "Outgoing";
}

function matchesLeadType(leadType: string, leadTypeKey: string): boolean {
  if (!leadTypeKey) return true;
  return leadType.trim().toLowerCase() === leadTypeKey.trim().toLowerCase();
}

function matchesDuration(sec: number, duration: SummaryDuration): boolean {
  const range = resolveDurationRange(duration);
  if (!range) return true;
  return sec >= range.minSec && sec <= range.maxSec;
}

function matchesHubPerson(
  executiveName: string,
  userId: number | undefined,
  hub: SummaryHubFilters,
): boolean {
  const selectedName = (
    hub.salesExecutive ||
    hub.presalesExecutive ||
    hub.assignee ||
    hub.salesManager ||
    hub.presalesManager ||
    hub.salesAdmin ||
    ""
  ).trim().toLowerCase();

  if (hub.salesExecutiveUserId != null && hub.salesExecutiveUserId > 0) {
    return userId === hub.salesExecutiveUserId;
  }
  if (!selectedName && !hub.branch) return true;
  if (!selectedName) return true;
  const name = executiveName.trim().toLowerCase();
  if (!name) return false;
  return name === selectedName || name.includes(selectedName) || selectedName.includes(name);
}

export function filterCallEvents(
  events: HubCallEvent[],
  opts: {
    leadTypeKey: string;
    duration: SummaryDuration;
    hub: SummaryHubFilters;
  },
): HubCallEvent[] {
  return events.filter((e) => {
    if (!matchesLeadType(e.leadType, opts.leadTypeKey)) return false;
    if (!matchesDuration(e.durationSec, opts.duration)) return false;
    if (!matchesHubPerson(e.executiveName, e.userId, opts.hub)) return false;
    return true;
  });
}

export function filterRecordings(
  recordings: HubCallRecording[],
  opts: {
    leadTypeKey: string;
    duration: SummaryDuration;
    hub: SummaryHubFilters;
  },
): HubCallRecording[] {
  return recordings.filter((r) => {
    if (!isListableRecording(r)) return false;
    if (!matchesLeadType(r.leadType, opts.leadTypeKey)) return false;
    if (!matchesDuration(r.durationSec, opts.duration)) return false;
    if (!matchesHubPerson(r.executiveName, r.userId, opts.hub)) return false;
    return true;
  });
}

function isListableRecording(r: HubCallRecording): boolean {
  const code = (r.errorCode || "").toUpperCase();
  if (
    ["NOT_A_LEAD", "STAFF_NUMBER", "AMBIGUOUS_LEAD", "NOT_CONNECTED", "FILTER_REJECTED"].includes(
      code,
    )
  ) {
    return false;
  }
  if (r.status === "rejected_filter") return false;
  if (r.leadId <= 0 || r.leadType.toLowerCase() === "unknown") return false;
  return true;
}

export function buildCallMetrics(events: HubCallEvent[]): SummaryMetric[] {
  let incoming = 0;
  let incomingDur = 0;
  let outgoing = 0;
  let outgoingDur = 0;
  let missed = 0;
  let clientRejected = 0;
  let salesRejected = 0;

  for (const e of events) {
    const dir = outcomeToDirection(e.outcome, e.durationSec);
    if (dir === "Sales rejected") {
      salesRejected++;
      continue;
    }
    if (dir === "Client rejected") {
      clientRejected++;
      continue;
    }
    if (dir === "Incoming") {
      incoming++;
      incomingDur += e.durationSec;
      continue;
    }
    if (dir === "Outgoing") {
      outgoing++;
      outgoingDur += e.durationSec;
      continue;
    }
    missed++;
  }

  const total = incoming + outgoing + missed + clientRejected + salesRejected;
  const totalDur = incomingDur + outgoingDur;

  return [
    metric("total", "Total", total, totalDur, "navy"),
    metric("incoming", "Incoming", incoming, incomingDur, "teal"),
    metric("outgoing", "Outgoing", outgoing, outgoingDur, "blue"),
    metric("missed", "Missed", missed, 0, "red"),
    metric("client_rejected", "Client rejected", clientRejected, 0, "amber"),
    metric("sales_rejected", "Sales rejected", salesRejected, 0, "violet"),
  ];
}

export function buildRecordingMetrics(recordings: HubCallRecording[]): SummaryMetric[] {
  let incoming = 0;
  let incomingDur = 0;
  let outgoing = 0;
  let outgoingDur = 0;

  for (const r of recordings) {
    const dir = recordingDirection(r.direction);
    if (dir === "Incoming") {
      incoming++;
      incomingDur += r.durationSec;
    } else {
      outgoing++;
      outgoingDur += r.durationSec;
    }
  }

  return [
    metric("total", "Total", incoming + outgoing, incomingDur + outgoingDur, "navy"),
    metric("incoming", "Incoming", incoming, incomingDur, "teal"),
    metric("outgoing", "Outgoing", outgoing, outgoingDur, "blue"),
  ];
}

function metric(
  id: string,
  label: string,
  count: number,
  talkTimeSec: number,
  tone: SummaryMetric["tone"],
): SummaryMetric {
  return {
    id,
    label,
    count,
    talkTimeSec,
    talkTimeLabel: formatTalkTime(talkTimeSec),
    tone,
  };
}

export function callEventsToRows(events: HubCallEvent[]): ActivityListRow[] {
  return events
    .map((e) => {
      const direction = outcomeToDirection(e.outcome, e.durationSec);
      return {
        id: `ce-${e.eventId}`,
        leadName: e.leadDisplayName || "Unknown lead",
        leadId: e.leadDisplayId || (e.leadId > 0 ? String(e.leadId) : "—"),
        leadType: e.leadType,
        direction,
        executive: e.executiveName || "—",
        executiveUserId: e.userId,
        startedAt: e.startedAt,
        startedAtLabel: formatWhenLabel(e.startedAt),
        durationSec: e.durationSec,
        durationLabel: formatDurationLabel(e.durationSec),
        phoneMasked: maskPhone(e.peerPhone),
        hasRecording: e.hasRecording,
        recordingId: e.recordingId ?? undefined,
      };
    })
    .sort((a, b) => (b.startedAt || "").localeCompare(a.startedAt || ""));
}

export function recordingsToRows(recordings: HubCallRecording[]): ActivityListRow[] {
  return recordings
    .map((r) => ({
      id: `cr-${r.recordingId}`,
      leadName: r.leadDisplayName || "Unknown lead",
      leadId: r.leadDisplayId || (r.leadId > 0 ? String(r.leadId) : "—"),
      leadType: r.leadType,
      direction: recordingDirection(r.direction),
      executive: r.executiveName || "—",
      executiveUserId: r.userId,
      startedAt: r.startedAt,
      startedAtLabel: formatWhenLabel(r.startedAt),
      durationSec: r.durationSec,
      durationLabel: formatDurationLabel(r.durationSec),
      phoneMasked: maskPhone(r.peerPhone),
      hasRecording: r.uploaded,
      recordingId: r.recordingId,
    }))
    .sort((a, b) => (b.startedAt || "").localeCompare(a.startedAt || ""));
}

export function filterRowsByMetric(
  rows: ActivityListRow[],
  metricId: string | null,
): ActivityListRow[] {
  if (!metricId || metricId === "total") return rows;
  const map: Record<string, CallDirection> = {
    incoming: "Incoming",
    outgoing: "Outgoing",
    missed: "Missed",
    client_rejected: "Client rejected",
    sales_rejected: "Sales rejected",
  };
  const dir = map[metricId];
  if (!dir) return rows;
  return rows.filter((r) => r.direction === dir);
}

export function filterRowsBySearch(rows: ActivityListRow[], search: string): ActivityListRow[] {
  const q = search.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((row) =>
    [row.leadName, row.leadId, row.executive, row.phoneMasked, row.direction, row.leadType]
      .join(" ")
      .toLowerCase()
      .includes(q),
  );
}
