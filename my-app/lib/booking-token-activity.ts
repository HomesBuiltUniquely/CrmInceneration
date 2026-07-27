/** @deprecated Hub writes BOOKING_TOKEN_* activities — no client storage. */
export type BookingTokenActivityRecord = {
  id: string;
  event: string;
  description: string;
  by: string;
  note?: string;
  createdAtIso: string;
};
