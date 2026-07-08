"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchIncentiveBookingLeads,
  fetchIncentiveBookingLeadsForExecutive,
  resolveIncentiveLeadsForPeriod,
  type IncentiveBookingLead,
} from "@/lib/incentives-booking-data";
import type { IncentivePeriodHalf } from "@/lib/incentive-period";
import type { IncentiveMemberRef } from "@/lib/incentives-profile";
import { buildIncentiveProfile } from "@/lib/incentives-profile";

type Props = {
  members: IncentiveMemberRef[];
  monthKey: string;
  periodHalf: IncentivePeriodHalf;
  viewerId: number;
  canPickTeam: boolean;
  selectedId: number | null;
  onSelect: (id: number) => void;
};

export default function TeamIncentivesOverview({
  members,
  monthKey,
  periodHalf,
  viewerId,
  canPickTeam,
  selectedId,
  onSelect,
}: Props) {
  const memberIds = useMemo(() => members.map((m) => m.id).join(","), [members]);
  const [leadsByMemberId, setLeadsByMemberId] = useState<Map<number, IncentiveBookingLead[]>>(
    new Map(),
  );
  const [selfLeads, setSelfLeads] = useState<IncentiveBookingLead[]>([]);

  useEffect(() => {
    if (!canPickTeam) {
      let cancelled = false;
      void (async () => {
        const leads = await fetchIncentiveBookingLeads();
        if (!cancelled) setSelfLeads(leads);
      })();
      return () => {
        cancelled = true;
      };
    }

    let cancelled = false;
    void (async () => {
      const entries = await Promise.all(
        members.map(async (member) => {
          const leads = await fetchIncentiveBookingLeadsForExecutive(member);
          return [member.id, leads] as const;
        }),
      );
      if (!cancelled) setLeadsByMemberId(new Map(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [canPickTeam, memberIds, members]);

  const rows = members.map((member) => {
    const scoped = canPickTeam
      ? (leadsByMemberId.get(member.id) ?? [])
      : member.id === viewerId
        ? selfLeads
        : [];
    const forPeriod = resolveIncentiveLeadsForPeriod(scoped, monthKey, periodHalf);
    return {
      member,
      profile: buildIncentiveProfile(member, {
        bookingLeads: forPeriod,
        allBookingLeads: scoped,
        periodHalf,
      }),
    };
  });

  return (
    <section className="mb-6 rounded-xl border border-[var(--inc-border)] bg-[var(--inc-surface)] p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--inc-text)]">
            Team Incentives Overview
          </h3>
          <p className="mt-1 text-[12px] text-[var(--inc-muted)]">
            Weighted revenue from booking-done leads per executive.
          </p>
        </div>
        <span className="rounded-full bg-[#eff6ff] px-3 py-1 text-[11px] font-bold text-[#2563eb]">
          {members.length} member{members.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-[var(--inc-border)] text-[10px] font-bold uppercase tracking-wide text-[var(--inc-muted)]">
              <th className="pb-3 pr-4">Executive</th>
              <th className="pb-3 pr-4">Manager</th>
              <th className="pb-3 pr-4">Bookings</th>
              <th className="pb-3 pr-4">Weighted Revenue</th>
              <th className="pb-3 pr-4">Achievement</th>
              <th className="pb-3 pr-4">Incentive Earned</th>
              <th className="pb-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ member, profile }) => {
              const selected = selectedId === member.id;
              return (
                <tr
                  key={member.id}
                  className={`border-b border-[#f1f5f9] ${selected ? "bg-[var(--inc-green-soft)]" : ""}`}
                >
                  <td className="py-3 pr-4 font-semibold text-[var(--inc-text)]">{member.name}</td>
                  <td className="py-3 pr-4 text-[var(--inc-muted)]">{member.managerName ?? "—"}</td>
                  <td className="py-3 pr-4 text-[var(--inc-muted)]">{profile.dealLedger.length}</td>
                  <td className="py-3 pr-4 font-semibold text-[var(--inc-text)]">
                    {profile.summary.revenueAchieved}
                  </td>
                  <td className="py-3 pr-4">{profile.summary.achievementPct}%</td>
                  <td className="py-3 pr-4 font-bold text-[var(--inc-green-dark)]">
                    {profile.summary.incentiveEarned}
                  </td>
                  <td className="py-3">
                    <button
                      type="button"
                      onClick={() => onSelect(member.id)}
                      className={`rounded-md px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide ${
                        selected
                          ? "bg-[var(--inc-green)] text-[#05220f]"
                          : "border border-[var(--inc-border)] bg-white text-[var(--inc-text)] hover:bg-[#f8fafc]"
                      }`}
                    >
                      {selected ? "Viewing" : "View"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
