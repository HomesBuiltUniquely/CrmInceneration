"use client";

import { useEffect, useMemo, useState } from "react";
import { normalizeRole } from "@/lib/auth/api";
import { getCrmAuthHeaders } from "@/lib/crm-client-auth";
import type { ApiLead, SpringPage } from "@/lib/leads-filter";
import {
  filterLeadsForInsightMode,
  type InsightTableMode,
} from "@/lib/lead-follow-up-insights";
import { narrowSalesManagerLeadsIfTeamKnown } from "@/lib/sales-manager-lead-scope";

type Phase = {
  phaseLabel: string;
  name: string;
  count: number;
  sharePct: number;
  tone: "healthy" | "warning" | "critical";
  note: { icon: "clock" | "alert" | "money" | "check"; text: string };
};

export type JourneyPhaseHeatmapProps = {
  /** Query string for `/Leads/crm-milestone-counts-filtered` (no leading `?`), e.g. `leadType=all&search=foo` */
  milestoneFilterQuery?: string;
  currentRole?: string;
  leadView?: "default" | "my" | "team";
  currentUserName?: string;
  managerTeamNames?: string[];
  /** When set (e.g. Team Leads), phase counts use the same subset as the leads table insight filter. */
  insightTableMode?: InsightTableMode | null;
};

function normName(s: string) {
  return s.trim().toLowerCase();
}

function toneByCount(count: number, max: number): Phase["tone"] {
  if (max <= 0 || count <= 0) return "critical";
  const ratio = count / max;
  if (ratio >= 0.67) return "healthy";
  if (ratio >= 0.34) return "warning";
  return "critical";
}

function mapLeadsToPhases(leads: ApiLead[], defaults: Phase[]): Phase[] {
  const counts = new Map<string, number>();
  for (const lead of leads) {
    const stage = (lead.stage?.milestoneStage ?? "").trim();
    if (!stage) continue;
    counts.set(stage, (counts.get(stage) ?? 0) + 1);
  }
  const total = [...counts.values()].reduce((sum, n) => sum + n, 0);
  const max = Math.max(...counts.values(), 0);
  return defaults.map((phase) => {
    const count = [...counts.entries()].find(([k]) => normName(k) === normName(phase.name))?.[1] ?? 0;
    return {
      ...phase,
      count,
      sharePct: total > 0 ? Math.round((count / total) * 100) : 0,
      tone: toneByCount(count, max),
      note: {
        icon: phase.note.icon,
        text: count === 0 ? "No leads in this stage." : `${count} lead${count === 1 ? "" : "s"} in this stage.`,
      },
    };
  });
}

function Icon({ kind }: { kind: Phase["note"]["icon"] }) {
  if (kind === "clock")
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-3.5 w-3.5 text-[var(--crm-text-muted)]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10Z"
          stroke="currentColor"
          strokeWidth="1.7"
        />
        <path
          d="M12 7v5l3 2"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  if (kind === "alert")
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-3.5 w-3.5 text-[var(--crm-danger-text)]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M12 9v4"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d="M12 17h.01"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <path
          d="M10.3 3.6c.8-1.4 2.6-1.4 3.4 0l8 13.8c.8 1.4-.2 3.1-1.7 3.1H4c-1.6 0-2.5-1.7-1.7-3.1l8-13.8Z"
          stroke="currentColor"
          strokeWidth="1.4"
        />
      </svg>
    );
  if (kind === "money")
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-3.5 w-3.5 text-[var(--crm-text-muted)]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M4 7h16v10H4V7Z" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M7 10h.01M17 14h.01"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path
          d="M12 10.2c1.3 0 2.3.8 2.3 1.8S13.3 13.8 12 13.8s-2.3-.8-2.3-1.8 1-1.8 2.3-1.8Z"
          stroke="currentColor"
          strokeWidth="1.4"
        />
      </svg>
    );
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5 text-[var(--crm-success-text)]"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M20 6 9 17l-5-5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StatusLegend() {
  return (
    <div className="flex items-center gap-5 text-[10px] font-semibold tracking-wide text-[var(--crm-text-muted)]">
      <div className="flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full bg-[var(--crm-success)]" />
        Higher count
      </div>
      <div className="flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full bg-[var(--crm-warning-text)]" />
        Medium count
      </div>
      <div className="flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full bg-[var(--crm-danger)]" />
        Lower count
      </div>
    </div>
  );
}

