import type { DealRow, KpiCard, LedgerItem, PipelineBar, UrgentTask } from "../types";

export const KPI_CARDS: KpiCard[] = [
  {
    id: "total",
    label: "Total Booking Value",
    value: "$4.82M",
    trend: "+12.4%",
    trendUp: true,
    barTone: "green",
    barWidth: 78,
  },
  {
    id: "rate",
    label: "Booking Value",
    value: "64.8%",
    trend: "+3.1%",
    trendUp: true,
    barTone: "green",
    barWidth: 65,
  },
  {
    id: "pending",
    label: "Pending Tokens",
    value: "18",
    trend: "-2",
    trendUp: false,
    trendUrgent: true,
    barTone: "orange",
    barWidth: 42,
  },
  {
    id: "deposits",
    label: "Pre-Booking Deposits",
    value: "$142.5K",
    trend: "+5.2%",
    trendUp: true,
    barTone: "green",
    barWidth: 55,
  },
];

export const DEAL_ROWS: DealRow[] = [
  {
    id: "1",
    initials: "TC",
    customer: "TerraCorp Global",
    asset: "Industrial Asset",
    dealValue: "$1.25M",
    preBooking: "$12,500",
    tokenStatus: "issued",
    bookingStatus: "confirmed",
    expClosing: "Oct 24, 2024",
    showConvert: true,
  },
  {
    id: "2",
    initials: "NV",
    customer: "Nexus Ventures",
    asset: "Series C Block",
    dealValue: "$840K",
    preBooking: "$8,400",
    tokenStatus: "minting",
    bookingStatus: "in_progress",
    expClosing: "Nov 17, 2024",
  },
  {
    id: "3",
    initials: "SH",
    customer: "SkyHigh Real Estate",
    asset: "Portfolio Block",
    dealValue: "$2.1M",
    preBooking: "$21,000",
    tokenStatus: "issued",
    bookingStatus: "confirmed",
    expClosing: "Dec 02, 2024",
  },
  {
    id: "4",
    initials: "AL",
    customer: "Apex Logistics",
    asset: "Warehouse Token",
    dealValue: "$620K",
    preBooking: "$6,200",
    tokenStatus: "minting",
    bookingStatus: "in_progress",
    expClosing: "Jan 08, 2025",
  },
];

export const LEDGER_ITEMS: LedgerItem[] = [
  {
    id: "l1",
    title: "Pre-booking Deposit Received",
    detail: "TerraCorp Global — $12,500",
    time: "2 mins ago",
    tone: "success",
  },
  {
    id: "l2",
    title: "Token Minting Initiated",
    detail: "Nexus Ventures — 840,000 Units",
    time: "15 mins ago",
    tone: "warning",
  },
  {
    id: "l3",
    title: "Smart Contract Verified",
    detail: "SkyHigh Real Estate Portfolio",
    time: "1 hour ago",
    tone: "success",
  },
];

export const URGENT_TASKS: UrgentTask[] = [
  {
    id: "t1",
    title: "Smart Contract Audit Required",
    detail: "Nexus Ventures Pipeline",
    due: "ASAP",
    tone: "danger",
  },
  {
    id: "t2",
    title: "KYC Documents Expiring",
    detail: "SkyHigh Real Estate Portfolio",
    due: "2 DAYS",
    tone: "warning",
  },
];

export const PIPELINE_BARS: PipelineBar[] = [
  { month: "JAN", value: 42 },
  { month: "FEB", value: 55 },
  { month: "MAR", value: 48 },
  { month: "APR", value: 62 },
  { month: "MAY", value: 58 },
  { month: "JUN", value: 71 },
  { month: "JUL", value: 65 },
  { month: "AUG", value: 78 },
  { month: "SEP", value: 82 },
  { month: "OCT", value: 88 },
  { month: "NOV", value: 92 },
  { month: "DEC", value: 95 },
];

export const SIDEBAR_NAV = [
  { id: "overview", label: "Overview", active: true },
  { id: "pipeline", label: "Pipeline", active: false },
  { id: "ledger", label: "Token Ledger", active: false },
  { id: "team", label: "Team", active: false },
  { id: "reports", label: "Reports", active: false },
] as const;

export const TOP_NAV = [
  { id: "dashboard", label: "Dashboard", active: true },
  { id: "deals", label: "Deals", active: false },
  { id: "analytics", label: "Analytics", active: false },
  { id: "tokens", label: "Tokens", active: false },
] as const;
