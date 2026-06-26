export type BookingTokenTab = "bookings" | "tokens";

export type TokenStatus = "issued" | "minting" | "pending";
export type BookingStatus = "confirmed" | "in_progress";

export type KpiCard = {
  id: string;
  label: string;
  value: string;
  trend: string;
  trendUp: boolean;
  trendUrgent?: boolean;
  barTone: "green" | "orange";
  barWidth: number;
};

export type DealRow = {
  id: string;
  initials: string;
  customer: string;
  asset: string;
  dealValue: string;
  preBooking: string;
  tokenStatus: TokenStatus;
  bookingStatus: BookingStatus;
  expClosing: string;
  showConvert?: boolean;
  /** Set when row came from Booking Done handoff. */
  fromBookingDone?: boolean;
};

export type LedgerItem = {
  id: string;
  title: string;
  detail: string;
  time: string;
  tone: "success" | "warning" | "info";
};

export type UrgentTask = {
  id: string;
  title: string;
  detail: string;
  due: string;
  tone: "danger" | "warning";
};

export type PipelineBar = {
  month: string;
  value: number;
};
