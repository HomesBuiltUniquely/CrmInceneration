import type { DealLedgerRow } from "@/app/Components/Incentives/data/mock-data";
import { journeyMarkers } from "@/app/Components/Incentives/data/mock-data";
import type { IncentiveBookingLead } from "@/lib/incentives-booking-data";
import {
  DEFAULT_INCENTIVE_PERIOD_TARGET_INR,
  periodTargetFromMonthly,
  type IncentivePeriodHalf,
} from "@/lib/incentive-period";
import { DEFAULT_MONTHLY_SALES_TARGET_INR } from "@/lib/sales-targets";
import { computeIncrementalWeightsByRecordId } from "@/lib/incentives-weighted";

export type IncentiveMemberRef = {
  id: number;
  name: string;
  role: string;
  managerId?: number | null;
  managerName?: string;
  /** CRM assignee aliases (fullName, username, email local-part) for admin matching. */
  assigneeAliases?: string[];
  /** Monthly revenue target in INR — default ₹60L from admin settings (₹30L per 15-day period). */
  monthlyTargetInr?: number;
};

export type IncentiveSlabRow = {
  tier: string;
  targetPct: number;
  revenue: string;
  incentivePct: string;
  potential: string;
  active: boolean;
};

export type IncentiveProfile = {
  member: IncentiveMemberRef;
  summary: {
    totalTarget: string;
    revenueAchieved: string;
    revenueDelta: string;
    achievementPct: number;
    incentiveEarned: string;
    /** True when total weighted ≥ 40% of 15-day period target. */
    incentiveEligible: boolean;
    onSpotBonus: string;
    nextSlabGap: string;
    currentSlabLabel: string;
    totalWeighted: string;
  };
  slabs: IncentiveSlabRow[];
  payoutMath: {
    revenueAchieved: string;
    periodTarget: string;
    eligibleSlab: string;
    multiplier: string;
    totalPayout: string;
  };
  speedBonuses: {
    totalClosures: number;
    sameDayCount: number;
    sameDayAmount: string;
    fortyEightHourCount: number;
    fortyEightHourAmount: string;
    totalSpeedBonus: string;
  };
  dealLedger: DealLedgerRow[];
};

const SLAB_DEFS = [
  { tier: "BASE THRESHOLD", targetPct: 40, rate: 0.2 },
  { tier: "HIGH PERFORMANCE", targetPct: 50, rate: 0.3 },
  { tier: "ELITE TIER", targetPct: 60, rate: 0.45 },
  { tier: "SUPER PERFORMER", targetPct: 80, rate: 0.6 },
  { tier: "MASTER CLOSER", targetPct: 100, rate: 0.8 },
] as const;

export type BuildIncentiveProfileOptions = {
  /** Payment records submitted in the selected 15-day period (ledger rows). */
  bookingLeads?: IncentiveBookingLead[];
  /** Full payment history for delta weighting across periods. */
  allBookingLeads?: IncentiveBookingLead[];
  /** 15-day half within the month — defaults to H1 when unset. */
  periodHalf?: IncentivePeriodHalf;
};

