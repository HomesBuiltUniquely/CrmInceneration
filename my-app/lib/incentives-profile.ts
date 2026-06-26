import type { DealLedgerRow } from "@/app/Components/Incentives/data/mock-data";
import { journeyMarkers } from "@/app/Components/Incentives/data/mock-data";

export type IncentiveMemberRef = {
  id: number;
  name: string;
  role: string;
  managerId?: number | null;
  managerName?: string;
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
    onSpotBonus: string;
    nextSlabGap: string;
    currentSlabLabel: string;
  };
  slabs: IncentiveSlabRow[];
  payoutMath: {
    revenueAchieved: string;
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
  { tier: "BASE THRESHOLD", targetPct: 40, revenue: 20_00_000, rate: 0.2 },
  { tier: "HIGH PERFORMANCE", targetPct: 50, revenue: 25_00_000, rate: 0.3 },
  { tier: "ELITE TIER", targetPct: 60, revenue: 30_00_000, rate: 0.45 },
  { tier: "SUPER PERFORMER", targetPct: 80, revenue: 40_00_000, rate: 0.6 },
  { tier: "MASTER CLOSER", targetPct: 100, revenue: 50_00_000, rate: 0.8 },
] as const;

const SAMPLE_CUSTOMERS = [
  "Juned Shaikh",
  "Viren Shah",
  "Ajay Gupta",
  "Rahul Kulkarni",
  "Priya Menon",
  "Neha Desai",
  "Karan Mehta",
  "Sana Iyer",
];

function pseudo(id: number, salt: number, min: number, max: number): number {
  const t = Math.sin(id * 997 + salt * 131) * 10_000;
  const frac = t - Math.floor(t);
  return min + frac * (max - min);
}

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

function activeSlabForAchievement(pct: number): number {
  let active = SLAB_DEFS[0].targetPct;
  for (const slab of SLAB_DEFS) {
    if (pct >= slab.targetPct) active = slab.targetPct;
  }
  return active;
}

function eligibleSlabForAchievement(pct: number): (typeof SLAB_DEFS)[number] {
  let picked = SLAB_DEFS[0];
  for (const slab of SLAB_DEFS) {
    if (pct >= slab.targetPct) picked = slab;
  }
  return picked;
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

export function buildIncentiveProfile(member: IncentiveMemberRef): IncentiveProfile {
  const id = member.id || 1;
  const target = 50_00_000 + (id % 6) * 5_00_000;
  const achievementPct = Math.round(pseudo(id, 1, 38, 88) * 10) / 10;
  const revenueAchieved = Math.round((target * achievementPct) / 100);
  const revenueDelta = `+${Math.round(pseudo(id, 2, 4, 18))}%`;
  const activeSlabPct = activeSlabForAchievement(achievementPct);
  const eligible = eligibleSlabForAchievement(achievementPct);
  const incentiveEarned = Math.round((revenueAchieved * eligible.rate) / 100);
  const sameDayCount = Math.max(1, Math.round(pseudo(id, 3, 2, 7)));
  const fortyEightHourCount = Math.max(1, Math.round(pseudo(id, 4, 2, 6)));
  const totalClosures = sameDayCount + fortyEightHourCount;
  const sameDayAmount = sameDayCount * 750;
  const fortyEightHourAmount = fortyEightHourCount * 375;
  const totalSpeedBonus = sameDayAmount + fortyEightHourAmount;

  const slabs: IncentiveSlabRow[] = SLAB_DEFS.map((slab) => ({
    tier: slab.tier,
    targetPct: slab.targetPct,
    revenue: formatInr(slab.revenue),
    incentivePct: `${slab.rate.toFixed(2)}%`,
    potential: formatInr(Math.round((slab.revenue * slab.rate) / 100)),
    active: slab.targetPct === activeSlabPct,
  }));

  const dealCount = Math.min(5, 3 + (id % 3));
  const dealLedger: DealLedgerRow[] = Array.from({ length: dealCount }, (_, idx) => {
    const customer = SAMPLE_CUSTOMERS[(id + idx) % SAMPLE_CUSTOMERS.length];
    const dealValue = Math.round(pseudo(id, 10 + idx, 3_00_000, 9_00_000));
    const contributionPct = Math.round((dealValue / Math.max(revenueAchieved, 1)) * 1000) / 10;
    const closureOptions: DealLedgerRow["closureTime"][] = ["SAME DAY", "48 HOURS", "72 HOURS+"];
    const closureTime = closureOptions[(id + idx) % closureOptions.length];
    const incentive = Math.round((dealValue * eligible.rate) / 100);
    return {
      id: `${id}-${idx}`,
      initials: initialsFromName(customer),
      customer,
      dealValue: formatInr(dealValue),
      closureTime,
      contributionPct,
      incentive: formatInr(incentive),
    };
  });

  return {
    member,
    summary: {
      totalTarget: formatInr(target),
      revenueAchieved: formatInr(revenueAchieved),
      revenueDelta,
      achievementPct,
      incentiveEarned: formatInr(incentiveEarned),
      onSpotBonus: formatInr(totalSpeedBonus),
      nextSlabGap: nextSlabGapAmount(target, revenueAchieved, achievementPct),
      currentSlabLabel: `${activeSlabPct}%`,
    },
    slabs,
    payoutMath: {
      revenueAchieved: formatInr(revenueAchieved),
      eligibleSlab: `${eligible.targetPct}%`,
      multiplier: `${eligible.rate.toFixed(2)}%`,
      totalPayout: formatInr(incentiveEarned),
    },
    speedBonuses: {
      totalClosures,
      sameDayCount,
      sameDayAmount: formatInr(sameDayAmount),
      fortyEightHourCount,
      fortyEightHourAmount: formatInr(fortyEightHourAmount),
      totalSpeedBonus: formatInr(totalSpeedBonus),
    },
    dealLedger,
  };
}

export { journeyMarkers };
