import { normalizeRole } from "@/lib/auth/api";
import { isAdminRole } from "@/lib/roleUtils";
import type {
  HubCallEvent,
  HubCallRecording,
  RecordingCallLogsFilterOptions,
  SummaryFiltersState,
  SummaryHubFilters,
} from "./types";
import { EMPTY_HUB_FILTERS } from "./types";
import { filterCallEvents, filterRecordings } from "./stats";

export type SummaryExecutivePerson = {
  displayName: string;
  isPresales: boolean;
  userId: number;
  matchNorms: string[];
};

export type SummaryExecutiveRow = {
  person: SummaryExecutivePerson;
  callCount: number;
  callTalkSec: number;
  recordingCount: number;
  recordingTalkSec: number;
};

function personFromOption(
  name: string,
  opts: { userId?: number; isPresales?: boolean },
): SummaryExecutivePerson {
  const displayName = name.trim();
  return {
    displayName,
    isPresales: Boolean(opts.isPresales),
    userId: opts.userId && opts.userId > 0 ? opts.userId : 0,
    matchNorms: displayName ? [displayName.toLowerCase()] : [],
  };
}

/** Build executive roster under viewer role + optional hub narrowing (mobile parity). */
export function buildExecutiveRoster(args: {
  role: string;
  options: RecordingCallLogsFilterOptions;
  hub: SummaryHubFilters;
}): SummaryExecutivePerson[] {
  const role = normalizeRole(args.role);
  const { options, hub } = args;
  const out: SummaryExecutivePerson[] = [];
  const seen = new Set<string>();

  const add = (name: string, isPresales: boolean, userId?: number) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(personFromOption(trimmed, { isPresales, userId }));
  };

  if (hub.salesExecutive) {
    add(hub.salesExecutive, false, hub.salesExecutiveUserId ?? undefined);
    return out;
  }
  if (hub.presalesExecutive) {
    add(hub.presalesExecutive, true);
    return out;
  }

  const salesExecs = options.salesExecutives;
  const presalesExecs =
    options.presalesExecutives.length > 0
      ? options.presalesExecutives
      : salesExecs.filter((e) =>
          (e.label + e.value).toLowerCase().includes("presales"),
        );

  if (role === "SALES_MANAGER") {
    const scoped = hub.salesManager
      ? salesExecs.filter(
          (e) =>
            e.managerName?.toLowerCase() === hub.salesManager.toLowerCase() ||
            (options.salesManagers.find((m) => m.value === hub.salesManager)
              ?.userId != null &&
              e.managerId ===
                options.salesManagers.find((m) => m.value === hub.salesManager)
                  ?.userId),
        )
      : salesExecs;
    for (const e of scoped) add(e.value, false, e.userId);
    return sortPeople(out);
  }

  if (role === "PRESALES_MANAGER") {
    for (const e of presalesExecs) add(e.value, true, e.userId);
    if (out.length === 0) {
      for (const e of salesExecs) add(e.value, true, e.userId);
    }
    return sortPeople(out);
  }

  if (isAdminRole(role) || role === "SALES_ADMIN") {
    if (hub.salesManager) {
      const mgr = options.salesManagers.find((m) => m.value === hub.salesManager);
      for (const e of salesExecs) {
        const under =
          (mgr?.userId != null && e.managerId === mgr.userId) ||
          e.managerName?.toLowerCase() === hub.salesManager.toLowerCase();
        if (under || !hub.salesManager) add(e.value, false, e.userId);
      }
      // If cascade metadata missing, fall back to all sales execs under filter options.
      if (out.length === 0) {
        for (const e of salesExecs) add(e.value, false, e.userId);
      }
      return sortPeople(out);
    }
    if (hub.presalesManager) {
      for (const e of presalesExecs) add(e.value, true, e.userId);
      return sortPeople(out);
    }
    if (hub.branch) {
      // Branch-level names aren't fully modeled on web filter options; show all sales execs.
      for (const e of salesExecs) add(e.value, false, e.userId);
      for (const e of presalesExecs) add(e.value, true, e.userId);
      return sortPeople(out);
    }
    for (const e of salesExecs) add(e.value, false, e.userId);
    for (const e of presalesExecs) add(e.value, true, e.userId);
    return sortPeople(out);
  }

  return [];
}