export function formatInr(amount: number): string {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

function initialsFromName(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

const MIN_ACHIEVEMENT_PCT = SLAB_DEFS[0].targetPct;

function eligibleSlabForAchievement(pct: number): (typeof SLAB_DEFS)[number] | null {
  if (pct < MIN_ACHIEVEMENT_PCT) return null;
  let picked: (typeof SLAB_DEFS)[number] | null = null;
  for (const slab of SLAB_DEFS) {
    if (pct >= slab.targetPct) picked = slab;
  }
  return picked;
}

/** Incentive = 15-day period target × slab rate — only when total weighted ≥ 40% of period target. */
export function calculateSlabIncentive(periodTargetInr: number, achievementPct: number): number {
  const eligible = eligibleSlabForAchievement(achievementPct);
  if (!eligible || periodTargetInr <= 0) return 0;
  return Math.round((periodTargetInr * eligible.rate) / 100);
}

function slabPotentialEarned(periodTargetInr: number, rate: number): number {
  return Math.round((periodTargetInr * rate) / 100);
}

function nextSlabGapAmount(target: number, achieved: number, pct: number): string {
  for (const slab of SLAB_DEFS) {
    const neededRevenue = (target * slab.targetPct) / 100;
    if (pct < slab.targetPct) {
      const gap = Math.max(0, neededRevenue - achieved);
      return `${formatInr(gap)} TO NEXT SLAB`;
    }
  }
  return "MAX SLAB REACHED";
}

function closureTimeForLead(lead: IncentiveBookingLead): DealLedgerRow["closureTime"] {
  const kind = String(lead.paymentKind ?? "").toUpperCase();
  if (kind === "TOKEN") return "TOKEN";
  return "BOOKING DONE";
}

export function buildIncentiveProfile(
  member: IncentiveMemberRef,
  options?: BuildIncentiveProfileOptions,
): IncentiveProfile {
  const monthlyTarget = member.monthlyTargetInr ?? DEFAULT_MONTHLY_SALES_TARGET_INR;
  const target = periodTargetFromMonthly(monthlyTarget) || DEFAULT_INCENTIVE_PERIOD_TARGET_INR;
  const monthLeads = options?.bookingLeads ?? [];
  const historyLeads = options?.allBookingLeads ?? monthLeads;
  const incrementalByRecord = computeIncrementalWeightsByRecordId(historyLeads);

  const sortedLeads = [...monthLeads].sort(
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
  );

  let totalWeighted = 0;
  const dealLedger: DealLedgerRow[] = [];
  for (const lead of sortedLeads) {
    const weight = incrementalByRecord.get(lead.id) ?? {
      incrementalInr: 0,
      cumulativeInr: 0,
      tier: "none" as const,
      label: "Not eligible",
    };
    if (weight.incrementalInr <= 0) continue;
    totalWeighted += weight.incrementalInr;
    dealLedger.push({
      id: lead.id,
      initials: initialsFromName(lead.customerName),
      leadLabel: lead.leadLabel,
      customer: lead.customerName,
      dealValue: formatInr(lead.quoteAmount),
      amountReceived: formatInr(lead.amountReceived),
      weighted: formatInr(weight.incrementalInr),
      weightLabel: weight.label,
      weightTier: weight.tier,
      closureTime: closureTimeForLead(lead),
      contributionPct: 0,
    });
  }

  const revenueAchieved = totalWeighted;
  const achievementPct =
    target > 0 ? Math.round((revenueAchieved / target) * 1000) / 10 : 0;
  const eligible = eligibleSlabForAchievement(achievementPct);
  const activeSlabPct = eligible?.targetPct ?? 0;
  const incentiveEarned = calculateSlabIncentive(target, achievementPct);

  if (revenueAchieved > 0) {
    for (const row of dealLedger) {
      const weightedNum = Number(row.weighted.replace(/[₹,]/g, ""));
      row.contributionPct =
        Math.round((weightedNum / revenueAchieved) * 1000) / 10;
    }
  }

  const slabs: IncentiveSlabRow[] = SLAB_DEFS.map((slab) => {
    const slabRevenue = Math.round((target * slab.targetPct) / 100);
    return {
      tier: slab.tier,
      targetPct: slab.targetPct,
      revenue: formatInr(slabRevenue),
      incentivePct: `${slab.rate.toFixed(2)}%`,
      potential: formatInr(slabPotentialEarned(target, slab.rate)),
      active: slab.targetPct === activeSlabPct,
    };
  });

  return {
    member,
    summary: {
      totalTarget: formatInr(target),
      revenueAchieved: formatInr(revenueAchieved),
      revenueDelta: dealLedger.length > 0
        ? `${dealLedger.length} booking${dealLedger.length === 1 ? "" : "s"}`
        : "—",
      achievementPct,
      incentiveEarned: formatInr(incentiveEarned),
      incentiveEligible: achievementPct >= MIN_ACHIEVEMENT_PCT,
      onSpotBonus: formatInr(0),
      nextSlabGap: nextSlabGapAmount(target, revenueAchieved, achievementPct),
      currentSlabLabel: eligible ? `${activeSlabPct}%` : "—",
      totalWeighted: formatInr(totalWeighted),
    },
    slabs,
    payoutMath: {
      revenueAchieved: formatInr(revenueAchieved),
      periodTarget: formatInr(target),
      eligibleSlab: eligible ? `${eligible.targetPct}%` : "Below 40%",
      multiplier: eligible ? `${eligible.rate.toFixed(2)}%` : "—",
      totalPayout: formatInr(incentiveEarned),
    },
    speedBonuses: {
      totalClosures: dealLedger.length,
      sameDayCount: 0,
      sameDayAmount: formatInr(0),
      fortyEightHourCount: 0,
      fortyEightHourAmount: formatInr(0),
      totalSpeedBonus: formatInr(0),
    },
    dealLedger,
  };
}

export { journeyMarkers };
