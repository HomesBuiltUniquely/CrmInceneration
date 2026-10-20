"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { isDatePresetId, type DatePresetId } from "@/lib/meeting-date-range";
import type { MeetingProgress } from "@/lib/meeting-management-api";

export const MEETING_TABS = ["all", "scheduled", "rescheduled", "in-progress", "cancelled", "completed", "today", "upcoming"] as const;
export type MeetingTab = (typeof MEETING_TABS)[number];
export const PAGE_SIZES = [10, 25, 50] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

export type MeetingFilterState = {
  tab: MeetingTab;
  q: string;
  designerIds: string[];
  salesIds: string[];
  branchIds: string[];
  labels: string[];
  progress: MeetingProgress[];
  preset: DatePresetId | "";
  dateFrom: string;
  dateTo: string;
  page: number;
  pageSize: PageSize;
  overdue: boolean;
  quoteSent: boolean;
  quoteDelayed: boolean;
  meetingSuccessful: boolean;
};

function splitList(value: string | null): string[] {
  return (value ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

const PROGRESS_VALUES: MeetingProgress[] = ["SCHEDULED", "IN_PROGRESS", "MEETING_SUCCESSFUL"];

function isProgress(value: string): value is MeetingProgress {
  return (PROGRESS_VALUES as string[]).includes(value);
}

function isTab(value: string | null): value is MeetingTab {
  return MEETING_TABS.includes(value as MeetingTab);
}

export function useMeetingFilters() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const state = useMemo<MeetingFilterState>(() => {
    const sizeRaw = Number(params.get("pageSize"));
    const pageSize = (PAGE_SIZES as readonly number[]).includes(sizeRaw) ? (sizeRaw as PageSize) : 10;
    const presetRaw = params.get("preset") ?? "";
    return {
      tab: isTab(params.get("tab")) ? (params.get("tab") as MeetingTab) : "all",
      q: params.get("q") ?? "",
      designerIds: splitList(params.get("designerIds")),
      salesIds: splitList(params.get("salesIds")),
      branchIds: splitList(params.get("branchIds")),
      labels: splitList(params.get("labels")),
      progress: splitList(params.get("progress")).filter(isProgress),
      preset: isDatePresetId(presetRaw) ? presetRaw : "",
      dateFrom: params.get("dateFrom") ?? "",
      dateTo: params.get("dateTo") ?? "",
      page: Math.max(1, Number(params.get("page")) || 1),
      pageSize,
      overdue: params.get("overdue") === "1",
      quoteSent: params.get("quoteSent") === "1",
      quoteDelayed: params.get("quoteDelayed") === "1",
      meetingSuccessful: params.get("meetingSuccessful") === "1",
    };
  }, [params]);

  const write = useCallback(
    (patch: Partial<MeetingFilterState>, options?: { keepPage?: boolean }) => {
      const next: MeetingFilterState = { ...state, ...patch };
      if (!options?.keepPage && !Object.prototype.hasOwnProperty.call(patch, "page")) next.page = 1;
      const sp = new URLSearchParams();
      if (next.tab !== "all") sp.set("tab", next.tab);
      if (next.q.trim()) sp.set("q", next.q.trim());
      if (next.designerIds.length) sp.set("designerIds", next.designerIds.join(","));
      if (next.salesIds.length) sp.set("salesIds", next.salesIds.join(","));
      if (next.branchIds.length) sp.set("branchIds", next.branchIds.join(","));
      if (next.labels.length) sp.set("labels", next.labels.join(","));
      if (next.progress.length) sp.set("progress", next.progress.join(","));
      if (next.preset) sp.set("preset", next.preset);
      if (next.preset === "custom") {
        if (next.dateFrom) sp.set("dateFrom", next.dateFrom);
        if (next.dateTo) sp.set("dateTo", next.dateTo);
      }
      if (next.page > 1) sp.set("page", String(next.page));
      if (next.pageSize !== 10) sp.set("pageSize", String(next.pageSize));
      if (next.overdue) sp.set("overdue", "1");
      if (next.quoteSent) sp.set("quoteSent", "1");
      if (next.quoteDelayed) sp.set("quoteDelayed", "1");
      if (next.meetingSuccessful) sp.set("meetingSuccessful", "1");
      const qs = sp.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, state],
  );

  const peopleCount =
    (state.designerIds.length ? 1 : 0) +
    (state.salesIds.length ? 1 : 0) +
    (state.branchIds.length ? 1 : 0) +
    (state.labels.length ? 1 : 0) +
    (state.progress.length ? 1 : 0);
  const dateCount = state.preset ? 1 : 0;

  return { ...state, peopleCount, dateCount, write };
}
