export const incentiveSummary = {
  totalTarget: "₹60,00,000",
  revenueAchieved: "₹32,00,000",
  revenueDelta: "+12%",
  achievementPct: 53.3,
  incentiveEarned: "₹14,400",
  onSpotBonus: "₹4,500",
  nextSlabGap: "₹8,00,000 TO NEXT SLAB",
  currentSlabLabel: "50%",
};

export const incentiveSlabs = [
  { tier: "BASE THRESHOLD", targetPct: 40, revenue: "₹20,00,000", incentivePct: "0.20%", potential: "₹4,000", active: false },
  { tier: "HIGH PERFORMANCE", targetPct: 50, revenue: "₹25,00,000", incentivePct: "0.30%", potential: "₹7,500", active: true },
  { tier: "ELITE TIER", targetPct: 60, revenue: "₹30,00,000", incentivePct: "0.45%", potential: "₹13,500", active: false },
  { tier: "SUPER PERFORMER", targetPct: 80, revenue: "₹40,00,000", incentivePct: "0.60%", potential: "₹24,000", active: false },
  { tier: "MASTER CLOSER", targetPct: 100, revenue: "₹50,00,000", incentivePct: "0.80%", potential: "₹40,000", active: false },
];

export const payoutMath = {
  revenueAchieved: "₹32,00,000",
  eligibleSlab: "60%",
  multiplier: "0.45%",
  totalPayout: "₹14,400",
};

export const speedBonuses = {
  totalClosures: 8,
  sameDayCount: 4,
  sameDayAmount: "₹3,000",
  fortyEightHourCount: 4,
  fortyEightHourAmount: "₹1,500",
  totalSpeedBonus: "₹4,500",
};

export type DealLedgerRow = {
  id: string;
  initials: string;
  customer: string;
  dealValue: string;
  closureTime: "SAME DAY" | "48 HOURS" | "72 HOURS+";
  contributionPct: number;
  incentive: string;
};

export const dealLedger: DealLedgerRow[] = [
  { id: "1", initials: "JS", customer: "Juned Shaikh", dealValue: "₹8,50,000", closureTime: "SAME DAY", contributionPct: 31, incentive: "₹3,825" },
  { id: "2", initials: "VS", customer: "Viren Shah", dealValue: "₹7,30,000", closureTime: "72 HOURS+", contributionPct: 26.6, incentive: "₹3,285" },
  { id: "3", initials: "AG", customer: "Ajay Gupta", dealValue: "₹3,45,000", closureTime: "48 HOURS", contributionPct: 12.6, incentive: "₹1,552.50" },
  { id: "4", initials: "RK", customer: "Rahul Kulkarni", dealValue: "₹6,20,000", closureTime: "SAME DAY", contributionPct: 22.4, incentive: "₹2,790" },
  { id: "5", initials: "PM", customer: "Priya Menon", dealValue: "₹4,85,000", closureTime: "48 HOURS", contributionPct: 17.5, incentive: "₹2,182" },
];

export const journeyMarkers = [40, 50, 60, 80, 100];