function PhaseCard({ p, maxCount }: { p: Phase; maxCount: number }) {
  const bar =
    p.tone === "healthy"
      ? "bg-[var(--crm-success)]"
      : p.tone === "warning"
        ? "bg-[var(--crm-warning-text)]"
        : "bg-[var(--crm-danger)]";
  const bg =
    p.tone === "healthy"
      ? "bg-[var(--crm-success-bg)]"
      : p.tone === "warning"
        ? "bg-[var(--crm-warning-bg)]"
        : "bg-[var(--crm-danger-bg)]";
  const shareText =
    p.tone === "healthy"
      ? "text-[var(--crm-success-text)]"
      : p.tone === "warning"
        ? "text-[var(--crm-warning-text)]"
        : "text-[var(--crm-danger-text)]";
  const barWidth = maxCount > 0 ? (p.count / maxCount) * 100 : 0;

  return (
    <div
      className={`relative rounded-2xl border border-[var(--crm-border)] ${bg} px-5 py-4`}
    >
      <div className="text-[10px] font-semibold tracking-wide text-[var(--crm-text-muted)]">
        {p.phaseLabel}
      </div>
      <div className="mt-2 flex items-start justify-between">
        <div className="max-w-[70%] text-[18px] font-bold leading-6 text-[var(--crm-text-primary)]">
          {p.name}
        </div>
        <div className="text-right">
          <div className="text-[20px] font-semibold text-[var(--crm-text-primary)]">
            {p.count}
          </div>
          <div className={`text-[10px] font-semibold ${shareText}`}>
            {p.sharePct}% of total
          </div>
        </div>
      </div>
      <div className="mt-3 h-1.5 w-full rounded-full bg-[var(--crm-surface)]/70">
        <div
          className={`h-1.5 rounded-full ${bar}`}
          style={{ width: `${Math.min(100, barWidth)}%` }}
        />
      </div>
      <div className="mt-3 flex items-center gap-2 text-[10px] font-semibold text-[var(--crm-text-muted)]">
        <Icon kind={p.note.icon} />
        <span>{p.note.text}</span>
      </div>
      <div
        className={`absolute bottom-0 left-0 h-1.5 w-full rounded-b-2xl ${bar}`}
      />
    </div>
  );
}

const DEFAULT_PHASES: Phase[] = [
  {
    phaseLabel: "PHASE 01",
    name: "Discovery",
    count: 0,
    sharePct: 0,
    tone: "healthy",
    note: { icon: "clock", text: "Avg. 3.2 Days in Stage" },
  },
  {
    phaseLabel: "PHASE 02",
    name: "Connection",
    count: 0,
    sharePct: 0,
    tone: "warning",
    note: { icon: "clock", text: "34 Leads past SLA" },
  },
  {
    phaseLabel: "PHASE 03",
    name: "Experience & Design",
    count: 0,
    sharePct: 0,
    tone: "critical",
    note: { icon: "alert", text: "Critical Path (48h)" },
  },
  {
    phaseLabel: "PHASE 04",
    name: "Decision",
    count: 0,
    sharePct: 0,
    tone: "warning",
    note: { icon: "money", text: "$2.4M Pipeline Value" },
  },
  {
    phaseLabel: "PHASE 05",
    name: "Closed",
    count: 0,
    sharePct: 0,
    tone: "healthy",
    note: { icon: "check", text: "86% Conversion" },
  },
];