function sortPeople(rows: SummaryExecutivePerson[]): SummaryExecutivePerson[] {
  return [...rows].sort((a, b) =>
    a.displayName.toLowerCase().localeCompare(b.displayName.toLowerCase()),
  );
}

function indexForPerson(
  roster: SummaryExecutivePerson[],
  userId: number,
  executiveName: string,
): number | null {
  const byUserId = new Map<number, number>();
  const byNorm = new Map<string, number>();
  roster.forEach((p, i) => {
    if (p.userId > 0) byUserId.set(p.userId, i);
    for (const n of p.matchNorms) byNorm.set(n, i);
  });

  if (userId > 0) {
    const hit = byUserId.get(userId);
    if (hit != null) return hit;
  }
  const raw = executiveName.trim().toLowerCase();
  if (!raw) return null;
  const exact = byNorm.get(raw);
  if (exact != null) return exact;
  for (const [norm, i] of byNorm.entries()) {
    if (norm.length < 2) continue;
    if (raw.includes(norm) || norm.includes(raw)) return i;
  }
  return null;
}

/** Aggregate call + recording totals per executive (mobile SummaryExecutiveTotals). */
export function aggregateExecutiveTotals(args: {
  roster: SummaryExecutivePerson[];
  events: HubCallEvent[];
  recordings: HubCallRecording[];
  filters: SummaryFiltersState;
}): SummaryExecutiveRow[] {
  const { roster, filters } = args;
  if (roster.length === 0) return [];

  const events = filterCallEvents(args.events, {
    leadTypeKey: filters.leadTypeKey,
    duration: filters.duration,
    hub: filters.hub,
  });
  const recordings = filterRecordings(args.recordings, {
    leadTypeKey: filters.leadTypeKey,
    duration: filters.duration,
    hub: filters.hub,
  });

  const callCounts = Array.from({ length: roster.length }, () => 0);
  const callTalk = Array.from({ length: roster.length }, () => 0);
  const recCounts = Array.from({ length: roster.length }, () => 0);
  const recTalk = Array.from({ length: roster.length }, () => 0);

  for (const e of events) {
    const i = indexForPerson(roster, e.userId, e.executiveName);
    if (i == null) continue;
    callCounts[i]++;
    callTalk[i] += e.durationSec;
  }
  for (const r of recordings) {
    const i = indexForPerson(roster, r.userId, r.executiveName);
    if (i == null) continue;
    recCounts[i]++;
    recTalk[i] += r.durationSec;
  }

  const rows: SummaryExecutiveRow[] = roster.map((person, i) => ({
    person,
    callCount: callCounts[i],
    callTalkSec: callTalk[i],
    recordingCount: recCounts[i],
    recordingTalkSec: recTalk[i],
  }));

  rows.sort((a, b) => {
    const byCalls = b.callCount - a.callCount;
    if (byCalls !== 0) return byCalls;
    const byRec = b.recordingCount - a.recordingCount;
    if (byRec !== 0) return byRec;
    return a.person.displayName
      .toLowerCase()
      .localeCompare(b.person.displayName.toLowerCase());
  });
  return rows;
}

/** Lock filters to one executive while keeping period/duration/hub extras. */
export function filtersForExecutive(
  base: SummaryFiltersState,
  person: SummaryExecutivePerson,
): SummaryFiltersState {
  return {
    ...base,
    hub: {
      ...EMPTY_HUB_FILTERS,
      branch: base.hub.branch,
      salesAdmin: base.hub.salesAdmin,
      salesManager: person.isPresales ? "" : base.hub.salesManager,
      salesExecutive: person.isPresales ? "" : person.displayName,
      salesExecutiveUserId: person.isPresales
        ? null
        : person.userId > 0
          ? person.userId
          : null,
      presalesManager: person.isPresales ? base.hub.presalesManager : "",
      presalesExecutive: person.isPresales ? person.displayName : "",
      reinquiry: base.hub.reinquiry,
    },
  };
}

export function isManagerRole(role: string): boolean {
  const r = normalizeRole(role);
  return r === "SALES_MANAGER" || r === "PRESALES_MANAGER";
}