export default function JourneyPhaseHeatmap({
  milestoneFilterQuery,
  currentRole = "",
  leadView = "default",
  currentUserName = "",
  managerTeamNames = [],
  insightTableMode = null,
}: JourneyPhaseHeatmapProps = {}) {
  const [poolLeads, setPoolLeads] = useState<ApiLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const insightOpts = useMemo(
    () => ({
      viewerRole: normalizeRole(currentRole),
      currentUserName: currentUserName ?? "",
      managerTeamNames,
      leadView:
        leadView === "my" || leadView === "team" ? leadView : ("default" as const),
    }),
    [currentRole, currentUserName, managerTeamNames, leadView],
  );

  const phases = useMemo(() => {
    const filtered = filterLeadsForInsightMode(
      poolLeads,
      insightTableMode ?? null,
      insightOpts,
    );
    return mapLeadsToPhases(filtered, DEFAULT_PHASES);
  }, [poolLeads, insightTableMode, insightOpts]);

  const maxCount = Math.max(...phases.map((phase) => phase.count), 0);

  useEffect(() => {
    let cancelled = false;

    async function loadMilestoneCounts() {
      try {
        setLoading(true);
        setError("");

        const filtered = milestoneFilterQuery?.trim();
        const query = new URLSearchParams(filtered ?? "");
        query.set("mergeAll", "1");
        query.set("page", "0");
        query.set("size", "100");
        query.set("sort", "updatedAt,desc");
        const firstRes = await fetch(`/api/crm/leads?${query.toString()}`, {
          cache: "no-store",
          credentials: "include",
          headers: getCrmAuthHeaders(),
        });
        if (!firstRes.ok) {
          const text = await firstRes.text();
          throw new Error(text || `HTTP ${firstRes.status}`);
        }
        const firstPage = (await firstRes.json()) as SpringPage<ApiLead>;
        const allLeads: ApiLead[] = Array.isArray(firstPage.content) ? [...firstPage.content] : [];
        const totalPages = Math.max(1, Number(firstPage.totalPages ?? 1));
        if (totalPages > 1) {
          const followUps = [];
          for (let p = 1; p < Math.min(totalPages, 20); p++) {
            const nextQuery = new URLSearchParams(query);
            nextQuery.set("page", String(p));
            followUps.push(
              fetch(`/api/crm/leads?${nextQuery.toString()}`, {
                cache: "no-store",
                credentials: "include",
                headers: getCrmAuthHeaders(),
              }).then(async (r) => {
                if (!r.ok) return [] as ApiLead[];
                const json = (await r.json().catch(() => ({}))) as SpringPage<ApiLead>;
                return Array.isArray(json.content) ? json.content : [];
              })
            );
          }
          const rest = await Promise.all(followUps);
          for (const chunk of rest) allLeads.push(...chunk);
        }

        const roleKey = normalizeRole(currentRole);
        const pool =
          roleKey === "SALES_MANAGER"
            ? narrowSalesManagerLeadsIfTeamKnown(
                allLeads,
                currentUserName ?? "",
                managerTeamNames,
              )
            : allLeads;

        const ownerName = (lead: ApiLead) =>
          String(
            (typeof lead.assignee === "string" ? lead.assignee : lead.assignee?.name) ??
            (typeof lead.salesOwner === "string" ? lead.salesOwner : lead.salesOwner?.name) ??
            ""
          ).trim();
        const norm = (v: string) => v.trim().toLowerCase();
        const teamSet = new Set(managerTeamNames.map(norm));
        const scopedLeads =
          roleKey === "SALES_MANAGER" && leadView === "my"
            ? pool.filter((lead) => norm(ownerName(lead)) === norm(currentUserName))
            : roleKey === "SALES_MANAGER" && leadView === "team"
              ? managerTeamNames.length > 0
                ? pool.filter((lead) => teamSet.has(norm(ownerName(lead))))
                : pool
              : pool;
        if (!cancelled) {
          setPoolLeads(scopedLeads);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Something went wrong.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadMilestoneCounts();

    return () => {
      cancelled = true;
    };
  }, [milestoneFilterQuery, currentRole, leadView, currentUserName, managerTeamNames]);

  return (
    <section className="mx-auto mt-6 max-w-[1200px] px-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[16px] font-semibold text-[var(--crm-text-primary)]">
              Journey Phase Heatmap
            </span>
          </div>
        </div>
        <StatusLegend />
      </div>

      <div className="mt-4 rounded-2xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-4 shadow-[var(--crm-shadow-sm)]">
        {loading || error ? (
          <div className="mb-3 text-[11px] font-medium text-[var(--crm-text-muted)]">
            {loading ? "Loading milestone counts from CRM API..." : `Could not load counts: ${error}`}
          </div>
        ) : null}
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-5">
          {phases.map((p) => (
            <PhaseCard key={`${p.phaseLabel}-${p.name}`} p={p} maxCount={maxCount} />
          ))}
        </div>
      </div>
    </section>
  );
}
